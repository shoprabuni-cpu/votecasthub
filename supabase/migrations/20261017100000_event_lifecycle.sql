create function public.update_event_details(p_event_id uuid,p_name text,p_description text,p_starts_at timestamptz,p_ends_at timestamptz,p_results_visibility text,p_voting_rules text)
returns void language plpgsql security definer set search_path='' as $$
declare e public.events;
begin
 select * into e from public.events where id=p_event_id for update;
 if not found then raise exception 'Event not found' using errcode='P0002'; end if;
 if not private.can_manage_org(e.organization_id) then raise exception 'Organization access denied' using errcode='42501'; end if;
 if e.status not in ('published','paused','closed') then raise exception 'Use the draft editor for this event' using errcode='22023'; end if;
 if p_name is null or length(btrim(p_name)) not between 2 and 160 or length(p_description)>5000 or length(p_voting_rules)>3000
 or p_results_visibility is null or p_results_visibility not in ('live','after_close','hidden','organizer_only')
 or p_starts_at is null or p_ends_at is null or p_starts_at>=p_ends_at then raise exception 'Check the event details and dates' using errcode='22023'; end if;
 if e.status='closed' and (p_starts_at<>e.starts_at or p_ends_at<>e.ends_at) then raise exception 'This event was permanently closed. Its dates cannot be changed' using errcode='22023'; end if;
 if p_starts_at<>e.starts_at and (e.starts_at<=now() or p_starts_at<=now()) then raise exception 'The opening time cannot change after voting has started' using errcode='22023'; end if;
 if p_ends_at<>e.ends_at and (p_ends_at<e.ends_at or p_ends_at<=now()) then raise exception 'Choose a later closing time in the future. Use Pause to stop voting temporarily' using errcode='22023'; end if;
 update public.events set name=btrim(p_name),description=nullif(btrim(p_description),''),starts_at=p_starts_at,ends_at=p_ends_at,results_visibility=p_results_visibility,voting_rules=nullif(btrim(p_voting_rules),'') where id=e.id;
 insert into public.audit_logs(organization_id,actor_user_id,action,resource_type,resource_id,metadata)
 values(e.organization_id,auth.uid(),'event_details_updated','event',e.id::text,jsonb_build_object('previous_starts_at',e.starts_at,'starts_at',p_starts_at,'previous_ends_at',e.ends_at,'ends_at',p_ends_at,'previous_name',e.name,'name',p_name));
end $$;
revoke all on function public.update_event_details(uuid,text,text,timestamptz,timestamptz,text,text) from public,anon;
grant execute on function public.update_event_details(uuid,text,text,timestamptz,timestamptz,text,text) to authenticated;

alter function public.set_event_status(uuid,text) rename to set_event_status_before_lifecycle;
revoke all on function public.set_event_status_before_lifecycle(uuid,text) from public,anon,authenticated,service_role;
create function public.set_event_status(p_event_id uuid,p_action text)
returns text language plpgsql security definer set search_path='' as $$
declare e public.events; target text;
begin
 if p_action not in ('unpublish','archive') then return public.set_event_status_before_lifecycle(p_event_id,p_action); end if;
 select * into e from public.events where id=p_event_id for update;
 if not found then raise exception 'Event not found' using errcode='P0002'; end if;
 if not exists(select 1 from public.organization_members where organization_id=e.organization_id and user_id=auth.uid() and role in ('owner','admin')) then raise exception 'Only owners and admins can remove events' using errcode='42501'; end if;
 if p_action='unpublish' then
  if e.status not in ('published','paused','closed') then raise exception 'This event cannot be unpublished' using errcode='22023'; end if;
  if exists(select 1 from public.vote_batches where event_id=e.id) or exists(select 1 from public.payment_attempts where event_id=e.id) then raise exception 'This event has voting or payment activity. Close and archive it instead' using errcode='22023'; end if;
  target:='draft';
 else
  if e.status not in ('draft','closed') then raise exception 'Close the event before archiving it' using errcode='22023'; end if;
  target:='archived';
 end if;
 update public.events set status=target,archived_at=case when target='archived' then now() else null end where id=e.id;
 insert into public.audit_logs(organization_id,actor_user_id,action,resource_type,resource_id,metadata)
 values(e.organization_id,auth.uid(),'event_status_changed','event',e.id::text,jsonb_build_object('from',e.status,'to',target));
 return target;
end $$;
revoke all on function public.set_event_status(uuid,text) from public,anon;
grant execute on function public.set_event_status(uuid,text) to authenticated;

