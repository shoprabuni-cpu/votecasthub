-- Event setup and lifecycle writes are validated in PostgreSQL.
-- No direct table writes are granted to browser clients.

create or replace function private.can_manage_org(p_organization_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.organization_members as member
    where member.organization_id = p_organization_id
      and member.user_id = (select auth.uid())
      and member.role in ('owner', 'admin', 'editor')
  );
$$;
revoke execute on function private.can_manage_org(uuid) from public, anon, authenticated;

create or replace function public.create_event(
  p_organization_id uuid,
  p_name text,
  p_slug text,
  p_description text,
  p_unit_price_minor bigint,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_results_visibility text
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_user_id uuid := (select auth.uid());
  v_name text := btrim(coalesce(p_name, ''));
  v_event_id uuid;
begin
  if v_user_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if not private.can_manage_org(p_organization_id) then raise exception 'Organization access denied' using errcode = '42501'; end if;
  if char_length(v_name) < 2 or char_length(v_name) > 160 then raise exception 'Event name is invalid' using errcode = '22023'; end if;
  if coalesce(p_slug, '') !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or char_length(p_slug) > 100 then raise exception 'Event slug is invalid' using errcode = '22023'; end if;
  if p_unit_price_minor is null or p_unit_price_minor < 1 or p_unit_price_minor > 1000000000000 then raise exception 'Vote price is invalid' using errcode = '22023'; end if;
  if p_starts_at is null or p_ends_at is null or p_starts_at >= p_ends_at then raise exception 'Voting dates are invalid' using errcode = '22023'; end if;
  if coalesce(p_results_visibility, '') not in ('organizer_only', 'live', 'after_close', 'hidden') then raise exception 'Results setting is invalid' using errcode = '22023'; end if;

  insert into public.events (organization_id, name, slug, description, currency, unit_price_minor, starts_at, ends_at, results_visibility, created_by)
  values (p_organization_id, v_name, lower(p_slug), nullif(btrim(coalesce(p_description, '')), ''), 'GHS', p_unit_price_minor, p_starts_at, p_ends_at, p_results_visibility, v_user_id)
  returning id into v_event_id;
  insert into public.audit_logs (organization_id, actor_user_id, action, resource_type, resource_id, metadata)
  values (p_organization_id, v_user_id, 'event_draft_created', 'event', v_event_id::text, jsonb_build_object('status', 'draft'));
  return v_event_id;
end;
$$;

create or replace function public.update_event_draft(
  p_event_id uuid,
  p_name text,
  p_description text,
  p_unit_price_minor bigint,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_results_visibility text
)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_event public.events%rowtype;
  v_name text := btrim(coalesce(p_name, ''));
begin
  select * into v_event from public.events where id = p_event_id for update;
  if not found then raise exception 'Event not found' using errcode = 'P0002'; end if;
  if not private.can_manage_org(v_event.organization_id) then raise exception 'Organization access denied' using errcode = '42501'; end if;
  if v_event.status <> 'draft' then raise exception 'Only draft events can be edited' using errcode = '22023'; end if;
  if char_length(v_name) < 2 or char_length(v_name) > 160 then raise exception 'Event name is invalid' using errcode = '22023'; end if;
  if p_unit_price_minor is null or p_unit_price_minor < 1 or p_unit_price_minor > 1000000000000 then raise exception 'Vote price is invalid' using errcode = '22023'; end if;
  if p_starts_at is null or p_ends_at is null or p_starts_at >= p_ends_at then raise exception 'Voting dates are invalid' using errcode = '22023'; end if;
  if coalesce(p_results_visibility, '') not in ('organizer_only', 'live', 'after_close', 'hidden') then raise exception 'Results setting is invalid' using errcode = '22023'; end if;

  update public.events set
    name = v_name,
    description = nullif(btrim(coalesce(p_description, '')), ''),
    unit_price_minor = p_unit_price_minor,
    starts_at = p_starts_at,
    ends_at = p_ends_at,
    results_visibility = p_results_visibility
  where id = p_event_id;
  insert into public.audit_logs (organization_id, actor_user_id, action, resource_type, resource_id, metadata)
  values (v_event.organization_id, (select auth.uid()), 'event_draft_updated', 'event', p_event_id::text, jsonb_build_object('status', 'draft'));
end;
$$;

create or replace function public.add_event_category(
  p_event_id uuid,
  p_name text,
  p_description text,
  p_display_order integer
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_category_id uuid;
  v_name text := btrim(coalesce(p_name, ''));
  v_organization_id uuid;
begin
  select organization_id into v_organization_id from public.events where id = p_event_id and status = 'draft' for update;
  if not found then raise exception 'Draft event not found' using errcode = 'P0002'; end if;
  if not private.can_manage_org(v_organization_id) then raise exception 'Organization access denied' using errcode = '42501'; end if;
  if char_length(v_name) < 1 or char_length(v_name) > 120 then raise exception 'Category name is invalid' using errcode = '22023'; end if;
  if char_length(coalesce(p_description, '')) > 2000 or coalesce(p_display_order, 0) < 0 then raise exception 'Category details are invalid' using errcode = '22023'; end if;

  insert into public.categories (event_id, name, description, display_order)
  values (p_event_id, v_name, nullif(btrim(coalesce(p_description, '')), ''), coalesce(p_display_order, (select coalesce(max(display_order) + 1, 0) from public.categories where event_id = p_event_id)))
  returning id into v_category_id;
  insert into public.audit_logs (organization_id, actor_user_id, action, resource_type, resource_id, metadata)
  values (v_organization_id, (select auth.uid()), 'event_category_added', 'category', v_category_id::text, jsonb_build_object('event_id', p_event_id));
  return v_category_id;
end;
$$;

create or replace function public.add_category_nominee(
  p_category_id uuid,
  p_name text,
  p_public_code text,
  p_biography text,
  p_display_order integer
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_nominee_id uuid;
  v_name text := btrim(coalesce(p_name, ''));
  v_event_id uuid;
  v_organization_id uuid;
begin
  select category.event_id, event.organization_id into v_event_id, v_organization_id
  from public.categories as category
  join public.events as event on event.id = category.event_id
  where category.id = p_category_id and event.status = 'draft'
  for update of event;
  if not found then raise exception 'Draft category not found' using errcode = 'P0002'; end if;
  if not private.can_manage_org(v_organization_id) then raise exception 'Organization access denied' using errcode = '42501'; end if;
  if char_length(v_name) < 1 or char_length(v_name) > 160 then raise exception 'Nominee name is invalid' using errcode = '22023'; end if;
  if char_length(coalesce(p_biography, '')) > 3000 or coalesce(p_display_order, 0) < 0 then raise exception 'Nominee details are invalid' using errcode = '22023'; end if;

  insert into public.nominees (category_id, name, public_code, biography, display_order)
  values (p_category_id, v_name, nullif(btrim(coalesce(p_public_code, '')), ''), nullif(btrim(coalesce(p_biography, '')), ''), coalesce(p_display_order, (select coalesce(max(display_order) + 1, 0) from public.nominees where category_id = p_category_id)))
  returning id into v_nominee_id;
  insert into public.audit_logs (organization_id, actor_user_id, action, resource_type, resource_id, metadata)
  values (v_organization_id, (select auth.uid()), 'category_nominee_added', 'nominee', v_nominee_id::text, jsonb_build_object('category_id', p_category_id, 'event_id', v_event_id));
  return v_nominee_id;
end;
$$;

create or replace function public.set_event_status(p_event_id uuid, p_action text)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_event public.events%rowtype;
  v_new_status text;
begin
  select * into v_event from public.events where id = p_event_id for update;
  if not found then raise exception 'Event not found' using errcode = 'P0002'; end if;
  if not private.can_manage_org(v_event.organization_id) then raise exception 'Organization access denied' using errcode = '42501'; end if;

  if p_action = 'publish' and v_event.status = 'draft' then
    if v_event.ends_at <= now() then raise exception 'Voting period must end in the future before publication' using errcode = '22023'; end if;
    if not exists (select 1 from public.categories as category where category.event_id = p_event_id and category.is_active) then
      raise exception 'Add an active category before publishing' using errcode = '22023';
    end if;
    if exists (
      select 1 from public.categories as category
      where category.event_id = p_event_id and category.is_active
        and not exists (select 1 from public.nominees as nominee where nominee.category_id = category.id and nominee.is_active)
    ) then raise exception 'Every active category needs an active nominee' using errcode = '22023'; end if;
    v_new_status := 'published';
  elsif p_action = 'pause' and v_event.status = 'published' then
    v_new_status := 'paused';
  elsif p_action = 'resume' and v_event.status = 'paused' and v_event.ends_at > now() then
    v_new_status := 'published';
  elsif p_action = 'close' and v_event.status in ('published', 'paused') then
    v_new_status := 'closed';
  elsif p_action = 'archive' and v_event.status in ('draft', 'closed') then
    if exists (select 1 from public.payment_attempts as payment where payment.event_id = p_event_id) then
      raise exception 'Events with payment history cannot be archived' using errcode = '22023';
    end if;
    v_new_status := 'archived';
  else
    raise exception 'This event status change is not allowed' using errcode = '22023';
  end if;

  update public.events set status = v_new_status, archived_at = case when v_new_status = 'archived' then now() else null end where id = p_event_id;
  insert into public.audit_logs (organization_id, actor_user_id, action, resource_type, resource_id, metadata)
  values (v_event.organization_id, (select auth.uid()), 'event_status_changed', 'event', p_event_id::text, jsonb_build_object('from', v_event.status, 'to', v_new_status));
  return v_new_status;
end;
$$;

revoke execute on function public.create_event(uuid, text, text, text, bigint, timestamptz, timestamptz, text) from public, anon, authenticated;
revoke execute on function public.update_event_draft(uuid, text, text, bigint, timestamptz, timestamptz, text) from public, anon, authenticated;
revoke execute on function public.add_event_category(uuid, text, text, integer) from public, anon, authenticated;
revoke execute on function public.add_category_nominee(uuid, text, text, text, integer) from public, anon, authenticated;
revoke execute on function public.set_event_status(uuid, text) from public, anon, authenticated;
grant execute on function public.create_event(uuid, text, text, text, bigint, timestamptz, timestamptz, text) to authenticated;
grant execute on function public.update_event_draft(uuid, text, text, bigint, timestamptz, timestamptz, text) to authenticated;
grant execute on function public.add_event_category(uuid, text, text, integer) to authenticated;
grant execute on function public.add_category_nominee(uuid, text, text, text, integer) to authenticated;
grant execute on function public.set_event_status(uuid, text) to authenticated;
