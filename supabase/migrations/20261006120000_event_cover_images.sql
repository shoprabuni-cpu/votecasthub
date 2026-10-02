alter table public.events
  add column image_path text check (image_path is null or char_length(image_path) <= 512);

grant select (image_path) on public.events to anon, authenticated;

create function private.can_manage_event_image_path(p_path text)
returns boolean language sql stable security definer set search_path = '' as $$
  select case when p_path ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png|webp)$' then exists (
    select 1 from public.events as event
    where event.id = split_part(p_path, '/', 1)::uuid
      and event.status = 'draft'
      and private.can_manage_org(event.organization_id)
  ) else false end;
$$;

create function private.can_view_event_image_path(p_path text)
returns boolean language sql stable security definer set search_path = '' as $$
  select case when p_path ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png|webp)$' then exists (
    select 1 from public.events as event
    where event.id = split_part(p_path, '/', 1)::uuid
      and event.status in ('published', 'paused', 'closed')
  ) else false end;
$$;

revoke execute on function private.can_manage_event_image_path(text) from public, anon, authenticated;
revoke execute on function private.can_view_event_image_path(text) from public, anon, authenticated;
grant execute on function private.can_manage_event_image_path(text) to authenticated;
grant execute on function private.can_view_event_image_path(text) to anon, authenticated;

create policy "public can read published event images" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'nominee-images' and private.can_view_event_image_path(name));
create policy "organizers can read draft event images" on storage.objects
  for select to authenticated
  using (bucket_id = 'nominee-images' and private.can_manage_event_image_path(name));
create policy "organizers can upload draft event images" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'nominee-images' and private.can_manage_event_image_path(name));
create policy "organizers can remove draft event images" on storage.objects
  for delete to authenticated
  using (bucket_id = 'nominee-images' and private.can_manage_event_image_path(name));

create function public.update_event_image(p_event_id uuid, p_image_path text)
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
  if v_status <> 'draft' then raise exception 'Only draft events can change images' using errcode = '22023'; end if;
  if p_image_path is not null and (split_part(p_image_path, '/', 1) <> p_event_id::text or not private.can_manage_event_image_path(p_image_path)) then
    raise exception 'Image path does not belong to this draft event' using errcode = '22023';
  end if;

  update public.events set image_path = p_image_path where id = p_event_id;
  insert into public.audit_logs (organization_id, actor_user_id, action, resource_type, resource_id, metadata)
  values (v_organization_id, (select auth.uid()), 'event_image_updated', 'event', p_event_id::text,
    jsonb_build_object('has_image', p_image_path is not null));
end;
$$;
revoke execute on function public.update_event_image(uuid, text) from public, anon, authenticated;
grant execute on function public.update_event_image(uuid, text) to authenticated;

drop function public.get_organization_events(uuid);
create function public.get_organization_events(p_organization_id uuid)
returns table (
  id uuid,
  organization_id uuid,
  name text,
  slug text,
  description text,
  currency text,
  unit_price_minor bigint,
  starts_at timestamptz,
  ends_at timestamptz,
  status text,
  results_visibility text,
  created_at timestamptz,
  updated_at timestamptz,
  voting_mode text,
  free_vote_limit_per_phone smallint,
  voting_rules text,
  image_path text
)
language sql stable security definer set search_path = '' as $$
  select event.id, event.organization_id, event.name, event.slug, event.description,
         event.currency, event.unit_price_minor, event.starts_at, event.ends_at,
         event.status, event.results_visibility, event.created_at, event.updated_at,
         event.voting_mode, event.free_vote_limit_per_phone, event.voting_rules, event.image_path
  from public.events as event
  where event.organization_id = p_organization_id
    and private.is_org_member(p_organization_id)
  order by event.created_at desc;
$$;
revoke execute on function public.get_organization_events(uuid) from public, anon, authenticated;
grant execute on function public.get_organization_events(uuid) to authenticated;
