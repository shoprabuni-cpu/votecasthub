-- Make event voting mode and organizer-defined rules explicit.
-- Free events use verified-phone limits once the voter verification flow is enabled.

alter table public.events
  drop constraint events_unit_price_minor_check,
  add column voting_mode text not null default 'paid' check (voting_mode in ('free', 'paid')),
  add column free_vote_limit_per_phone smallint,
  add column voting_rules text check (voting_rules is null or char_length(voting_rules) <= 3000),
  add constraint events_voting_price_policy_check check (
    (voting_mode = 'paid' and unit_price_minor between 1 and 1000000000000 and free_vote_limit_per_phone is null)
    or (voting_mode = 'free' and unit_price_minor = 0 and free_vote_limit_per_phone between 1 and 100)
  );

-- The public organizer RPC is replaced because its returned row shape now includes
-- the event's voting policy. Keep the same membership check and authenticated grant.
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
  voting_rules text
)
language sql stable security definer set search_path = '' as $$
  select event.id, event.organization_id, event.name, event.slug, event.description,
         event.currency, event.unit_price_minor, event.starts_at, event.ends_at,
         event.status, event.results_visibility, event.created_at, event.updated_at,
         event.voting_mode, event.free_vote_limit_per_phone, event.voting_rules
  from public.events as event
  where event.organization_id = p_organization_id
    and private.is_org_member(p_organization_id)
  order by event.created_at desc;
$$;
revoke execute on function public.get_organization_events(uuid) from public, anon, authenticated;
grant execute on function public.get_organization_events(uuid) to authenticated;

