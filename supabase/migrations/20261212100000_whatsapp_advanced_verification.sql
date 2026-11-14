-- WhatsApp advanced voter verification: Invite codes, Voter list rosters, Student IDs, and Channel tracking

-- 1. Relax/expand whatsapp_sessions state check constraint to support verification conversations
alter table public.whatsapp_sessions drop constraint if exists whatsapp_sessions_state_check;
alter table public.whatsapp_sessions add constraint whatsapp_sessions_state_check check (
  state in (
    'idle',
    'awaiting_quantity',
    'awaiting_payment',
    'awaiting_invite_code',
    'awaiting_voter_id',
    'awaiting_claim_code',
    'awaiting_email',
    'awaiting_email_otp',
    'completed'
  )
);

-- Add metadata column to store conversational context (e.g. pending nominee, claimed ID, etc.)
alter table public.whatsapp_sessions add column if not exists metadata jsonb not null default '{}'::jsonb;

-- 2. Add channel tracking to voter list and access code redemptions
alter table public.event_voter_list_entries add column if not exists redemption_channel text default 'web';
alter table public.event_access_code_redemptions add column if not exists channel text default 'web';

-- 3. Check WhatsApp voter eligibility for any event
create or replace function public.check_whatsapp_voter_eligibility(
  p_user uuid,
  p_event uuid,
  p_phone text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.events%rowtype;
  v_entry public.event_voter_list_entries%rowtype;
  v_norm_phone text;
  v_phone_hash text;
  v_has_access boolean := false;
begin
  select * into v_event from public.events where id = p_event for share;
  if not found then
    return jsonb_build_object('eligible', false, 'error', 'Event not found');
  end if;

  if v_event.voting_mode <> 'free' then
    return jsonb_build_object('eligible', true, 'mode', 'paid');
  end if;

  -- 1. PHONE verification: native and automatically eligible on WhatsApp
  if v_event.verification_method = 'phone' then
    return jsonb_build_object('eligible', true, 'method', 'phone');
  end if;

  -- 2. EMAIL verification: synthesized wa_<phone> satisfies public email
  if v_event.verification_method = 'email' then
    return jsonb_build_object('eligible', true, 'method', 'email');
  end if;

  -- 3. INVITE_CODE verification
  if v_event.verification_method = 'invite_code' then
    select exists(
      select 1
      from public.event_access_code_redemptions r
      join public.event_access_codes c on c.id = r.access_code_id
      where c.event_id = p_event
        and r.voter_user_id = p_user
        and (c.expires_at is null or c.expires_at > now())
    ) into v_has_access;

    if v_has_access then
      return jsonb_build_object('eligible', true, 'method', 'invite_code');
    else
      return jsonb_build_object('eligible', false, 'method', 'invite_code', 'reason', 'requires_invite_code');
    end if;
  end if;

  -- 4. VOTER_LIST verification
  if v_event.verification_method = 'voter_list' then
    -- Check if user already holds a redeemed entry for this event
    select * into v_entry
    from public.event_voter_list_entries
    where event_id = p_event
      and redeemed_by = p_user
      and redeemed_at is not null
    order by redeemed_at, id
    limit 1 for update;

    if found then
      if v_entry.used_votes < v_entry.max_votes then
        return jsonb_build_object(
          'eligible', true,
          'method', 'voter_list',
          'remaining_votes', (v_entry.max_votes - v_entry.used_votes),
          'max_votes', v_entry.max_votes
        );
      else
        return jsonb_build_object(
          'eligible', false,
          'method', 'voter_list',
          'reason', 'limit_exhausted',
          'max_votes', v_entry.max_votes
        );
      end if;
    end if;

    -- Voter hasn't redeemed yet: Check if caller's phone is on the voter list
    v_norm_phone := private.normalize_voter_identifier(p_phone, 'phone');
    v_phone_hash := encode(sha256(convert_to(v_norm_phone, 'UTF8')), 'hex');

    select * into v_entry
    from public.event_voter_list_entries
    where event_id = p_event
      and identifier_type = 'phone'
      and (identifier_hash = v_phone_hash or private.normalize_voter_identifier(coalesce(label, ''), 'phone') = v_norm_phone)
      and (redeemed_by is null or redeemed_by = p_user)
    order by redeemed_at nulls last, id
    limit 1 for update;

    if found then
      -- Auto-redeem phone-based voter list entry transparently!
      update public.event_voter_list_entries
      set redeemed_at = coalesce(redeemed_at, now()),
          redeemed_by = p_user,
          redemption_channel = 'whatsapp'
      where id = v_entry.id;

      return jsonb_build_object(
        'eligible', true,
        'method', 'voter_list',
        'auto_redeemed_phone', true,
        'remaining_votes', (v_entry.max_votes - v_entry.used_votes),
        'max_votes', v_entry.max_votes
      );
    end if;

    -- Not on phone roster: prompt voter for their identifier (Student ID, Index No, Email)
    return jsonb_build_object(
      'eligible', false,
      'method', 'voter_list',
      'reason', 'requires_identifier'
    );
  end if;

  return jsonb_build_object('eligible', true, 'method', v_event.verification_method);
end $$;

revoke all on function public.check_whatsapp_voter_eligibility(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.check_whatsapp_voter_eligibility(uuid, uuid, text) to service_role;

-- 4. Redeem WhatsApp invite / access code
create or replace function public.redeem_whatsapp_access_code(
  p_user uuid,
  p_event uuid,
  p_code text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code_clean text;
  v_code_hash text;
  v_code public.event_access_codes%rowtype;
begin
  if p_user is null or p_event is null or p_code is null or btrim(p_code) = '' then
    return jsonb_build_object('success', false, 'error', 'Invalid code or parameter.');
  end if;

  v_code_clean := upper(btrim(p_code));
  v_code_hash := encode(sha256(convert_to(v_code_clean, 'UTF8')), 'hex');

  -- Check if already redeemed
  if exists (
    select 1
    from public.event_access_code_redemptions r
    join public.event_access_codes c on c.id = r.access_code_id
    where c.event_id = p_event
      and r.voter_user_id = p_user
      and (c.expires_at is null or c.expires_at > now())
  ) then
    return jsonb_build_object('success', true, 'already_redeemed', true);
  end if;

  select * into v_code
  from public.event_access_codes
  where event_id = p_event
    and code_hash = v_code_hash
  for update;

  if not found then
    return jsonb_build_object('success', false, 'error', 'Invalid access code. Please check and try again.');
  end if;

  if v_code.expires_at is not null and v_code.expires_at <= now() then
    return jsonb_build_object('success', false, 'error', 'This access code has expired.');
  end if;

  if v_code.redemption_count >= v_code.max_redemptions then
    return jsonb_build_object('success', false, 'error', 'This access code has reached its usage limit.');
  end if;

  insert into public.event_access_code_redemptions (access_code_id, voter_user_id, channel)
  values (v_code.id, p_user, 'whatsapp')
  on conflict do nothing;

  update public.event_access_codes
  set redemption_count = redemption_count + 1
  where id = v_code.id;

  return jsonb_build_object('success', true, 'label', v_code.label);
end $$;

revoke all on function public.redeem_whatsapp_access_code(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.redeem_whatsapp_access_code(uuid, uuid, text) to service_role;

-- 5. Redeem WhatsApp voter-list identity (Student ID, Index Number, Staff ID, or Member ID)
create or replace function public.redeem_whatsapp_voter_id(
  p_user uuid,
  p_event uuid,
  p_identifier text,
  p_claim_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_norm text;
  v_hash text;
  v_claim_clean text;
  v_claim_hash text;
  v_entry public.event_voter_list_entries%rowtype;
begin
  if p_user is null or p_event is null or p_identifier is null or btrim(p_identifier) = '' then
    return jsonb_build_object('success', false, 'error', 'Enter a valid identifier.');
  end if;

  -- Check if user already holds an approved identity for this event
  if exists (
    select 1
    from public.event_voter_list_entries
    where event_id = p_event
      and redeemed_by = p_user
      and redeemed_at is not null
  ) then
    return jsonb_build_object('success', true, 'already_redeemed', true);
  end if;

  v_norm := lower(btrim(p_identifier));
  v_hash := encode(sha256(convert_to(v_norm, 'UTF8')), 'hex');

  -- Look for match by identifier_hash OR label
  select * into v_entry
  from public.event_voter_list_entries
  where event_id = p_event
    and (
      identifier_hash = v_hash
      or lower(btrim(coalesce(label, ''))) = v_norm
      or (identifier_type = 'phone' and private.normalize_voter_identifier(coalesce(label, ''), 'phone') = private.normalize_voter_identifier(p_identifier, 'phone'))
    )
  order by redeemed_at nulls last, id
  limit 1
  for update;

  if not found then
    return jsonb_build_object('success', false, 'error', 'Identifier not found on the approved voter list.');
  end if;

  if v_entry.redeemed_by is not null and v_entry.redeemed_by <> p_user then
    return jsonb_build_object('success', false, 'error', 'This identifier has already been claimed by another voter.');
  end if;

  -- Check if entry requires a claim PIN/code
  if v_entry.claim_code_hash is not null then
    if p_claim_code is null or btrim(p_claim_code) = '' then
      return jsonb_build_object(
        'success', false,
        'requires_claim_code', true,
        'label', coalesce(v_entry.label, p_identifier)
      );
    end if;

    v_claim_clean := upper(btrim(p_claim_code));
    v_claim_hash := encode(sha256(convert_to(v_claim_clean, 'UTF8')), 'hex');

    if v_claim_hash <> v_entry.claim_code_hash then
      return jsonb_build_object('success', false, 'error', 'Incorrect voting PIN / claim code.');
    end if;
  end if;

  -- Redeem entry
  update public.event_voter_list_entries
  set redeemed_at = coalesce(redeemed_at, now()),
      redeemed_by = p_user,
      redemption_channel = 'whatsapp'
  where id = v_entry.id;

  return jsonb_build_object(
    'success', true,
    'label', coalesce(v_entry.label, p_identifier),
    'max_votes', v_entry.max_votes,
    'used_votes', v_entry.used_votes
  );
end $$;

revoke all on function public.redeem_whatsapp_voter_id(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.redeem_whatsapp_voter_id(uuid, uuid, text, text) to service_role;
