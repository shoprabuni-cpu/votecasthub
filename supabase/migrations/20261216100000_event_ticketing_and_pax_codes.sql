-- Migration: Standalone Event Ticketing & Auto-Generated PAX Codes
-- Enables ticket-only events, ticket tiers, secure ticket issuance, and gate check-in.

-- 1. Extend events table with ticketing support
alter table public.events
  add column if not exists event_type text not null default 'voting',
  add column if not exists venue_name text,
  add column if not exists venue_address text,
  add column if not exists doors_open_time text;

alter table public.events
  drop constraint if exists events_event_type_check;

alter table public.events
  add constraint events_event_type_check check (event_type in ('voting', 'ticketing', 'hybrid'));

grant select (event_type, venue_name, venue_address, doors_open_time) on public.events to anon, authenticated;

-- 2. Ticket Tiers Table
create table if not exists public.event_ticket_tiers (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  price_minor bigint not null default 0 check (price_minor >= 0),
  capacity integer not null default 100 check (capacity > 0),
  sold_count integer not null default 0 check (sold_count >= 0 and sold_count <= capacity),
  description text check (description is null or char_length(description) <= 300),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists event_ticket_tiers_event_idx on public.event_ticket_tiers(event_id, sort_order);

-- 3. Sequence for auto-generating memorable human-friendly PAX Codes (e.g. PAX-1042)
create sequence if not exists public.pax_code_seq start with 1024 increment by 1;

create or replace function public.generate_pax_code()
returns text language plpgsql as $$
declare
  v_num bigint;
begin
  v_num := nextval('public.pax_code_seq');
  return 'PAX-' || lpad(v_num::text, 4, '0');
end;
$$;

-- 4. Issued Event Tickets Table
create table if not exists public.event_tickets (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  tier_id uuid not null references public.event_ticket_tiers(id) on delete restrict,
  pax_code text not null unique,
  order_reference text not null,
  customer_name text not null check (char_length(btrim(customer_name)) >= 2),
  customer_phone text not null check (char_length(btrim(customer_phone)) >= 9),
  customer_email text,
  price_minor bigint not null default 0,
  quantity integer not null default 1 check (quantity >= 1),
  channel text not null default 'web' check (channel in ('web', 'whatsapp', 'ussd', 'telegram', 'manual')),
  status text not null default 'valid' check (status in ('pending', 'valid', 'checked_in', 'cancelled')),
  checked_in_at timestamptz,
  checked_in_by text,
  created_at timestamptz not null default now()
);

create index if not exists event_tickets_event_idx on public.event_tickets(event_id, created_at desc);
create index if not exists event_tickets_pax_code_idx on public.event_tickets(pax_code);
create index if not exists event_tickets_order_ref_idx on public.event_tickets(order_reference);

-- 5. Enable Row Level Security
alter table public.event_ticket_tiers enable row level security;
alter table public.event_tickets enable row level security;

-- Public can view active tiers for published events
drop policy if exists "public_view_ticket_tiers" on public.event_ticket_tiers;
create policy "public_view_ticket_tiers" on public.event_ticket_tiers
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.events e
      where e.id = event_ticket_tiers.event_id
        and e.status in ('published', 'paused', 'closed')
        and event_ticket_tiers.is_active = true
    )
  );

-- Organizers can manage ticket tiers for their own events
drop policy if exists "organizers_manage_ticket_tiers" on public.event_ticket_tiers;
create policy "organizers_manage_ticket_tiers" on public.event_ticket_tiers
  for all to authenticated
  using (
    exists (
      select 1 from public.events e
      where e.id = event_ticket_tiers.event_id
        and private.can_manage_org(e.organization_id)
    )
  )
  with check (
    exists (
      select 1 from public.events e
      where e.id = event_ticket_tiers.event_id
        and private.can_manage_org(e.organization_id)
    )
  );

-- Organizers can view tickets for their events
drop policy if exists "organizers_view_event_tickets" on public.event_tickets;
create policy "organizers_view_event_tickets" on public.event_tickets
  for select to authenticated
  using (
    exists (
      select 1 from public.events e
      where e.id = event_tickets.event_id
        and private.can_manage_org(e.organization_id)
    )
  );

-- Public can view their ticket pass by id or pax_code
drop policy if exists "public_view_individual_ticket" on public.event_tickets;
create policy "public_view_individual_ticket" on public.event_tickets
  for select to anon, authenticated
  using (true);

grant select, insert, update, delete on public.event_ticket_tiers to authenticated;
grant select on public.event_ticket_tiers to anon;

grant select, insert, update on public.event_tickets to authenticated;
grant select on public.event_tickets to anon;

-- 6. Atomic Ticket Purchase RPC Function
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

  -- 1. Check Event status and type
  select * into v_event from public.events
  where id = p_event_id and status in ('published', 'paused');

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

  -- 4. Generate unique Pax Code and Order Reference
  v_pax_code := public.generate_pax_code();
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

