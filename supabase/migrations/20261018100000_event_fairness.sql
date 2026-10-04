alter table public.events add column results_released boolean not null default false;
grant select(results_released) on public.events to anon,authenticated;
create table public.event_notices(
 id uuid primary key default gen_random_uuid(),event_id uuid not null references public.events(id) on delete cascade,
 kind text not null, message text not null, previous_deadline timestamptz,new_deadline timestamptz,
 created_at timestamptz not null default now()
);
alter table public.event_notices enable row level security;
revoke all on public.event_notices from anon,authenticated;
grant select on public.event_notices to anon,authenticated;
create policy event_notices_read on public.event_notices for select using(exists(
 select 1 from public.events e where e.id=event_id and (e.status in ('published','paused','closed') or private.is_org_member(e.organization_id))));
create trigger event_notices_immutable before update on public.event_notices for each row execute function private.reject_immutable_row_change();

alter function public.update_event_details(uuid,text,text,timestamptz,timestamptz,text,text) rename to update_event_details_before_fairness;
revoke all on function public.update_event_details_before_fairness(uuid,text,text,timestamptz,timestamptz,text,text) from public,anon,authenticated,service_role;
create function public.update_event_details(p_event_id uuid,p_name text,p_description text,p_starts_at timestamptz,p_ends_at timestamptz,p_results_visibility text,p_voting_rules text)
returns void language plpgsql security definer set search_path='' as $$
declare e public.events;
begin
 select * into e from public.events where id=p_event_id for update;
 if not found then raise exception 'Event not found' using errcode='P0002'; end if;
 if not private.can_manage_org(e.organization_id) then raise exception 'Organization access denied' using errcode='42501'; end if;
 if lower(regexp_replace(btrim(p_name),'\s+',' ','g')) is distinct from lower(regexp_replace(btrim(e.name),'\s+',' ','g')) then
  raise exception 'Published event names are protected. Submit a spelling correction for review' using errcode='22023';
 end if;
 if e.starts_at<=now() or e.status='closed' then
  if p_results_visibility is distinct from e.results_visibility then raise exception 'Results visibility is locked once voting starts' using errcode='22023'; end if;
  if coalesce(nullif(btrim(p_description),''),'')<>coalesce(e.description,'') or coalesce(nullif(btrim(p_voting_rules),''),'')<>coalesce(e.voting_rules,'') then
   raise exception 'Description and voter instructions are locked. Submit a correction or clarification for review' using errcode='22023';
  end if;
 end if;
 if e.ends_at<=now() and p_ends_at is distinct from e.ends_at then raise exception 'Use Reopen voting with a public reason instead of silently changing an expired deadline' using errcode='22023'; end if;
 perform public.update_event_details_before_fairness(p_event_id,p_name,p_description,p_starts_at,p_ends_at,p_results_visibility,p_voting_rules);
 if p_ends_at is distinct from e.ends_at then
  insert into public.event_notices(event_id,kind,message,previous_deadline,new_deadline)
  values(e.id,'extension','The organizer has extended the voting deadline. Existing votes and voting limits are unchanged.',e.ends_at,p_ends_at);
 end if;
 if p_starts_at is distinct from e.starts_at then
  insert into public.event_notices(event_id,kind,message) values(e.id,'schedule','The organizer has updated the opening time. The current schedule is shown above.');
 end if;
end $$;
revoke all on function public.update_event_details(uuid,text,text,timestamptz,timestamptz,text,text) from public,anon;
grant execute on function public.update_event_details(uuid,text,text,timestamptz,timestamptz,text,text) to authenticated;

-- Do not allow returning a started event to draft to circumvent the fairness locks.
alter function public.set_event_status(uuid,text) rename to set_event_status_before_fairness;
revoke all on function public.set_event_status_before_fairness(uuid,text) from public,anon,authenticated,service_role;
create function public.set_event_status(p_event_id uuid,p_action text)
returns text language plpgsql security definer set search_path='' as $$
declare e public.events;
begin
 select * into e from public.events where id=p_event_id for update;
 if not private.can_manage_org(e.organization_id) then raise exception 'Organization access denied' using errcode='42501'; end if;
 if p_action='unpublish' and (e.starts_at<=now() or e.status='closed') then raise exception 'An event that has started or been permanently closed cannot return to draft. Archive it instead' using errcode='22023'; end if;
 return public.set_event_status_before_fairness(p_event_id,p_action);
