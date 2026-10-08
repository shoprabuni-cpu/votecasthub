-- Private review conversations survive resubmission without exposing feedback to voters.
create table public.event_review_messages(
 id uuid primary key default gen_random_uuid(),event_id uuid not null references public.events(id) on delete cascade,
 actor_id uuid references auth.users(id) on delete set null,
 kind text not null check(kind in ('returned','comment','reply','submitted','approved','withdrawn')),
 body text not null check(char_length(btrim(body)) between 5 and 2000),created_at timestamptz not null default now()
);
create index event_review_messages_history on public.event_review_messages(event_id,created_at desc,id);
alter table public.event_review_messages enable row level security;
revoke all on public.event_review_messages from public,anon,authenticated;
grant select on public.event_review_messages to authenticated;
grant all on public.event_review_messages to service_role;
create function private.can_read_event_review(p_event uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.is_platform_admin() or exists(select 1 from public.events e where e.id=p_event and private.is_org_member(e.organization_id));
$$;
revoke all on function private.can_read_event_review(uuid) from public,anon;
grant execute on function private.can_read_event_review(uuid) to authenticated;
create policy event_review_messages_private_read on public.event_review_messages for select to authenticated using(private.can_read_event_review(event_id));
drop policy correction_member_read on public.event_correction_requests;
create policy correction_member_read on public.event_correction_requests for select to authenticated using(private.can_read_event_review(event_id));
insert into public.event_review_messages(event_id,kind,body,created_at)
select event_id,'returned',left(message,2000),created_at from public.event_notices where kind='review';
create function private.can_read_event_notice(p_event uuid,p_kind text) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.events e where e.id=p_event and ((p_kind<>'review' and private.can_view_event(e.id)) or private.is_org_member(e.organization_id) or private.is_platform_admin()));
$$;
revoke all on function private.can_read_event_notice(uuid,text) from public;
grant execute on function private.can_read_event_notice(uuid,text) to anon,authenticated;
drop policy event_notices_read on public.event_notices;
create policy event_notices_read on public.event_notices for select using(private.can_read_event_notice(event_id,kind));

-- Restore the notification foundation on databases where the earlier table is missing.
create table if not exists public.notifications(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 organization_id uuid references public.organizations(id) on delete cascade,
 kind text not null,title text not null,body text not null,
 read_at timestamptz,created_at timestamptz not null default now()
);
alter table public.notifications enable row level security;
revoke all on public.notifications from public,anon,authenticated;
grant select,update on public.notifications to authenticated;
grant all on public.notifications to service_role;
drop policy if exists notification_owner_read on public.notifications;
create policy notification_owner_read on public.notifications for select to authenticated using(user_id=auth.uid());
drop policy if exists notification_owner_update on public.notifications;
create policy notification_owner_update on public.notifications for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
alter table public.notifications add column if not exists event_id uuid references public.events(id) on delete set null;

create function private.event_has_activity(p_event_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.vote_batches where event_id=p_event_id) or exists(select 1 from public.payment_attempts where event_id=p_event_id);
$$;
revoke all on function private.event_has_activity(uuid) from public,anon,authenticated;

-- Voting already locks events FOR SHARE. Cover inserts through other integrations too.
create function private.lock_event_activity() returns trigger language plpgsql security definer set search_path='' as $$
declare e public.events;
begin
 select * into e from public.events where id=new.event_id for share;
 if e.status in ('draft','pending_review') then raise exception 'Voting or payment attempts cannot start while the event is a draft or awaiting review' using errcode='22023'; end if;
 return new;
end $$;
create trigger a_lock_event_activity before insert on public.vote_batches for each row execute function private.lock_event_activity();
create trigger a_lock_event_activity before insert on public.payment_attempts for each row execute function private.lock_event_activity();
revoke all on function private.lock_event_activity() from public,anon,authenticated;

