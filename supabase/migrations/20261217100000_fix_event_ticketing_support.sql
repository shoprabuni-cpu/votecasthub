-- Migration: Fix Event Ticketing Differentiation and RPC Support
-- Ensures ticketing events are cleanly distinguished from voting contests,
-- provides an authorized RPC function to persist event_type and venue details,
-- grants necessary execution rights to manage ticket tiers without 42501 errors,
-- allows ticketing events to be published without requiring voting categories,
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

-- 3. Explicitly update your ticketed event
update public.events
set event_type = 'ticketing'
where id = 'cd94c92d-84d5-4dae-8168-b4abe726503f';

-- 4. Retroactively set event_type = 'ticketing' for events that have ticket tiers and no categories
update public.events e
set event_type = 'ticketing'
where e.event_type = 'voting'
  and exists (select 1 from public.event_ticket_tiers t where t.event_id = e.id)
  and not exists (select 1 from public.categories c where c.event_id = e.id);

-- 5. Retroactively set event_type = 'hybrid' for events that have both ticket tiers and categories
update public.events e
set event_type = 'hybrid'
where e.event_type = 'voting'
  and exists (select 1 from public.event_ticket_tiers t where t.event_id = e.id)
  and exists (select 1 from public.categories c where c.event_id = e.id);

-- 6. Fix execute permission on private.can_manage_org and private.can_manage_event
grant execute on function private.can_manage_org(uuid) to authenticated;

