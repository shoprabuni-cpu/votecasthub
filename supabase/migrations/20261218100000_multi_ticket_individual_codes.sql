-- Migration: Support Multiple Individual Tickets and Unique PAX Codes Per Order
-- When an attendee purchases N tickets (quantity >= 1), generate N distinct ticket records,
-- each with its own unique PAX code (e.g. BSP-1025, BSP-1026, BSP-1027...) and individual QR code,
-- tied together under the same order_reference.
-- This ensures friends arriving at different times can each check in independently without blocking each other.

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
  v_order_ref text;
  v_pax_code text;
  v_first_pax_code text := null;
  v_ticket_id uuid;
  v_tickets_list jsonb := '[]'::jsonb;
  v_pax_codes text[] := '{}';
  i integer;
begin
  if p_quantity is null or p_quantity < 1 or p_quantity > 20 then
    raise exception 'Quantity must be between 1 and 20';
  end if;

  -- 1. Check Event status and type
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

  -- 3. Increment sold count by full quantity
  update public.event_ticket_tiers
  set sold_count = sold_count + p_quantity,
      updated_at = now()
  where id = p_tier_id;

  -- 4. Shared Order Reference for this purchase
  v_order_ref := coalesce(p_order_reference, 'ORD-' || upper(substr(gen_random_uuid()::text, 1, 8)));

  -- 5. Generate N distinct tickets, each with its own unique PAX code and quantity = 1
  for i in 1..p_quantity loop
    v_pax_code := public.generate_pax_code(v_event.name);
    if v_first_pax_code is null then
      v_first_pax_code := v_pax_code;
    end if;

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
      1,
      p_channel,
      coalesce(p_initial_status, 'valid')
    )
    returning id into v_ticket_id;

    v_pax_codes := array_append(v_pax_codes, v_pax_code);

    v_tickets_list := v_tickets_list || jsonb_build_object(
      'id', v_ticket_id,
      'pax_code', v_pax_code,
      'ticket_number', i,
      'total_tickets', p_quantity,
      'status', coalesce(p_initial_status, 'valid')
    );
  end loop;

  return jsonb_build_object(
    'success', true,
    'order_reference', v_order_ref,
    'quantity', p_quantity,
    'pax_code', v_first_pax_code,
    'pax_codes', v_pax_codes,
    'tier_name', v_tier.name,
    'event_name', v_event.name,
    'venue_name', v_event.venue_name,
    'price_minor', v_tier.price_minor * p_quantity,
    'tickets', v_tickets_list
  );
end;
$$;

grant execute on function public.purchase_event_ticket(uuid, uuid, integer, text, text, text, text, text, text) to anon, authenticated;

-- Update confirm_paid_ticket to activate all individual tickets in the order
create or replace function public.confirm_paid_ticket(
  p_order_reference text,
  p_provider_transaction_id text default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_first record;
  v_event record;
  v_tier record;
  v_codes text[] := '{}';
  v_count integer;
  v_tickets_list jsonb := '[]'::jsonb;
  rec record;
  i integer := 0;
begin
  select * into v_first from public.event_tickets
  where order_reference = p_order_reference
  order by created_at asc
  limit 1;

  if not found then
    return jsonb_build_object('success', false, 'error', 'Ticket not found');
  end if;

  select * into v_event from public.events where id = v_first.event_id;
  select * into v_tier from public.event_ticket_tiers where id = v_first.tier_id;

  -- Update all tickets under this order reference to 'valid'
  update public.event_tickets
  set status = 'valid'
  where order_reference = p_order_reference and status = 'pending';

  -- Collect all tickets under this order reference
  for rec in
    select id, pax_code, status
    from public.event_tickets
    where order_reference = p_order_reference
    order by created_at asc
  loop
    i := i + 1;
    v_codes := array_append(v_codes, rec.pax_code);
    v_tickets_list := v_tickets_list || jsonb_build_object(
      'id', rec.id,
      'pax_code', rec.pax_code,
      'ticket_number', i,
      'status', rec.status
    );
  end loop;

  v_count := coalesce(array_length(v_codes, 1), 1);

  return jsonb_build_object(
    'success', true,
    'order_reference', p_order_reference,
    'pax_code', v_first.pax_code,
    'pax_codes', v_codes,
    'customer_name', v_first.customer_name,
    'customer_phone', v_first.customer_phone,
    'event_name', v_event.name,
    'tier_name', v_tier.name,
    'venue_name', v_event.venue_name,
    'quantity', v_count,
    'price_minor', v_tier.price_minor * v_count,
    'tickets', v_tickets_list
  );
end;
$$;

grant execute on function public.confirm_paid_ticket(text, text) to anon, authenticated;