create function private.guard_event_return_to_draft() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.status='draft' and old.status is distinct from 'draft' then
  if old.status in ('closed','archived') then raise exception 'Permanently closed or archived events cannot return to draft' using errcode='22023'; end if;
  if private.event_has_activity(old.id) then raise exception 'This event has votes or payment attempts. Pause voting or request a correction; it cannot return to draft' using errcode='22023'; end if;
  new.admin_approved:=false;
 end if;
 return new;
end $$;
create trigger guard_event_return_to_draft before update of status on public.events for each row execute function private.guard_event_return_to_draft();
revoke all on function private.guard_event_return_to_draft() from public,anon,authenticated;

create or replace function public.submit_event_for_review(p_event_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare e public.events;
begin
 select * into e from public.events where id=p_event_id for update;
 if not found then raise exception 'Event not found' using errcode='P0002'; end if;
 if not private.can_manage_org(e.organization_id) then raise exception 'Organization access denied' using errcode='42501'; end if;
 if e.purged_at is not null or exists(select 1 from public.admin_deletion_jobs where status='pending' and ((target_kind='event' and target_id=e.id) or (target_kind='organization' and target_id=e.organization_id))) then raise exception 'This workspace or event is scheduled for deletion or already purged' using errcode='42501'; end if;
 if e.status<>'draft' then raise exception 'Only draft events can be submitted. Withdraw the current review before editing.' using errcode='22023'; end if;
 if private.event_has_activity(e.id) then raise exception 'This event has voting or payment history and cannot start a new draft review' using errcode='22023'; end if;
 update public.events set status='pending_review',admin_approved=false,updated_at=now() where id=e.id;
end $$;

create or replace function public.set_event_status(p_event_id uuid,p_action text)
returns text language plpgsql security definer set search_path='' as $$
declare e public.events;
begin
 if p_action is null or p_action not in ('publish','pause','resume','close','archive','unpublish') then raise exception 'Invalid event action' using errcode='22023'; end if;
 if p_action='publish' then perform public.submit_event_for_review(p_event_id); return 'pending_review'; end if;
 if p_action<>'unpublish' then return public.set_event_status_before_fairness(p_event_id,p_action); end if;
 select * into e from public.events where id=p_event_id for update;
 if not found then raise exception 'Event not found' using errcode='P0002'; end if;
 if not private.can_manage_org(e.organization_id) then raise exception 'Organization access denied' using errcode='42501'; end if;
 if e.status not in ('pending_review','published','paused') then raise exception 'Only an event awaiting review or an unused published event can return to draft' using errcode='22023'; end if;
 if e.status<>'pending_review' and not exists(select 1 from public.organization_members where organization_id=e.organization_id and user_id=auth.uid() and role in ('owner','admin')) then raise exception 'Only owners and admins can unpublish events' using errcode='42501'; end if;
 update public.events set status='draft',admin_approved=false,updated_at=now() where id=e.id;
 insert into public.event_review_messages(event_id,actor_id,kind,body) values(e.id,auth.uid(),'withdrawn','Returned to draft by the organizer. Update the event and submit it for a new review.');
 insert into public.audit_logs(organization_id,actor_user_id,action,resource_type,resource_id,metadata)
 values(e.organization_id,auth.uid(),'event_status_changed','event',e.id::text,jsonb_build_object('from',e.status,'to','draft','approval_cleared',true));
 return 'draft';
end $$;

create function private.record_event_review_transition() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.status='pending_review' and old.status='draft' then
  insert into public.event_review_messages(event_id,actor_id,kind,body) values(new.id,auth.uid(),'submitted','Submitted for platform review. The event is private until approved.');
  insert into public.notifications(user_id,organization_id,event_id,kind,title,body)
  select user_id,new.organization_id,new.id,'event_review','Event awaiting review',new.name||' was submitted for review.' from public.platform_admins where is_active;
 elsif new.status='published' and old.status='pending_review' then
  insert into public.event_review_messages(event_id,actor_id,kind,body) values(new.id,auth.uid(),'approved','Platform review approved this event. Voting follows the published schedule.');
 end if;
 return new;
end $$;
create trigger record_event_review_transition after update of status on public.events for each row execute function private.record_event_review_transition();
revoke all on function private.record_event_review_transition() from public,anon,authenticated;

create or replace function private.notify_event_status_change() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if old.status is distinct from new.status and new.status in ('published','paused','closed','archived') then
  insert into public.notifications(user_id,organization_id,event_id,kind,title,body)
  select user_id,new.organization_id,new.id,'event_status',new.name||': '||new.status,'Your event status changed to '||new.status||'. Open the event to view its schedule and review history.'
  from public.organization_members where organization_id=new.organization_id;
 end if;
 return new;
end $$;

alter function public.admin_set_event_status(uuid,text,text) rename to admin_set_event_status_before_review_recovery;
revoke all on function public.admin_set_event_status_before_review_recovery(uuid,text,text) from public,anon,authenticated,service_role;
create function public.admin_set_event_status(p_event_id uuid,p_status text,p_note text default null) returns void language plpgsql security definer set search_path='' as $$
declare e public.events;
begin
 if not private.is_platform_admin() then raise exception 'Platform admin access required' using errcode='42501'; end if;
 select * into e from public.events where id=p_event_id for update;
 if p_status='published' and not e.admin_approved then raise exception 'This event needs a new review. Submit it for review and use Approve.' using errcode='22023'; end if;
 perform public.admin_set_event_status_before_review_recovery(p_event_id,p_status,p_note);
end $$;
revoke all on function public.admin_set_event_status(uuid,text,text) from public,anon;
grant execute on function public.admin_set_event_status(uuid,text,text) to authenticated;

create or replace function public.admin_reject_event(p_event_id uuid,p_reason text)
returns void language plpgsql security definer set search_path='' as $$
declare e public.events;
begin
 if not private.is_platform_admin() then raise exception 'Platform admin access required' using errcode='42501'; end if;
 if p_reason is null or char_length(btrim(p_reason)) not between 5 and 1000 then raise exception 'Explain the required changes in 5–1000 characters' using errcode='22023'; end if;
 select * into e from public.events where id=p_event_id for update;
 if not found then raise exception 'Event not found' using errcode='P0002'; end if;
 if e.status<>'pending_review' then raise exception 'Event is not awaiting review' using errcode='22023'; end if;
 update public.events set status='draft',admin_approved=false,updated_at=now() where id=e.id;
 insert into public.event_review_messages(event_id,actor_id,kind,body) values(e.id,auth.uid(),'returned',btrim(p_reason));
 insert into public.admin_audit_log(admin_user_id,action,target_type,target_id,note) values(auth.uid(),'reject_event','event',e.id,btrim(p_reason));
 insert into public.notifications(user_id,organization_id,event_id,kind,title,body)
 select user_id,e.organization_id,e.id,'event_review','Changes requested: '||e.name,btrim(p_reason) from public.organization_members where organization_id=e.organization_id;
end $$;

create or replace function public.reopen_event_voting(p_event_id uuid,p_ends_at timestamptz,p_reason text)
returns void language plpgsql security definer set search_path='' as $$
declare e public.events; readiness jsonb;
begin
 select * into e from public.events where id=p_event_id for update;
 if not found then raise exception 'Event not found' using errcode='P0002'; end if;
 if not private.can_manage_org(e.organization_id) or not exists(select 1 from public.organization_members where organization_id=e.organization_id and user_id=auth.uid() and role in ('owner','admin')) then raise exception 'Only owners and admins can reopen voting' using errcode='42501'; end if;
 if e.status not in ('published','paused') or e.ends_at>now() then raise exception 'Only an expired event can be reopened. Permanently closed events stay closed' using errcode='22023'; end if;
 if p_ends_at is null or p_ends_at<=now() or p_reason is null or length(btrim(p_reason)) not between 20 and 1000 then raise exception 'Choose a future deadline and explain the reopening in 20–1000 characters' using errcode='22023'; end if;
 if e.voting_mode='paid' and not public.can_publish_paid_event(e.id) then raise exception 'Verify your payment account before reopening' using errcode='22023'; end if;
 if e.voting_mode='free' then
  readiness:=public.get_event_verification_readiness(e.id);
  if not coalesce((readiness->>'ready')::boolean,false) then raise exception '%',readiness->>'message' using errcode='22023'; end if;
 end if;
 update public.events set ends_at=p_ends_at,status='published',results_released=results_released or results_visibility='after_close' where id=e.id;
 insert into public.event_notices(event_id,kind,message,previous_deadline,new_deadline) values(e.id,'reopened',btrim(p_reason),e.ends_at,p_ends_at);
 insert into public.audit_logs(organization_id,actor_user_id,action,resource_type,resource_id,metadata)
 values(e.organization_id,auth.uid(),'event_reopened','event',e.id::text,jsonb_build_object('previous_deadline',e.ends_at,'new_deadline',p_ends_at,'reason',p_reason));
end $$;

create function public.send_event_review_message(p_event_id uuid,p_body text)
returns void language plpgsql security definer set search_path='' as $$
declare e public.events; admin boolean:=private.is_platform_admin();
begin
 select * into e from public.events where id=p_event_id;
 if not found then raise exception 'Event not found' using errcode='P0002'; end if;
 if not admin and not private.can_manage_org(e.organization_id) then raise exception 'Event access denied' using errcode='42501'; end if;
 if p_body is null or char_length(btrim(p_body)) not between 5 and 2000 then raise exception 'Write a message of 5–2000 characters' using errcode='22023'; end if;
 if not public.payment_rate_limit('review-message:'||auth.uid()::text,10,300) then raise exception 'Too many messages. Try again in five minutes' using errcode='22023'; end if;
 insert into public.event_review_messages(event_id,actor_id,kind,body) values(e.id,auth.uid(),case when admin then 'comment' else 'reply' end,btrim(p_body));
 if admin then
  insert into public.notifications(user_id,organization_id,event_id,kind,title,body)
  select user_id,e.organization_id,e.id,'event_review','Platform message: '||e.name,btrim(p_body) from public.organization_members where organization_id=e.organization_id;
 else
  insert into public.notifications(user_id,organization_id,event_id,kind,title,body)
  select user_id,e.organization_id,e.id,'event_review','Organizer reply: '||e.name,btrim(p_body) from public.platform_admins where is_active;
 end if;
end $$;
revoke all on function public.send_event_review_message(uuid,text) from public,anon;
grant execute on function public.send_event_review_message(uuid,text) to authenticated;

create or replace function public.admin_review_event_correction(p_request_id uuid,p_approve boolean,p_note text) returns void language plpgsql security definer set search_path='' as $$
declare e public.events;
begin
 if not private.is_platform_admin() then raise exception 'Platform admin access required' using errcode='42501'; end if;
 if p_note is null or char_length(btrim(p_note)) not between 20 and 1000 then raise exception 'Explain the identity and fairness checks in 20–1000 characters' using errcode='22023'; end if;
 perform public.review_event_correction(p_request_id,p_approve,btrim(p_note));
 select ev.* into e from public.events ev join public.event_correction_requests r on r.event_id=ev.id where r.id=p_request_id;
 insert into public.admin_audit_log(admin_user_id,action,target_type,target_id,note) values(auth.uid(),case when p_approve then 'approve_correction' else 'reject_correction' end,'event_correction',p_request_id,btrim(p_note));
 insert into public.event_review_messages(event_id,actor_id,kind,body) values(e.id,auth.uid(),'comment',case when p_approve then 'Correction approved: ' else 'Correction rejected: ' end||btrim(p_note));
 insert into public.notifications(user_id,organization_id,event_id,kind,title,body)
 select user_id,e.organization_id,e.id,'event_review',case when p_approve then 'Correction approved: ' else 'Correction rejected: ' end||e.name,btrim(p_note) from public.organization_members where organization_id=e.organization_id;
end $$;

create function public.get_event_workspace_states(p_organization_id uuid)
returns table(event_id uuid,has_activity boolean,review_feedback text,last_review_kind text)
language sql stable security definer set search_path='' as $$
 select e.id,private.event_has_activity(e.id),
 (select body from public.event_review_messages where event_id=e.id and kind in ('returned','comment')
  and created_at>=coalesce((select max(created_at) from public.event_review_messages where event_id=e.id and kind in ('submitted','approved','withdrawn')),'epoch'::timestamptz)
  order by created_at desc,id desc limit 1),
 (select kind from public.event_review_messages where event_id=e.id and kind in ('returned','submitted','approved','withdrawn') order by created_at desc,id desc limit 1)
 from public.events e where e.organization_id=p_organization_id and private.is_org_member(p_organization_id);
$$;
revoke all on function public.get_event_workspace_states(uuid) from public,anon;
grant execute on function public.get_event_workspace_states(uuid) to authenticated;

-- Live descriptions and cover images may change; competition identity and rules remain protected.
create or replace function public.update_event_details(p_event_id uuid,p_name text,p_description text,p_starts_at timestamptz,p_ends_at timestamptz,p_results_visibility text,p_voting_rules text)
returns void language plpgsql security definer set search_path='' as $$
declare e public.events;
begin
 select * into e from public.events where id=p_event_id for update;
 if not found then raise exception 'Event not found' using errcode='P0002'; end if;
 if not private.can_manage_org(e.organization_id) then raise exception 'Organization access denied' using errcode='42501'; end if;
 if lower(regexp_replace(btrim(p_name),'\s+',' ','g')) is distinct from lower(regexp_replace(btrim(e.name),'\s+',' ','g')) then raise exception 'Published event names are protected. Submit a spelling correction for review' using errcode='22023'; end if;
 if e.starts_at<=now() or private.event_has_activity(e.id) or e.status='closed' then
  if p_results_visibility is distinct from e.results_visibility then raise exception 'Results visibility is locked once voting starts' using errcode='22023'; end if;
  if coalesce(nullif(btrim(p_voting_rules),''),'')<>coalesce(e.voting_rules,'') then raise exception 'Voter instructions are locked. Submit a correction or clarification for review' using errcode='22023'; end if;
 end if;
 if e.status='closed' and coalesce(nullif(btrim(p_description),''),'')<>coalesce(e.description,'') then raise exception 'Closed event descriptions require a correction review' using errcode='22023'; end if;
 if e.ends_at<=now() and p_ends_at is distinct from e.ends_at then raise exception 'Use Reopen voting with a public reason instead of silently changing an expired deadline' using errcode='22023'; end if;
 perform public.update_event_details_before_fairness(p_event_id,p_name,p_description,p_starts_at,p_ends_at,p_results_visibility,p_voting_rules);
 if p_ends_at is distinct from e.ends_at then insert into public.event_notices(event_id,kind,message,previous_deadline,new_deadline) values(e.id,'extension','The organizer extended the voting deadline. Existing votes and voting limits are unchanged.',e.ends_at,p_ends_at); end if;
 if p_starts_at is distinct from e.starts_at then insert into public.event_notices(event_id,kind,message) values(e.id,'schedule','The organizer updated the voting opening time.'); end if;
 if nullif(btrim(p_description),'') is distinct from e.description then insert into public.event_notices(event_id,kind,message) values(e.id,'correction','The organizer updated the event description. Recorded votes and voting limits remain unchanged.'); end if;
end $$;