drop function public.create_event(uuid, text, text, text, bigint, timestamptz, timestamptz, text);
create function public.create_event(
  p_organization_id uuid,
  p_name text,
  p_slug text,
  p_description text,
  p_unit_price_minor bigint,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_results_visibility text,
  p_voting_mode text,
  p_free_vote_limit_per_phone smallint,
  p_voting_rules text
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
  if coalesce(p_voting_mode, '') = 'paid' then
    if p_unit_price_minor is null or p_unit_price_minor < 1 or p_unit_price_minor > 1000000000000 or p_free_vote_limit_per_phone is not null then
      raise exception 'Paid voting requires a positive vote price and no free-vote limit' using errcode = '22023';
    end if;
  elsif coalesce(p_voting_mode, '') = 'free' then
    if p_unit_price_minor is distinct from 0 or p_free_vote_limit_per_phone is null or p_free_vote_limit_per_phone not between 1 and 100 then
      raise exception 'Free voting requires a zero price and a verified-phone vote limit from 1 to 100' using errcode = '22023';
    end if;
  else
    raise exception 'Voting mode is invalid' using errcode = '22023';
  end if;
  if char_length(coalesce(p_voting_rules, '')) > 3000 then raise exception 'Voting rules are too long' using errcode = '22023'; end if;
  if p_starts_at is null or p_ends_at is null or p_starts_at >= p_ends_at then raise exception 'Voting dates are invalid' using errcode = '22023'; end if;
  if coalesce(p_results_visibility, '') not in ('organizer_only', 'live', 'after_close', 'hidden') then raise exception 'Results setting is invalid' using errcode = '22023'; end if;

  insert into public.events (
    organization_id, name, slug, description, currency, unit_price_minor,
    starts_at, ends_at, results_visibility, voting_mode,
    free_vote_limit_per_phone, voting_rules, created_by
  ) values (
    p_organization_id, v_name, lower(p_slug), nullif(btrim(coalesce(p_description, '')), ''), 'GHS',
    p_unit_price_minor, p_starts_at, p_ends_at, p_results_visibility, p_voting_mode,
    p_free_vote_limit_per_phone, nullif(btrim(coalesce(p_voting_rules, '')), ''), v_user_id
  ) returning id into v_event_id;

  insert into public.audit_logs (organization_id, actor_user_id, action, resource_type, resource_id, metadata)
  values (p_organization_id, v_user_id, 'event_draft_created', 'event', v_event_id::text,
          jsonb_build_object('status', 'draft', 'voting_mode', p_voting_mode));
  return v_event_id;
end;
$$;
revoke execute on function public.create_event(uuid, text, text, text, bigint, timestamptz, timestamptz, text, text, smallint, text) from public, anon, authenticated;
grant execute on function public.create_event(uuid, text, text, text, bigint, timestamptz, timestamptz, text, text, smallint, text) to authenticated;

drop function public.update_event_draft(uuid, text, text, bigint, timestamptz, timestamptz, text);
create function public.update_event_draft(
  p_event_id uuid,
  p_name text,
  p_description text,
  p_unit_price_minor bigint,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_results_visibility text,
  p_voting_mode text,
  p_free_vote_limit_per_phone smallint,
  p_voting_rules text
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
  if coalesce(p_voting_mode, '') = 'paid' then
    if p_unit_price_minor is null or p_unit_price_minor < 1 or p_unit_price_minor > 1000000000000 or p_free_vote_limit_per_phone is not null then
      raise exception 'Paid voting requires a positive vote price and no free-vote limit' using errcode = '22023';
    end if;
  elsif coalesce(p_voting_mode, '') = 'free' then
    if p_unit_price_minor is distinct from 0 or p_free_vote_limit_per_phone is null or p_free_vote_limit_per_phone not between 1 and 100 then
      raise exception 'Free voting requires a zero price and a verified-phone vote limit from 1 to 100' using errcode = '22023';
    end if;
  else
    raise exception 'Voting mode is invalid' using errcode = '22023';
  end if;
  if char_length(coalesce(p_voting_rules, '')) > 3000 then raise exception 'Voting rules are too long' using errcode = '22023'; end if;
  if p_starts_at is null or p_ends_at is null or p_starts_at >= p_ends_at then raise exception 'Voting dates are invalid' using errcode = '22023'; end if;
  if coalesce(p_results_visibility, '') not in ('organizer_only', 'live', 'after_close', 'hidden') then raise exception 'Results setting is invalid' using errcode = '22023'; end if;

  update public.events set
    name = v_name,
    description = nullif(btrim(coalesce(p_description, '')), ''),
    unit_price_minor = p_unit_price_minor,
    starts_at = p_starts_at,
    ends_at = p_ends_at,
    results_visibility = p_results_visibility,
    voting_mode = p_voting_mode,
    free_vote_limit_per_phone = p_free_vote_limit_per_phone,
    voting_rules = nullif(btrim(coalesce(p_voting_rules, '')), '')
  where id = p_event_id;
  insert into public.audit_logs (organization_id, actor_user_id, action, resource_type, resource_id, metadata)
  values (v_event.organization_id, (select auth.uid()), 'event_draft_updated', 'event', p_event_id::text,
          jsonb_build_object('status', 'draft', 'voting_mode', p_voting_mode));
end;
$$;
revoke execute on function public.update_event_draft(uuid, text, text, bigint, timestamptz, timestamptz, text, text, smallint, text) from public, anon, authenticated;
grant execute on function public.update_event_draft(uuid, text, text, bigint, timestamptz, timestamptz, text, text, smallint, text) to authenticated;

grant select (voting_mode, free_vote_limit_per_phone, voting_rules) on public.events to anon, authenticated;

create function public.update_event_category(
  p_category_id uuid,
  p_name text,
  p_description text,
  p_display_order integer,
  p_is_active boolean
)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_event_id uuid;
  v_organization_id uuid;
  v_status text;
  v_name text := btrim(coalesce(p_name, ''));
begin
  select event.id, event.organization_id, event.status
    into v_event_id, v_organization_id, v_status
  from public.categories as category
  join public.events as event on event.id = category.event_id
  where category.id = p_category_id
  for update of event;
  if not found then raise exception 'Category not found' using errcode = 'P0002'; end if;
  if not private.can_manage_org(v_organization_id) then raise exception 'Organization access denied' using errcode = '42501'; end if;
  if v_status <> 'draft' then raise exception 'Only draft event categories can be edited' using errcode = '22023'; end if;
  if char_length(v_name) < 1 or char_length(v_name) > 120 then raise exception 'Category name is invalid' using errcode = '22023'; end if;
  if char_length(coalesce(p_description, '')) > 2000 then raise exception 'Category description is too long' using errcode = '22023'; end if;
  if p_display_order is null or p_display_order not between 0 and 10000 or p_is_active is null then raise exception 'Category settings are invalid' using errcode = '22023'; end if;

  update public.categories set name = v_name, description = nullif(btrim(coalesce(p_description, '')), ''),
    display_order = p_display_order, is_active = p_is_active where id = p_category_id;
  insert into public.audit_logs (organization_id, actor_user_id, action, resource_type, resource_id, metadata)
  values (v_organization_id, (select auth.uid()), 'event_category_updated', 'category', p_category_id::text,
    jsonb_build_object('event_id', v_event_id, 'active', p_is_active, 'display_order', p_display_order));
end;
$$;
revoke execute on function public.update_event_category(uuid, text, text, integer, boolean) from public, anon, authenticated;
grant execute on function public.update_event_category(uuid, text, text, integer, boolean) to authenticated;

create function public.update_category_nominee(
  p_nominee_id uuid,
  p_name text,
  p_public_code text,
  p_biography text,
  p_display_order integer,
  p_is_active boolean
)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_category_id uuid;
  v_event_id uuid;
  v_organization_id uuid;
  v_status text;
  v_name text := btrim(coalesce(p_name, ''));
  v_code text := nullif(btrim(coalesce(p_public_code, '')), '');
begin
  select category.id, event.id, event.organization_id, event.status
    into v_category_id, v_event_id, v_organization_id, v_status
  from public.nominees as nominee
  join public.categories as category on category.id = nominee.category_id
  join public.events as event on event.id = category.event_id
  where nominee.id = p_nominee_id
  for update of event;
  if not found then raise exception 'Nominee not found' using errcode = 'P0002'; end if;
  if not private.can_manage_org(v_organization_id) then raise exception 'Organization access denied' using errcode = '42501'; end if;
  if v_status <> 'draft' then raise exception 'Only draft event nominees can be edited' using errcode = '22023'; end if;
  if char_length(v_name) < 1 or char_length(v_name) > 160 then raise exception 'Nominee name is invalid' using errcode = '22023'; end if;
  if v_code is not null and (char_length(v_code) > 32 or v_code !~ '^[A-Za-z0-9-]+$') then raise exception 'Nominee code is invalid' using errcode = '22023'; end if;
  if char_length(coalesce(p_biography, '')) > 3000 then raise exception 'Nominee biography is too long' using errcode = '22023'; end if;
  if p_display_order is null or p_display_order not between 0 and 10000 or p_is_active is null then raise exception 'Nominee settings are invalid' using errcode = '22023'; end if;

  update public.nominees set name = v_name, public_code = v_code,
    biography = nullif(btrim(coalesce(p_biography, '')), ''), display_order = p_display_order,
    is_active = p_is_active where id = p_nominee_id;
  insert into public.audit_logs (organization_id, actor_user_id, action, resource_type, resource_id, metadata)
  values (v_organization_id, (select auth.uid()), 'category_nominee_updated', 'nominee', p_nominee_id::text,
    jsonb_build_object('category_id', v_category_id, 'event_id', v_event_id, 'active', p_is_active, 'display_order', p_display_order));
end;
$$;
revoke execute on function public.update_category_nominee(uuid, text, text, text, integer, boolean) from public, anon, authenticated;
grant execute on function public.update_category_nominee(uuid, text, text, text, integer, boolean) to authenticated;
