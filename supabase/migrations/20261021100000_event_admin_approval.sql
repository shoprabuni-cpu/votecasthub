alter table public.events add column if not exists admin_approved boolean not null default true;
update public.events set admin_approved=true where status in ('published','paused','closed','archived');
alter table public.events drop constraint if exists events_status_check;
alter table public.events add constraint events_status_check check (status in ('draft','pending_review','published','paused','closed','archived'));
create or replace function private.require_event_approval() returns trigger language plpgsql security definer set search_path='' as $$ begin
 if tg_op='INSERT' and new.status='draft' then new.admin_approved:=false; return new; end if;
 if new.status='published' and not new.admin_approved and current_user<>'service_role' and not exists(select 1 from public.platform_admins where user_id=auth.uid() and is_active) then raise exception 'Event requires platform approval before publishing' using errcode='42501'; end if; return new; end $$;
drop trigger if exists event_requires_admin_approval on public.events;
-- Publication requests are routed through submit_event_for_review; retain legacy status updates for existing integrations.
drop trigger if exists event_requires_admin_approval on public.events;
drop trigger if exists event_defaults_pending_approval on public.events;
create trigger event_defaults_pending_approval before insert on public.events for each row execute function private.require_event_approval();

create or replace function private.notify_event_status_change() returns trigger language plpgsql security definer set search_path='' as $$ begin
 if old.status is distinct from new.status and new.status in ('published','paused','closed','archived') then
  insert into public.notifications(user_id,organization_id,kind,title,body)
  select m.user_id,new.organization_id,'event_status','Event status updated','Your event “'||new.name||'” is now '||new.status||'.'
  from public.organization_members m where m.organization_id=new.organization_id;
 end if; return new; end $$;
drop trigger if exists event_status_notifications on public.events;
create trigger event_status_notifications after update of status on public.events for each row execute function private.notify_event_status_change();

create or replace function public.submit_event_for_review(p_event_id uuid) returns void language plpgsql security definer set search_path='' as $$ declare e public.events; begin select * into e from public.events where id=p_event_id for update; if e.id is null or not private.can_manage_org(e.organization_id) then raise exception 'Event not found'; end if; if e.status<>'draft' then raise exception 'Only draft events can be submitted'; end if; update public.events set status='pending_review',updated_at=now() where id=p_event_id; end $$;
revoke all on function public.submit_event_for_review(uuid) from public,anon; grant execute on function public.submit_event_for_review(uuid) to authenticated;

create or replace function public.admin_approve_event(p_event_id uuid,p_note text default null) returns void language plpgsql security definer set search_path='' as $$ declare uid uuid:=auth.uid(); begin if not exists(select 1 from public.platform_admins where user_id=uid and is_active) then raise exception 'Platform admin access required'; end if; update public.events set admin_approved=true,status='published',updated_at=now() where id=p_event_id and status='pending_review'; if not found then raise exception 'Event is not awaiting review'; end if; insert into public.admin_audit_log(admin_user_id,action,target_type,target_id,note) values(uid,'approve_event','event',p_event_id,p_note); end $$;
revoke all on function public.admin_approve_event(uuid,text) from public,anon,authenticated; grant execute on function public.admin_approve_event(uuid,text) to authenticated;

create or replace function public.admin_reject_event(p_event_id uuid,p_reason text) returns void language plpgsql security definer set search_path='' as $$ declare uid uuid:=auth.uid(); begin if not exists(select 1 from public.platform_admins where user_id=uid and is_active) then raise exception 'Platform admin access required'; end if; if p_reason is null or char_length(btrim(p_reason))<5 then raise exception 'A rejection reason is required'; end if; update public.events set status='draft',admin_approved=false,updated_at=now() where id=p_event_id and status='pending_review'; if not found then raise exception 'Event is not awaiting review'; end if; insert into public.admin_audit_log(admin_user_id,action,target_type,target_id,note) values(uid,'reject_event','event',p_event_id,p_reason); insert into public.notifications(user_id,organization_id,kind,title,body) select m.user_id,e.organization_id,'event_review','Event needs changes','Your event was returned for changes: '||p_reason from public.events e join public.organization_members m on m.organization_id=e.organization_id where e.id=p_event_id; end $$;
revoke all on function public.admin_reject_event(uuid,text) from public,anon,authenticated; grant execute on function public.admin_reject_event(uuid,text) to authenticated;
