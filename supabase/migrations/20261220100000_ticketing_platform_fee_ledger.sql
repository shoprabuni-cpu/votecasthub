-- Migration: Ticketing 10% Platform Fee, Multi-Pass Individual Codes & Resilient Bot Sessions
-- 1. Ensures all paid ticket orders record their gross collection, 10% platform fee, and 90% organizer net earnings directly into paid_vote_ledger.
-- 2. Ensures multi-ticket purchases generate distinct PAX codes and group check-ins allow full admission.
-- 3. Supports instant self-service lookup showing all passes in an order.
-- 4. Enables all bot ticketing states on WhatsApp and Telegram sessions.

-- A. Table Columns & Constraints
alter table public.event_tickets add column if not exists checked_in_count integer not null default 0;

alter table public.whatsapp_sessions drop constraint if exists whatsapp_sessions_state_check;
alter table public.whatsapp_sessions add constraint whatsapp_sessions_state_check check (
  state in (
    'idle',
    'awaiting_candidate',
    'awaiting_quantity',
    'awaiting_payment',
    'awaiting_invite_code',
    'awaiting_voter_id',
    'awaiting_claim_code',
    'awaiting_email',
    'awaiting_email_otp',
    'awaiting_ticket_tier',
    'awaiting_ticket_quantity',
    'awaiting_ticket_name',
    'awaiting_ticket_phone',
    'completed'
  )
);
alter table public.whatsapp_sessions add column if not exists tier_id uuid references public.event_ticket_tiers(id) on delete set null;
alter table public.whatsapp_sessions add column if not exists customer_name text;

alter table public.telegram_sessions drop constraint if exists telegram_sessions_state_check;
alter table public.telegram_sessions add constraint telegram_sessions_state_check check (
  state in (
    'idle',
    'awaiting_candidate',
    'awaiting_quantity',
    'awaiting_payment',
    'awaiting_contact',
    'awaiting_invite_code',
    'awaiting_voter_id',
    'awaiting_claim_code',
    'awaiting_email',
    'awaiting_email_otp',
    'awaiting_ticket_tier',
    'awaiting_ticket_quantity',
    'awaiting_ticket_name',
    'awaiting_ticket_phone',
    'completed'
  )
);
alter table public.telegram_sessions add column if not exists tier_id uuid references public.event_ticket_tiers(id) on delete set null;
alter table public.telegram_sessions add column if not exists customer_name text;

alter table public.event_ticket_tiers add column if not exists sort_order integer not null default 0;
alter table public.event_ticket_tiers add column if not exists display_order integer not null default 0;