-- Store storage deletions transactionally; retry failures via the reconciliation job.
create table public.event_image_cleanup(path text primary key,created_at timestamptz not null default now());
alter table public.event_image_cleanup enable row level security;
revoke all on public.event_image_cleanup from anon,authenticated;
grant all on public.event_image_cleanup to service_role;
create function public.delete_unused_event(p_event_id uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare e public.events;
begin
 select * into e from public.events where id=p_event_id for update;
 if not found then raise exception 'Event not found' using errcode='P0002'; end if;
 if not exists(select 1 from public.organization_members where organization_id=e.organization_id and user_id=auth.uid() and role in ('owner','admin')) then raise exception 'Only owners and admins can delete events' using errcode='42501'; end if;
 if e.status<>'draft' then raise exception 'Unpublish this unused event before deleting it, or archive it to preserve its history' using errcode='22023'; end if;
 if exists(select 1 from public.payment_attempts where event_id=e.id) or exists(select 1 from public.vote_batches where event_id=e.id)
 or exists(select 1 from public.paid_vote_ledger where event_id=e.id) then raise exception 'Events with votes or payment history cannot be deleted. Archive this event instead' using errcode='22023'; end if;
 insert into public.event_image_cleanup(path)
 select name from storage.objects where bucket_id='nominee-images' and split_part(name,'/',1)=e.id::text on conflict do nothing;
 delete from public.nominees where category_id in (select id from public.categories where event_id=e.id);
 delete from public.categories where event_id=e.id;
 delete from public.events where id=e.id;
 insert into public.audit_logs(organization_id,actor_user_id,action,resource_type,resource_id,metadata)
 values(e.organization_id,auth.uid(),'event_deleted','event',e.id::text,jsonb_build_object('name',e.name));
 return e.organization_id;
end $$;
revoke all on function public.delete_unused_event(uuid) from public,anon;
grant execute on function public.delete_unused_event(uuid) to authenticated;

-- Close the checkout race between reading the event and reserving payment.
create function public.guard_paid_event_window()
returns trigger language plpgsql security definer set search_path='' as $$
declare e public.events;
begin
 select * into e from public.events where id=new.event_id for share;
 if e.status<>'published' or e.starts_at>now() or e.ends_at<=now() or e.voting_mode<>'paid' or e.unit_price_minor<>new.unit_price_minor then
  raise exception 'Voting is no longer open with these details. Refresh the event page' using errcode='22023';
 end if;
 return new;
end $$;
create trigger guard_paid_event_window before insert on public.payment_attempts for each row execute function public.guard_paid_event_window();

-- Allow promotional image updates while preserving voting configuration.
create or replace function private.can_manage_event_image_path(p_path text)
returns boolean language sql stable security definer set search_path = '' as $$
  select case when p_path ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png|webp)$' then exists (
    select 1 from public.events as event
    where event.id = split_part(p_path, '/', 1)::uuid
      and event.status <> 'archived'
      and private.can_manage_org(event.organization_id)
  ) else false end;
$$;
create or replace function public.update_event_image(p_event_id uuid, p_image_path text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_organization_id uuid;
  v_status text;
begin
  select event.organization_id, event.status
    into v_organization_id, v_status
  from public.events as event
  where event.id = p_event_id
  for update;
  if not found then raise exception 'Event not found' using errcode = 'P0002'; end if;
  if not private.can_manage_org(v_organization_id) then raise exception 'Organization access denied' using errcode = '42501'; end if;
  if v_status = 'archived' then raise exception 'Archived events cannot change images' using errcode = '22023'; end if;
  if p_image_path is not null and (split_part(p_image_path, '/', 1) <> p_event_id::text or not private.can_manage_event_image_path(p_image_path)) then
    raise exception 'Image path does not belong to this draft event' using errcode = '22023';
  end if;

  update public.events set image_path = p_image_path where id = p_event_id;
  insert into public.audit_logs (organization_id, actor_user_id, action, resource_type, resource_id, metadata)
  values (v_organization_id, (select auth.uid()), 'event_image_updated', 'event', p_event_id::text,
    jsonb_build_object('has_image', p_image_path is not null));
end;
$$;
create or replace function private.can_manage_nominee_image_path(p_path text)
returns boolean language sql stable security definer set search_path = '' as $$
  select case when p_path ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png|webp)$' then exists (
    select 1
    from public.nominees as nominee
    join public.categories as category on category.id = nominee.category_id
    join public.events as event on event.id = category.event_id
    where event.id = split_part(p_path, '/', 1)::uuid
      and nominee.id = split_part(p_path, '/', 2)::uuid
      and event.status <> 'archived'
      and private.can_manage_org(event.organization_id)
  ) else false end;
$$;
create or replace function public.update_nominee_image(p_nominee_id uuid, p_image_path text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_organization_id uuid;
  v_event_id uuid;
  v_status text;
begin
  select event.organization_id, event.id, event.status
    into v_organization_id, v_event_id, v_status
  from public.nominees as nominee
  join public.categories as category on category.id = nominee.category_id
  join public.events as event on event.id = category.event_id
  where nominee.id = p_nominee_id
  for update of event;
  if not found then raise exception 'Nominee not found' using errcode = 'P0002'; end if;
  if not private.can_manage_org(v_organization_id) then raise exception 'Organization access denied' using errcode = '42501'; end if;
  if v_status = 'archived' then raise exception 'Archived events cannot change images' using errcode = '22023'; end if;
  if p_image_path is not null and not private.can_manage_nominee_image_path(p_image_path) then
    raise exception 'Image path does not belong to this draft nominee' using errcode = '22023';
  end if;

  update public.nominees set image_path = p_image_path where id = p_nominee_id;
  insert into public.audit_logs (organization_id, actor_user_id, action, resource_type, resource_id, metadata)
  values (v_organization_id, (select auth.uid()), 'nominee_image_updated', 'nominee', p_nominee_id::text,
    jsonb_build_object('event_id', v_event_id, 'has_image', p_image_path is not null));
end;
$$;