end $$;
revoke all on function public.set_event_status(uuid,text) from public,anon;
grant execute on function public.set_event_status(uuid,text) to authenticated;

create function public.reopen_event_voting(p_event_id uuid,p_ends_at timestamptz,p_reason text)
returns void language plpgsql security definer set search_path='' as $$
declare e public.events;
begin
 select * into e from public.events where id=p_event_id for update;
 if not exists(select 1 from public.organization_members where organization_id=e.organization_id and user_id=auth.uid() and role in ('owner','admin')) then raise exception 'Only owners and admins can reopen voting' using errcode='42501'; end if;
 if e.status not in ('published','paused') or e.ends_at>now() then raise exception 'Only an expired event can be reopened. Permanently closed events stay closed' using errcode='22023'; end if;
 if p_ends_at is null or p_ends_at<=now() or p_reason is null or length(btrim(p_reason)) not between 20 and 1000 then raise exception 'Choose a future deadline and explain the reopening in 20–1000 characters' using errcode='22023'; end if;
 if e.voting_mode='paid' and not public.can_publish_paid_event(e.id) then raise exception 'Verify your payment account before reopening' using errcode='22023'; end if;
 if e.voting_mode='free' and not exists(select 1 from public.organization_sms_credits where organization_id=e.organization_id and balance>0) then raise exception 'Add SMS credits before reopening' using errcode='22023'; end if;
 update public.events set ends_at=p_ends_at,status='published',results_released=results_released or results_visibility='after_close' where id=e.id;
 insert into public.event_notices(event_id,kind,message,previous_deadline,new_deadline) values(e.id,'reopened',btrim(p_reason),e.ends_at,p_ends_at);
 insert into public.audit_logs(organization_id,actor_user_id,action,resource_type,resource_id,metadata)
 values(e.organization_id,auth.uid(),'event_reopened','event',e.id::text,jsonb_build_object('previous_deadline',e.ends_at,'new_deadline',p_ends_at,'reason',p_reason));
end $$;
revoke all on function public.reopen_event_voting(uuid,timestamptz,text) from public,anon;
grant execute on function public.reopen_event_voting(uuid,timestamptz,text) to authenticated;

