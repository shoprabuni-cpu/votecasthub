-- Migration: Ticketing 10% Platform Fee & Ledger Integration
-- Ensures all paid ticket orders record their gross collection, 10% platform fee,
-- and 90% organizer net earnings directly into paid_vote_ledger.
-- Also reinforces that ONLY free voting with phone verification requires an SMS bundle.

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
  v_gross_minor := coalesce(v_tier.price_minor, 0) * v_count;
  v_platform_fee := floor(v_gross_minor * 0.10);
  v_net_minor := v_gross_minor - v_platform_fee;

  -- Record into paid_vote_ledger so ticketing revenue, the 10% platform fee,
  -- and 90% organizer net earnings appear in the earnings ledger and analytics
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

-- 2. Update set_event_status_before_lifecycle to enforce Paystack subaccount (10% fee) on paid tickets
-- and ensure ONLY phone-verified free voting requires an SMS bundle
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
      -- If any ticket tier is paid, organizer must connect their Paystack subaccount (10% platform fee)
      if exists (select 1 from public.event_ticket_tiers where event_id = p_event_id and is_active and price_minor > 0)
         and not public.can_publish_paid_event(p_event_id) then
        raise exception 'Verify the organizer Paystack subaccount before publishing paid ticketing' using errcode = '22023';
      end if;
    else
      -- If voting is paid or hybrid has paid tickets, require Paystack subaccount
      if (v_event.voting_mode = 'paid' or exists(select 1 from public.event_ticket_tiers where event_id = p_event_id and is_active and price_minor > 0))
         and not public.can_publish_paid_event(p_event_id) then
        raise exception 'Verify the organizer Paystack subaccount before publishing paid voting' using errcode = '22023';
      end if;
      -- ONLY free voting with phone verification requires an SMS bundle
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