-- 7. Gate Check-in Verification RPC
create or replace function public.check_in_ticket(
  p_pax_code text,
  p_usher_name text default 'Gate Usher'
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_ticket record;
  v_tier record;
  v_event record;
begin
  select * into v_ticket from public.event_tickets
  where upper(pax_code) = upper(trim(p_pax_code))
  for update;

  if not found then
    return jsonb_build_object(
      'status', 'invalid',
      'message', 'Invalid ticket! Code not found.'
    );
  end if;

  select name into v_tier from public.event_ticket_tiers where id = v_ticket.tier_id;
  select name, venue_name into v_event from public.events where id = v_ticket.event_id;

  if v_ticket.status = 'checked_in' then
    return jsonb_build_object(
      'status', 'already_used',
      'message', 'Already scanned and checked in!',
      'checked_in_at', v_ticket.checked_in_at,
      'checked_in_by', v_ticket.checked_in_by,
      'customer_name', v_ticket.customer_name,
      'tier_name', v_tier.name,
      'pax_code', v_ticket.pax_code
    );
  end if;

  if v_ticket.status = 'pending' then
    return jsonb_build_object(
      'status', 'invalid',
      'message', 'This ticket payment is still pending confirmation.',
      'customer_name', v_ticket.customer_name,
      'pax_code', v_ticket.pax_code
    );
  end if;

  if v_ticket.status = 'cancelled' then
    return jsonb_build_object(
      'status', 'cancelled',
      'message', 'This ticket has been cancelled or refunded.',
      'customer_name', v_ticket.customer_name,
      'pax_code', v_ticket.pax_code
    );
  end if;

  -- Mark as checked in
  update public.event_tickets
  set status = 'checked_in',
      checked_in_at = now(),
      checked_in_by = p_usher_name
  where id = v_ticket.id;

  return jsonb_build_object(
    'status', 'success',
    'message', 'Valid ticket! Entry granted.',
    'pax_code', v_ticket.pax_code,
    'customer_name', v_ticket.customer_name,
    'customer_phone', v_ticket.customer_phone,
    'tier_name', v_tier.name,
    'quantity', v_ticket.quantity,
    'event_name', v_event.name,
    'venue_name', v_event.venue_name,
    'checked_in_at', now()
  );
end;
$$;

grant execute on function public.check_in_ticket(text, text) to anon, authenticated;

-- 6. Update get_public_event_directory to include event_type, venue_name, doors_open_time and filter by event_type
drop function if exists public.get_public_event_directory(text, text, text, text, integer, integer);

create or replace function public.get_public_event_directory(
  p_search text default '',
  p_status text default 'active',
  p_mode text default 'all',
  p_sort text default 'soonest',
  p_offset integer default 0,
  p_limit integer default 24,
  p_event_type text default 'all'
) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
  if p_status not in ('active','all','open','upcoming','ending','paused','closed') or
     p_mode not in ('all','free','paid') or p_sort not in ('soonest','newest','name') or
     p_event_type not in ('all','voting','ticketing','hybrid') or
     p_offset < 0 or p_offset > 100000 or p_limit < 1 or p_limit > 48 or char_length(p_search)>120 or
     p_status is null or p_mode is null or p_sort is null or p_offset is null or p_limit is null or p_search is null or p_event_type is null then
    raise exception 'Invalid event filters' using errcode='22023';
  end if;
  with eligible as (
    select e.id,e.name,e.slug,e.description,e.image_path,e.unit_price_minor,e.starts_at,e.ends_at,e.status,e.voting_mode,e.event_type,e.venue_name,e.doors_open_time,e.created_at,o.name organization_name,
      case when e.status='closed' or e.ends_at<=now() then 'closed' when e.status='paused' then 'paused' when e.starts_at>now() then 'upcoming' else 'open' end phase
    from public.events e join public.organizations o on o.id=e.organization_id
    where e.status in ('published','paused','closed') and e.purged_at is null
      and o.moderation_status='active' and o.archived_at is null
      and not exists(select 1 from public.admin_deletion_jobs j where j.status='pending' and ((j.target_kind='event' and j.target_id=e.id) or (j.target_kind='organization' and j.target_id=o.id)))
      and (p_mode='all' or e.voting_mode=p_mode)
      and (p_event_type='all' or e.event_type=p_event_type)
      and (p_search='' or strpos(lower(e.name||' '||coalesce(e.description,'')||' '||coalesce(e.venue_name,'')||' '||o.name),lower(p_search))>0)
  ), filtered as (
    select * from eligible where p_status='all' or (p_status='active' and phase<>'closed') or phase=p_status
      or (p_status='ending' and phase='open' and ends_at<=now()+interval '48 hours')
  ), page as (
    select *,row_number() over(order by
      case when p_sort='name' then lower(name) end,
      case when p_sort='newest' then created_at end desc,
      case when p_sort='soonest' then case phase when 'open' then 0 when 'upcoming' then 1 when 'paused' then 2 else 3 end end,
      case when p_sort='soonest' then case when phase='upcoming' then starts_at else ends_at end end,
      id) position
    from filtered
  ) select jsonb_build_object('total',(select count(*) from filtered),'now',floor(extract(epoch from now())*1000),
      'events',coalesce((select jsonb_agg(to_jsonb(p)-'created_at'-'phase'-'position' order by position) from
      (select * from page order by position limit p_limit offset p_offset) p),'[]'::jsonb)) into result;
  return result;
end;
$$;

revoke all on function public.get_public_event_directory(text,text,text,text,integer,integer,text) from public;
grant execute on function public.get_public_event_directory(text,text,text,text,integer,integer,text) to anon,authenticated;

-- 8. Confirm Paid Ticket (Invoked upon verified Paystack payment)
create or replace function public.confirm_paid_ticket(
  p_order_reference text,
  p_provider_transaction_id text default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_ticket record;
  v_event record;
  v_tier record;
begin
  select * into v_ticket from public.event_tickets
  where order_reference = p_order_reference for update;

  if not found then
    return jsonb_build_object('success', false, 'error', 'Ticket not found');
  end if;

  select * into v_event from public.events where id = v_ticket.event_id;
  select * into v_tier from public.event_ticket_tiers where id = v_ticket.tier_id;

  if v_ticket.status = 'valid' then
    return jsonb_build_object(
      'success', true,
      'pax_code', v_ticket.pax_code,
      'already_confirmed', true,
      'customer_name', v_ticket.customer_name,
      'customer_phone', v_ticket.customer_phone,
      'event_name', v_event.name,
      'tier_name', v_tier.name,
      'venue_name', v_event.venue_name
    );
  end if;

  update public.event_tickets
  set status = 'valid'
  where id = v_ticket.id;

  return jsonb_build_object(
    'success', true,
    'pax_code', v_ticket.pax_code,
    'order_reference', v_ticket.order_reference,
    'customer_name', v_ticket.customer_name,
    'customer_phone', v_ticket.customer_phone,
    'event_name', v_event.name,
    'tier_name', v_tier.name,
    'venue_name', v_event.venue_name,
    'quantity', v_ticket.quantity,
    'price_minor', v_ticket.price_minor
  );
end;
$$;

grant execute on function public.confirm_paid_ticket(text, text) to anon, authenticated;

-- 9. Organizer Attendee Guest List
create or replace function public.get_event_attendees(p_event_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  result jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', t.id,
    'pax_code', t.pax_code,
    'order_reference', t.order_reference,
    'customer_name', t.customer_name,
    'customer_phone', t.customer_phone,
    'customer_email', t.customer_email,
    'quantity', t.quantity,
    'price_minor', t.price_minor,
    'channel', t.channel,
    'status', t.status,
    'tier_name', r.name,
    'checked_in_at', t.checked_in_at,
    'checked_in_by', t.checked_in_by,
    'created_at', t.created_at
  ) order by t.created_at desc), '[]'::jsonb) into result
  from public.event_tickets t
  join public.event_ticket_tiers r on r.id = t.tier_id
  where t.event_id = p_event_id and t.status in ('valid', 'checked_in');

  return result;