-- B. Purchase Event Ticket (Multi-Code Generator)
create or replace function public.purchase_event_ticket(
  p_event_id uuid,
  p_tier_id uuid,
  p_quantity integer default 1,
  p_customer_name text default 'Guest',
  p_customer_phone text default '',
  p_customer_email text default null,
  p_order_reference text default null,
  p_channel text default 'web',
  p_initial_status text default 'valid'
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_tier record;
  v_event record;
  v_ticket_id uuid;
  v_pax_code text;
  v_first_pax_code text := null;
  v_pax_codes text[] := '{}';
  v_order_ref text;
  v_tickets_list jsonb := '[]'::jsonb;
begin
  if p_quantity < 1 or p_quantity > 20 then
    raise exception 'Quantity must be between 1 and 20';
  end if;

  select * into v_event from public.events
  where id = p_event_id and status in ('published', 'paused');

  if not found then
    raise exception 'Event not found or not published';
  end if;

  select * into v_tier from public.event_ticket_tiers
  where id = p_tier_id and event_id = p_event_id and is_active = true
  for update;

  if not found then
    raise exception 'Ticket tier not found or no longer active';
  end if;

  if (v_tier.capacity - v_tier.sold_count) < p_quantity then
    raise exception 'Sold out! Only % tickets remaining for %', (v_tier.capacity - v_tier.sold_count), v_tier.name;
  end if;

  update public.event_ticket_tiers
  set sold_count = sold_count + p_quantity,
      updated_at = now()
  where id = p_tier_id;

  v_order_ref := coalesce(p_order_reference, 'ORD-' || upper(substr(gen_random_uuid()::text, 1, 8)));

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
      checked_in_count,
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
      0,
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

grant execute on function public.purchase_event_ticket(uuid, uuid, integer, text, text, text, text, text, text) to anon, authenticated, service_role;

-- C. Confirm Paid Ticket (10% Platform Fee & Multi-Code Activation)
create or replace function public.confirm_paid_ticket(
  p_order_reference text,
  p_provider_transaction_id text default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_first record;
  v_event record;
  v_tier record;
  v_codes text[] := '{}';
  v_count integer := 0;
  v_tickets_list jsonb := '[]'::jsonb;
  v_gross_minor bigint := 0;
  v_platform_fee bigint := 0;
  v_net_minor bigint := 0;
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

  update public.event_tickets
  set status = 'valid'
  where order_reference = p_order_reference and status = 'pending';

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
  v_gross_minor := coalesce(v_tier.price_minor, 0) * v_count;
  v_platform_fee := floor(v_gross_minor * 0.10);
  v_net_minor := v_gross_minor - v_platform_fee;

  if v_gross_minor > 0 and v_event.organization_id is not null then
    insert into public.paid_vote_ledger (
      provider,
      organization_id,
      event_id,
      reference,
      gross_amount_minor,
      platform_fee_minor,
      provider_fee_minor,
      organizer_net_minor,
      status,
      provider_transaction_id,
      confirmed_at
    ) values (
      'paystack',
      v_event.organization_id,
      v_event.id,
      p_order_reference,
      v_gross_minor,
      v_platform_fee,
      0,
      v_net_minor,
      'confirmed',
      case when p_provider_transaction_id ~ '^[0-9]+$' then p_provider_transaction_id::bigint else null end,
      now()
    ) on conflict (reference) do update set
      status = 'confirmed',
      confirmed_at = coalesce(public.paid_vote_ledger.confirmed_at, now());
  end if;

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
    'price_minor', v_gross_minor,
    'platform_fee_minor', v_platform_fee,
    'organizer_net_minor', v_net_minor,
    'tickets', v_tickets_list
  );
end;
$$;

grant execute on function public.confirm_paid_ticket(text, text) to anon, authenticated, service_role;

-- D. Gate Check-in (Supports Individual Passes & Group Multi-Admissions)
create or replace function public.check_in_ticket(
  p_pax_code text,
  p_usher_name text default 'Gate Usher'
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_ticket record;
  v_tier record;
  v_event record;
  v_new_checked_in integer;
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

  v_new_checked_in := coalesce(v_ticket.checked_in_count, 0) + 1;

  if v_ticket.status = 'checked_in' or v_new_checked_in > coalesce(v_ticket.quantity, 1) then
    return jsonb_build_object(
      'status', 'already_used',
      'message', 'Already used! All ' || coalesce(v_ticket.quantity, 1) || ' admission(s) on this pass have checked in.',
      'checked_in_at', v_ticket.checked_in_at,
      'checked_in_by', v_ticket.checked_in_by,
      'customer_name', v_ticket.customer_name,
      'tier_name', v_tier.name,
      'pax_code', v_ticket.pax_code,
      'quantity', v_ticket.quantity
    );
  end if;

  update public.event_tickets
  set checked_in_count = v_new_checked_in,
      status = case when v_new_checked_in >= coalesce(v_ticket.quantity, 1) then 'checked_in' else 'valid' end,
      checked_in_at = now(),
      checked_in_by = p_usher_name
  where id = v_ticket.id;

  return jsonb_build_object(
    'status', 'success',
    'message', 'Valid ticket! Entry granted. (' || v_new_checked_in || ' of ' || coalesce(v_ticket.quantity, 1) || ' checked in)',
    'pax_code', v_ticket.pax_code,
    'customer_name', v_ticket.customer_name,
    'customer_phone', v_ticket.customer_phone,
    'tier_name', v_tier.name,
    'quantity', v_ticket.quantity,
    'checked_in_number', v_new_checked_in,
    'event_name', v_event.name,
    'venue_name', v_event.venue_name,
    'checked_in_at', now()
  );
end;
$$;

grant execute on function public.check_in_ticket(text, text) to anon, authenticated, service_role;

-- E. Public Ticket Lookup (Fetches All Passes in Order When Any PAX Code Is Searched)
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
      'checked_in_count', coalesce(t.checked_in_count, 0),
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
        or t.order_reference in (
          select sub_t.order_reference
          from public.event_tickets sub_t
          where upper(sub_t.pax_code) = clean_q
        )
      )
    order by t.created_at desc, t.pax_code asc
    limit 20
  ) sub;

  return result;
end;
$$;

grant execute on function public.find_public_tickets(text) to anon, authenticated, service_role;

-- F. Publishing Checklist Enforcing Paystack on Paid Tickets & SMS Only for Phone-Verified Free Voting
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
      if exists (select 1 from public.event_ticket_tiers where event_id = p_event_id and is_active and price_minor > 0)
         and not public.can_publish_paid_event(p_event_id) then
        raise exception 'Verify the organizer Paystack subaccount before publishing paid ticketing' using errcode = '22023';
      end if;
    else
      if (v_event.voting_mode = 'paid' or exists(select 1 from public.event_ticket_tiers where event_id = p_event_id and is_active and price_minor > 0))
         and not public.can_publish_paid_event(p_event_id) then
        raise exception 'Verify the organizer Paystack subaccount before publishing paid events' using errcode = '22023';
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
end;
$$;