create or replace function private.can_manage_event(p_event_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(
    select 1 from public.events e
    where e.id = p_event_id and private.can_manage_org(e.organization_id)
  );
$$;
grant execute on function private.can_manage_event(uuid) to authenticated;

-- 7. Update RLS policies on event_ticket_tiers and event_tickets
drop policy if exists "organizers_manage_ticket_tiers" on public.event_ticket_tiers;
create policy "organizers_manage_ticket_tiers" on public.event_ticket_tiers
  for all to authenticated
  using (private.can_manage_event(event_id))
  with check (private.can_manage_event(event_id));

drop policy if exists "organizers_view_event_tickets" on public.event_tickets;
create policy "organizers_view_event_tickets" on public.event_tickets
  for select to authenticated
  using (private.can_manage_event(event_id));

-- 8. Grant column update privileges and RLS policy for ticketing details on public.events
grant select, update (event_type, venue_name, venue_address, doors_open_time, updated_at) on public.events to authenticated;
grant select (event_type, venue_name, venue_address, doors_open_time) on public.events to anon;

drop policy if exists "organizers_can_update_event_ticketing" on public.events;
create policy "organizers_can_update_event_ticketing"
  on public.events
  for update
  to authenticated
  using (private.can_manage_org(organization_id))
  with check (private.can_manage_org(organization_id));

-- 9. Update enforce_event_verification_readiness trigger to allow ticketing events without categories
create or replace function private.enforce_event_verification_readiness()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.status in ('pending_review','published') and new.status is distinct from old.status then
  if new.starts_at>=new.ends_at or new.ends_at<=now() then
    raise exception 'Choose valid dates that end in the future' using errcode='22023';
  end if;

  -- If this is a ticketing event, require ticket tiers instead of voting categories
  if new.event_type = 'ticketing' or (exists(select 1 from public.event_ticket_tiers where event_id=new.id) and not exists(select 1 from public.categories where event_id=new.id)) then
    if not exists(select 1 from public.event_ticket_tiers where event_id=new.id and is_active) then
      raise exception 'Add at least one active ticket tier before submitting or publishing' using errcode='22023';
    end if;
    return new;
  end if;

  -- Voting competition readiness checks
  if not exists(select 1 from public.categories where event_id=new.id and is_active) then
    raise exception 'Add an active category before submitting or publishing' using errcode='22023';
  end if;
  if exists(select 1 from public.categories c where c.event_id=new.id and c.is_active and not exists(select 1 from public.nominees n where n.category_id=c.id and n.is_active)) then
    raise exception 'Every active category needs an active nominee' using errcode='22023';
  end if;
  if new.voting_mode='paid' and not public.can_publish_paid_event(new.id) then
    raise exception 'Verify the organizer Paystack subaccount before publishing paid voting' using errcode='22023';
  end if;
 end if;

 if new.status in ('pending_review','published') and new.status is distinct from old.status and new.voting_mode='free' and new.event_type <> 'ticketing' then
  if new.verification_method='voter_list' and exists(select 1 from public.event_voter_list_entries where event_id=new.id and identifier_type='phone') and not exists(select 1 from public.organization_sms_credits where organization_id=new.organization_id and balance>0) then
    raise exception 'Add SMS credits so phone roster voters can verify their accounts' using errcode='22023';
  end if;
  if new.verification_method='voter_list' and not exists(select 1 from public.event_voter_list_entries where event_id=new.id and max_votes>used_votes) then
    raise exception 'Import an approved voter list before submitting or publishing this event' using errcode='22023';
  elsif new.verification_method='invite_code' and not exists(select 1 from public.event_access_codes where event_id=new.id and (expires_at is null or expires_at>now()) and (redemption_count<max_redemptions or redemption_count>0)) then
    raise exception 'Create an active access code before submitting or publishing this event' using errcode='22023';
  elsif new.verification_method='phone' and not exists(select 1 from public.organization_sms_credits where organization_id=new.organization_id and balance>0) then
    raise exception 'Add SMS credits before publishing phone-verified voting' using errcode='22023';
  elsif new.verification_method not in ('phone','email','invite_code','voter_list') then
    raise exception 'Select a supported voter verification method' using errcode='22023';
  end if;
 end if;

 return new;
end $$;

-- 10. Update set_event_status_before_lifecycle to allow ticketing events without categories
create or replace function public.set_event_status_before_lifecycle(p_event_id uuid, p_action text)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_event public.events%rowtype;
  v_new_status text;
  v_is_ticket boolean;
begin
  select * into v_event from public.events where id = p_event_id for update;
  if not found then raise exception 'Event not found' using errcode = 'P0002'; end if;
  if not private.can_manage_org(v_event.organization_id) then raise exception 'Organization access denied' using errcode = '42501'; end if;

  v_is_ticket := v_event.event_type = 'ticketing' or (exists(select 1 from public.event_ticket_tiers where event_id=p_event_id) and not exists(select 1 from public.categories where event_id=p_event_id));

  if p_action = 'publish' and v_event.status = 'draft' then
    if v_event.ends_at <= now() then raise exception 'Event schedule must end in the future before publication' using errcode = '22023'; end if;
    
    if v_is_ticket then
      if not exists (select 1 from public.event_ticket_tiers where event_id = p_event_id and is_active) then
        raise exception 'Add at least one active ticket tier before publishing' using errcode = '22023';
      end if;
    else
      if v_event.voting_mode = 'paid' and not public.can_publish_paid_event(p_event_id) then
        raise exception 'Verify the organizer Paystack subaccount before publishing paid voting' using errcode = '22023';
      end if;
      if v_event.voting_mode = 'free' and v_event.verification_method = 'phone' and not exists(select 1 from public.organization_sms_credits where organization_id=v_event.organization_id and balance>0) then
        raise exception 'Add SMS credits before publishing free voting' using errcode='22023';
      end if;
      if v_event.voting_mode = 'free' and v_event.voting_rule = 'one_per_category' and v_event.free_vote_limit_per_phone <> 1 then
        raise exception 'One vote per category must use a limit of one' using errcode = '22023';
      end if;
      if not exists (select 1 from public.categories as category where category.event_id = p_event_id and category.is_active) then
        raise exception 'Add an active category before publishing' using errcode = '22023';
      end if;
      if exists (
        select 1 from public.categories as category
        where category.event_id = p_event_id and category.is_active
          and not exists (select 1 from public.nominees as nominee where nominee.category_id = category.id and nominee.is_active)
      ) then raise exception 'Every active category needs an active nominee' using errcode = '22023'; end if;
    end if;
    v_new_status := 'published';
  elsif p_action = 'pause' and v_event.status = 'published' then
    v_new_status := 'paused';
  elsif p_action = 'resume' and v_event.status = 'paused' and v_event.ends_at > now() then
    if not v_is_ticket and v_event.voting_mode='paid' and not public.can_publish_paid_event(p_event_id) then
      raise exception 'Verify the organizer Paystack subaccount before publishing paid voting' using errcode='22023';
    end if;
    v_new_status := 'published';
  elsif p_action = 'close' and v_event.status in ('published', 'paused') then
    v_new_status := 'closed';
  elsif p_action = 'archive' and v_event.status in ('draft', 'pending_review', 'closed') then
    v_new_status := 'archived';
  else
    raise exception 'Invalid status transition from % with action %', v_event.status, p_action using errcode = '22023';
  end if;

  update public.events set status = v_new_status, updated_at = now() where id = p_event_id;
  return v_new_status;
end $$;

-- 11. Fix event_tickets status constraint & purchase_event_ticket overload collision
alter table public.event_tickets drop constraint if exists event_tickets_status_check;
alter table public.event_tickets add constraint event_tickets_status_check check (status in ('pending', 'valid', 'checked_in', 'cancelled'));

-- Drop old overloads of purchase_event_ticket & generate_pax_code
drop function if exists public.purchase_event_ticket(uuid, uuid, integer, text, text, text, text, text);
drop function if exists public.purchase_event_ticket(uuid, uuid, integer, text, text, text, text, text, text);
drop function if exists public.generate_pax_code();
drop function if exists public.generate_pax_code(text);

-- Recreate generate_pax_code with event title abbreviation support (e.g. "BEST STUDENTS PERSONALITY" -> "BSP-1025")
create or replace function public.generate_pax_code(p_event_name text default null)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_num bigint;
  v_clean text;
  v_words text[];
  v_prefix text := '';
  i int;
begin
  v_num := nextval('public.pax_code_seq');

  if p_event_name is not null and length(trim(p_event_name)) > 0 then
    -- Remove non-alphanumeric characters except spaces
    v_clean := regexp_replace(upper(trim(p_event_name)), '[^A-Z0-9\s]', '', 'g');
    -- Normalize multiple spaces into single space and split into words
    v_words := string_to_array(regexp_replace(v_clean, '\s+', ' ', 'g'), ' ');

    if array_length(v_words, 1) >= 3 then
      -- 3+ words: take first letter of each word up to 4 words (e.g. "BEST STUDENTS PERSONALITY" -> "BSP")
      for i in 1..least(4, array_length(v_words, 1)) loop
        if length(v_words[i]) > 0 then
          v_prefix := v_prefix || substr(v_words[i], 1, 1);
        end if;
      end loop;
    elsif array_length(v_words, 1) = 2 then
      -- 2 words: e.g. "ACCRA GALA" -> "ACG"
      if length(v_words[1]) >= 2 and length(v_words[2]) >= 1 then
        v_prefix := substr(v_words[1], 1, 2) || substr(v_words[2], 1, 1);
      else
        v_prefix := substr(v_words[1], 1, 1) || substr(v_words[2], 1, 1);
      end if;
    elsif array_length(v_words, 1) = 1 then
      -- 1 word: e.g. "AFROCHELLA" -> "AFR"
      v_prefix := substr(v_words[1], 1, 3);
    end if;
  end if;

  -- Fallback if prefix is too short or empty
  if length(v_prefix) < 2 then
    v_prefix := 'PAX';
  end if;

  return v_prefix || '-' || lpad(v_num::text, 4, '0');
end;
$$;

-- Recreate canonical purchase_event_ticket RPC
create or replace function public.purchase_event_ticket(
  p_event_id uuid,
  p_tier_id uuid,
  p_quantity integer,
  p_customer_name text,
  p_customer_phone text,
  p_customer_email text default null,
  p_order_reference text default null,
  p_channel text default 'web',
  p_initial_status text default 'valid'
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_tier record;
  v_event record;
  v_pax_code text;
  v_ticket_id uuid;
  v_order_ref text;
begin
  if p_quantity is null or p_quantity < 1 or p_quantity > 20 then
    raise exception 'Quantity must be between 1 and 20';
  end if;

  -- 1. Check Event status and type (allow published/paused, or draft/pending_review for organizers)
  select * into v_event from public.events
  where id = p_event_id and (
    status in ('published', 'paused')
    or (status in ('draft', 'pending_review') and private.can_manage_event(p_event_id))
  );

  if not found then
    raise exception 'Event not found or not currently active';
  end if;

  -- 2. Check and lock Tier capacity atomically
  select * into v_tier from public.event_ticket_tiers
  where id = p_tier_id and event_id = p_event_id and is_active = true
  for update;

  if not found then
    raise exception 'Ticket tier not found or no longer active';
  end if;

  if (v_tier.capacity - v_tier.sold_count) < p_quantity then
    raise exception 'Sold out! Only % tickets remaining for %', (v_tier.capacity - v_tier.sold_count), v_tier.name;
  end if;

  -- 3. Increment sold count
  update public.event_ticket_tiers
  set sold_count = sold_count + p_quantity,
      updated_at = now()
  where id = p_tier_id;

  -- 4. Generate unique Pax Code (derived from event title, e.g. "BSP-1025") and Order Reference
  v_pax_code := public.generate_pax_code(v_event.name);
  v_order_ref := coalesce(p_order_reference, 'ORD-' || upper(substr(gen_random_uuid()::text, 1, 8)));

  -- 5. Insert Ticket Record
  insert into public.event_tickets (
    event_id,
    tier_id,
    pax_code,
    order_reference,
    customer_name,
    customer_phone,
    customer_email,
    price_minor,
    quantity,
    channel,
    status
  ) values (
    p_event_id,
    p_tier_id,
    v_pax_code,
    v_order_ref,
    trim(p_customer_name),
    trim(p_customer_phone),
    nullif(trim(p_customer_email), ''),
    v_tier.price_minor,
    p_quantity,
    p_channel,
    coalesce(p_initial_status, 'valid')
  )
  returning id into v_ticket_id;

  return jsonb_build_object(
    'success', true,
    'ticket_id', v_ticket_id,
    'pax_code', v_pax_code,
    'order_reference', v_order_ref,
    'tier_name', v_tier.name,
    'event_name', v_event.name,
    'venue_name', v_event.venue_name,
    'quantity', p_quantity,
    'status', coalesce(p_initial_status, 'valid'),
    'price_minor', v_tier.price_minor * p_quantity
  );
end;
$$;

grant execute on function public.purchase_event_ticket(uuid, uuid, integer, text, text, text, text, text, text) to anon, authenticated;
grant usage, select on sequence public.pax_code_seq to anon, authenticated;
grant execute on function public.generate_pax_code(text) to anon, authenticated;

