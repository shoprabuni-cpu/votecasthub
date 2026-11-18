-- Migration: Fix Event Ticketing Differentiation and RPC Support
-- Ensures ticketing events are cleanly distinguished from voting contests,
-- provides an authorized RPC function to persist event_type and venue details,
-- and updates get_organization_events to return event_type and venue columns.

-- 1. Security Definer RPC function to update event_type and venue details
create or replace function public.set_event_ticketing_details(
  p_event_id uuid,
  p_event_type text,
  p_venue_name text default null,
  p_venue_address text default null,
  p_doors_open_time text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org_id uuid;
begin
  select organization_id into v_org_id from public.events where id = p_event_id;
  if not found then
    raise exception 'Event not found' using errcode = 'P0002';
  end if;

  if not private.can_manage_org(v_org_id) then
    raise exception 'Only organization managers can update event ticketing details' using errcode = '42501';
  end if;

  if p_event_type not in ('voting', 'ticketing', 'hybrid') then
    raise exception 'Invalid event type. Must be voting, ticketing, or hybrid' using errcode = '22023';
  end if;

  update public.events
  set event_type = p_event_type,
      venue_name = p_venue_name,
      venue_address = p_venue_address,
      doors_open_time = p_doors_open_time,
      updated_at = now()
  where id = p_event_id;
end;
$$;

revoke all on function public.set_event_ticketing_details(uuid, text, text, text, text) from public, anon;
grant execute on function public.set_event_ticketing_details(uuid, text, text, text, text) to authenticated;

-- 2. Drop and recreate get_organization_events with event_type, venue_name, venue_address, doors_open_time
drop function if exists public.get_organization_events(uuid);

create or replace function public.get_organization_events(p_organization_id uuid)
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
  image_path text,
  voting_rule text,
  event_type text,
  venue_name text,
  venue_address text,
  doors_open_time text
)
language sql stable security definer set search_path = '' as $$
  select event.id, event.organization_id, event.name, event.slug, event.description,
         event.currency, event.unit_price_minor, event.starts_at, event.ends_at,
         event.status, event.results_visibility, event.created_at, event.updated_at,
         event.voting_mode, event.free_vote_limit_per_phone, event.voting_rules,
         event.image_path, event.voting_rule, event.event_type, event.venue_name,
         event.venue_address, event.doors_open_time
  from public.events as event
  where event.organization_id = p_organization_id and event.purged_at is null
    and private.is_org_member(p_organization_id)
  order by event.created_at desc;
$$;

revoke all on function public.get_organization_events(uuid) from public, anon;
grant execute on function public.get_organization_events(uuid) to authenticated;

-- 3. Retroactively set event_type = 'ticketing' for events that have ticket tiers and no categories
update public.events e
set event_type = 'ticketing'
where e.event_type = 'voting'
  and exists (select 1 from public.event_ticket_tiers t where t.event_id = e.id)
  and not exists (select 1 from public.categories c where c.event_id = e.id);

-- 4. Retroactively set event_type = 'hybrid' for events that have both ticket tiers and categories
update public.events e
set event_type = 'hybrid'
where e.event_type = 'voting'
  and exists (select 1 from public.event_ticket_tiers t where t.event_id = e.id)
  and exists (select 1 from public.categories c where c.event_id = e.id);
