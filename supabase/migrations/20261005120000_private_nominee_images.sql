insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('nominee-images', 'nominee-images', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create function private.can_manage_nominee_image_path(p_path text)
returns boolean language sql stable security definer set search_path = '' as $$
  select case when p_path ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png|webp)$' then exists (
    select 1
    from public.nominees as nominee
    join public.categories as category on category.id = nominee.category_id
    join public.events as event on event.id = category.event_id
    where event.id = split_part(p_path, '/', 1)::uuid
      and nominee.id = split_part(p_path, '/', 2)::uuid
      and event.status = 'draft'
      and private.can_manage_org(event.organization_id)
  ) else false end;
$$;

create function private.can_view_nominee_image_path(p_path text)
returns boolean language sql stable security definer set search_path = '' as $$
  select case when p_path ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|webp|png)$' then exists (
    select 1
    from public.nominees as nominee
    join public.categories as category on category.id = nominee.category_id
    join public.events as event on event.id = category.event_id
    where event.id = split_part(p_path, '/', 1)::uuid
      and nominee.id = split_part(p_path, '/', 2)::uuid
      and nominee.is_active and category.is_active
      and event.status in ('published', 'paused', 'closed')
  ) else false end;
$$;
revoke execute on function private.can_manage_nominee_image_path(text) from public, anon, authenticated;
revoke execute on function private.can_view_nominee_image_path(text) from public, anon, authenticated;
grant execute on function private.can_manage_nominee_image_path(text) to authenticated;
grant execute on function private.can_view_nominee_image_path(text) to anon, authenticated;

create policy "public can read published nominee images" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'nominee-images' and private.can_view_nominee_image_path(name));
create policy "organizers can read draft nominee images" on storage.objects
  for select to authenticated
  using (bucket_id = 'nominee-images' and private.can_manage_nominee_image_path(name));
create policy "organizers can upload draft nominee images" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'nominee-images' and private.can_manage_nominee_image_path(name));
create policy "organizers can remove draft nominee images" on storage.objects
  for delete to authenticated
  using (bucket_id = 'nominee-images' and private.can_manage_nominee_image_path(name));

create function public.update_nominee_image(p_nominee_id uuid, p_image_path text)
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
  if v_status <> 'draft' then raise exception 'Only draft nominees can change images' using errcode = '22023'; end if;
  if p_image_path is not null and not private.can_manage_nominee_image_path(p_image_path) then
    raise exception 'Image path does not belong to this draft nominee' using errcode = '22023';
  end if;

  update public.nominees set image_path = p_image_path where id = p_nominee_id;
  insert into public.audit_logs (organization_id, actor_user_id, action, resource_type, resource_id, metadata)
  values (v_organization_id, (select auth.uid()), 'nominee_image_updated', 'nominee', p_nominee_id::text,
    jsonb_build_object('event_id', v_event_id, 'has_image', p_image_path is not null));
end;
$$;
revoke execute on function public.update_nominee_image(uuid, text) from public, anon, authenticated;
grant execute on function public.update_nominee_image(uuid, text) to authenticated;