end;
$$;

grant execute on function public.get_event_attendees(uuid) to authenticated;

-- 10. Public "Find My Ticket" Lookup
create or replace function public.find_public_tickets(p_query text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  result jsonb;
  clean_q text := upper(trim(p_query));
begin
  if length(clean_q) < 3 then
    return '[]'::jsonb;
  end if;

  select coalesce(jsonb_agg(sub.item), '[]'::jsonb) into result
  from (
    select jsonb_build_object(
      'id', t.id,
      'pax_code', t.pax_code,
      'order_reference', t.order_reference,
      'customer_name', t.customer_name,
      'customer_phone', t.customer_phone,
      'quantity', t.quantity,
      'tier_name', r.name,
      'status', t.status,
      'created_at', t.created_at,
      'event_name', e.name,
      'event_slug', e.slug,
      'image_path', e.image_path,
      'venue_name', e.venue_name,
      'venue_address', e.venue_address,
      'doors_open_time', e.doors_open_time,
      'starts_at', e.starts_at,
      'ends_at', e.ends_at
    ) as item
    from public.event_tickets t
    join public.event_ticket_tiers r on r.id = t.tier_id
    join public.events e on e.id = t.event_id
    where t.status in ('valid', 'checked_in')
      and (
        t.pax_code = clean_q
        or replace(t.customer_phone, '+', '') like '%' || replace(clean_q, '+', '')
        or t.order_reference = clean_q
      )
    order by t.created_at desc
    limit 10
  ) sub;

  return result;
end;
$$;

grant execute on function public.find_public_tickets(text) to anon, authenticated;