create table public.event_correction_requests(
 id uuid primary key default gen_random_uuid(),event_id uuid not null references public.events(id) on delete restrict,
 nominee_id uuid references public.nominees(id) on delete restrict,
 kind text not null check(kind in ('name','description','instructions','clarification','photo')),
 proposed_value text not null check(length(proposed_value) between 1 and 5000),original_value text,
 reason text not null check(length(btrim(reason)) between 20 and 1000),
 requested_by uuid not null references auth.users(id),status text not null default 'pending' check(status in ('pending','approved','rejected')),
 review_note text,created_at timestamptz not null default now(),reviewed_at timestamptz
);
create unique index one_pending_event_correction on public.event_correction_requests(event_id,kind,coalesce(nominee_id,'00000000-0000-0000-0000-000000000000'::uuid)) where status='pending';
alter table public.event_correction_requests enable row level security;
revoke all on public.event_correction_requests from anon,authenticated;
grant select on public.event_correction_requests to authenticated;
grant all on public.event_correction_requests to service_role;
create policy correction_member_read on public.event_correction_requests for select to authenticated using(exists(select 1 from public.events e where e.id=event_id and private.is_org_member(e.organization_id)));
create function public.request_event_correction(p_event_id uuid,p_kind text,p_value text,p_reason text,p_nominee_id uuid default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare e public.events; original text; result uuid;
begin
 select * into e from public.events where id=p_event_id for update;
 if not private.can_manage_org(e.organization_id) then raise exception 'Organization access denied' using errcode='42501'; end if;
 if e.status not in ('published','paused','closed') then raise exception 'Corrections are only for published events' using errcode='22023'; end if;
 if p_kind='photo' then
  select n.image_path into original from public.nominees n join public.categories c on c.id=n.category_id where n.id=p_nominee_id and c.event_id=e.id;
  if not found or split_part(p_value,'/',1)<>e.id::text or split_part(p_value,'/',2)<>p_nominee_id::text or not private.can_submit_nominee_image_path(p_value)
   or not exists(select 1 from storage.objects where bucket_id='nominee-images' and name=p_value) then raise exception 'Upload a photo for this nominee first' using errcode='22023'; end if;
 else
  if p_nominee_id is not null then raise exception 'Invalid correction target' using errcode='22023'; end if;
  original:=case p_kind when 'name' then e.name when 'description' then e.description when 'instructions' then e.voting_rules else null end;
  if p_kind not in ('name','description','instructions','clarification') or p_value is null or length(btrim(p_value))<1 or length(p_value)>(case when p_kind='name' then 160 when p_kind='description' then 5000 else 3000 end) then raise exception 'Check the correction text' using errcode='22023'; end if;
 end if;
 insert into public.event_correction_requests(event_id,nominee_id,kind,proposed_value,original_value,reason,requested_by)
 values(e.id,p_nominee_id,p_kind,p_value,original,p_reason,auth.uid()) returning id into result;
 return result;
end $$;
revoke all on function public.request_event_correction(uuid,text,text,text,uuid) from public,anon;
grant execute on function public.request_event_correction(uuid,text,text,text,uuid) to authenticated;

-- Review is platform-only: organizers must never approve their own identity changes.
create function public.review_event_correction(p_request_id uuid,p_approve boolean,p_note text)
returns void language plpgsql security definer set search_path='' as $$
declare r public.event_correction_requests; e public.events; current_value text;
begin
 select * into r from public.event_correction_requests where id=p_request_id;
 select * into e from public.events where id=r.event_id for update;
 select * into r from public.event_correction_requests where id=p_request_id for update;
 if r.id is null or r.status<>'pending' or e.status not in ('published','paused','closed') then raise exception 'Correction is not reviewable'; end if;
 if p_approve is null or p_note is null or length(btrim(p_note))<20 then raise exception 'Record the identity/fairness checks in a review note'; end if;
 if p_approve then
  current_value:=case r.kind when 'name' then e.name when 'description' then e.description when 'instructions' then e.voting_rules else null end;
  if r.kind='photo' then select image_path into current_value from public.nominees where id=r.nominee_id; end if;
  if current_value is distinct from r.original_value then raise exception 'The original has changed. Reject this stale request and request a new correction'; end if;
  if r.kind='name' then update public.events set name=r.proposed_value where id=e.id;
  elsif r.kind='description' then update public.events set description=r.proposed_value where id=e.id;
  elsif r.kind='instructions' then update public.events set voting_rules=r.proposed_value where id=e.id;
  elsif r.kind='photo' then
   if not exists(select 1 from storage.objects where bucket_id='nominee-images' and name=r.proposed_value) then raise exception 'The proposed photo is no longer available'; end if;
   update public.nominees set image_path=r.proposed_value where id=r.nominee_id;
  end if;
  insert into public.event_notices(event_id,kind,message) values(e.id,'correction',case when r.kind='clarification' then r.proposed_value when r.kind='name' then 'Event name corrected from “'||e.name||'” to “'||r.proposed_value||'”. This is the same competition.' when r.kind='photo' then 'A nominee photo was corrected after identity review. The nominee and recorded votes are unchanged.' else 'An approved '||r.kind||' correction was published. Competition eligibility and winner-selection rules remain unchanged.' end);
 elsif r.kind='photo' then insert into public.event_image_cleanup(path) values(r.proposed_value) on conflict do nothing;
 end if;
 update public.event_correction_requests set status=case when p_approve then 'approved' else 'rejected' end,review_note=p_note,reviewed_at=now() where id=r.id;
 insert into public.audit_logs(organization_id,action,resource_type,resource_id,metadata)
 values(e.organization_id,'event_correction_reviewed','event_correction',r.id::text,jsonb_build_object('approved',p_approve,'review_note',p_note,'old_value',r.original_value,'new_value',r.proposed_value));
end $$;
revoke all on function public.review_event_correction(uuid,boolean,text) from public,anon,authenticated;
grant execute on function public.review_event_correction(uuid,boolean,text) to service_role;

alter function public.update_nominee_image(uuid,text) rename to update_nominee_image_before_fairness;
revoke all on function public.update_nominee_image_before_fairness(uuid,text) from public,anon,authenticated,service_role;
create function public.update_nominee_image(p_nominee_id uuid,p_image_path text)
returns void language plpgsql security definer set search_path='' as $$
declare e public.events;
begin
 select ev.* into e from public.events ev join public.categories c on c.event_id=ev.id join public.nominees n on n.category_id=c.id where n.id=p_nominee_id for update of ev;
 if not private.can_manage_org(e.organization_id) then raise exception 'Organization access denied' using errcode='42501'; end if;
 if e.status<>'draft' then raise exception 'Published nominee photos require identity review. Submit a photo correction' using errcode='22023'; end if;
 perform public.update_nominee_image_before_fairness(p_nominee_id,p_image_path);
end $$;
revoke all on function public.update_nominee_image(uuid,text) from public,anon;
grant execute on function public.update_nominee_image(uuid,text) to authenticated;

create function private.can_submit_nominee_image_path(p_path text)
returns boolean language sql stable security definer set search_path='' as $$
 select case when p_path ~* '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$' then exists(
  select 1 from public.nominees n join public.categories c on c.id=n.category_id join public.events e on e.id=c.event_id
  where e.id=split_part(p_path,'/',1)::uuid and n.id=split_part(p_path,'/',2)::uuid and e.status in ('published','paused','closed') and private.can_manage_org(e.organization_id)
 ) else false end;
$$;
create function private.can_submit_event_image_path(p_path text)
returns boolean language sql stable security definer set search_path='' as $$
 select case when p_path ~* '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$' then exists(
  select 1 from public.events e where e.id=split_part(p_path,'/',1)::uuid and e.status in ('published','paused','closed') and private.can_manage_org(e.organization_id)
 ) else false end;
$$;
revoke execute on function private.can_submit_nominee_image_path(text) from public,anon,authenticated;
revoke execute on function private.can_submit_event_image_path(text) from public,anon,authenticated;
grant execute on function private.can_submit_nominee_image_path(text) to authenticated;
grant execute on function private.can_submit_event_image_path(text) to authenticated;
create policy "organizers can upload nominee corrections" on storage.objects for insert to authenticated
 with check(bucket_id='nominee-images' and private.can_submit_nominee_image_path(name));
create policy "organizers can upload event cover corrections" on storage.objects for insert to authenticated
 with check(bucket_id='nominee-images' and private.can_submit_event_image_path(name));

alter function public.update_event_image(uuid,text) rename to update_event_image_before_fairness;
revoke all on function public.update_event_image_before_fairness(uuid,text) from public,anon,authenticated,service_role;
create function public.update_event_image(p_event_id uuid,p_image_path text)
returns void language plpgsql security definer set search_path='' as $$
declare e public.events;
begin
 select * into e from public.events where id=p_event_id for update;
 if not private.can_manage_org(e.organization_id) then raise exception 'Organization access denied' using errcode='42501'; end if;
 if e.status='archived' then raise exception 'Archived events cannot change their cover image' using errcode='22023'; end if;
 if e.status='draft' then perform public.update_event_image_before_fairness(p_event_id,p_image_path); return; end if;
 if p_image_path is not null and not private.can_submit_event_image_path(p_image_path) then raise exception 'Upload a cover image for this event first' using errcode='22023'; end if;
 update public.events set image_path=p_image_path where id=e.id;
 insert into public.event_notices(event_id,kind,message) values(e.id,'correction','The event cover image was updated. Event rules, nominees and recorded votes are unchanged.');
end $$;
revoke all on function public.update_event_image(uuid,text) from public,anon;
grant execute on function public.update_event_image(uuid,text) to authenticated;

create or replace function public.get_public_event_results(p_event_id uuid)
returns table(nominee_id uuid,vote_count bigint) language sql stable security definer set search_path='' as $$
 select n.id,coalesce(sum(case when b.payment_attempt_id is null then b.quantity
  else greatest(0,p.quantity-ceil(coalesce(l.refunded_amount_minor,0)::numeric/p.unit_price_minor)) end),0)::bigint
 from public.events e join public.categories c on c.event_id=e.id and c.is_active
 join public.nominees n on n.category_id=c.id and n.is_active
 left join public.vote_batches b on b.nominee_id=n.id and b.reversed_at is null
 left join public.payment_attempts p on p.id=b.payment_attempt_id
 left join public.paid_vote_ledger l on l.reference=p.provider_reference
 where e.id=p_event_id and (
  (e.results_visibility='live' and e.status in ('published','paused','closed') and now()>=e.starts_at)
  or(e.results_visibility='after_close' and(e.results_released or e.status in ('closed','archived') or now()>=e.ends_at)))
 group by n.id,n.display_order order by n.display_order;
$$;
