-- Migration: Comprehensive voter eligibility check RPC & multi-method free voting fixes
-- Supports: phone, email, invite_code, voter_list

create or replace function public.check_voter_event_eligibility(p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_method text;
  v_voting_mode text;
  v_is_eligible boolean := false;
  v_phone_confirmed boolean := false;
  v_email_confirmed boolean := false;
  v_has_access_code boolean := false;
  v_has_voter_list boolean := false;
  v_voter_list_max integer := 0;
  v_voter_list_used integer := 0;
begin
  select e.verification_method, e.voting_mode into v_method, v_voting_mode
  from public.events e where e.id = p_event_id;

  if not found then
    return jsonb_build_object(
      'is_authenticated', false,
      'is_verified', false,
      'error', 'Event not found'
    );
  end if;

  if v_uid is null then
    return jsonb_build_object(
      'is_authenticated', false,
      'is_verified', false,
      'method', v_method
    );
  end if;

  select 
    (u.phone_confirmed_at is not null),
    (u.email_confirmed_at is not null)
  into v_phone_confirmed, v_email_confirmed
  from auth.users u where u.id = v_uid;

  if v_method = 'phone' then
    v_is_eligible := coalesce(v_phone_confirmed, false);
  elsif v_method = 'email' then
    v_is_eligible := coalesce(v_email_confirmed, false);
  elsif v_method = 'invite_code' then
    select exists (
      select 1 
      from public.event_access_code_redemptions r
      join public.event_access_codes c on c.id = r.access_code_id
      where c.event_id = p_event_id 
        and r.voter_user_id = v_uid
        and (c.expires_at is null or c.expires_at > now())
    ) into v_has_access_code;
    v_is_eligible := v_has_access_code;
  elsif v_method = 'voter_list' then
    select 
      coalesce(max_votes, 0),
      coalesce(used_votes, 0)
    into v_voter_list_max, v_voter_list_used
    from public.event_voter_list_entries l
    where l.event_id = p_event_id 
      and l.redeemed_by = v_uid
      and l.redeemed_at is not null
    limit 1;

    if found and (v_voter_list_used < v_voter_list_max) then
      v_has_voter_list := true;
      v_is_eligible := true;
    elsif found then
      v_has_voter_list := true;
      v_is_eligible := false; -- Redeemed but votes exhausted
    else
      v_has_voter_list := false;
      v_is_eligible := false;
    end if;
  else
    v_is_eligible := coalesce(v_phone_confirmed, false) or coalesce(v_email_confirmed, false);
  end if;

  return jsonb_build_object(
    'is_authenticated', true,
    'is_verified', v_is_eligible,
    'method', v_method,
    'phone_confirmed', coalesce(v_phone_confirmed, false),
    'email_confirmed', coalesce(v_email_confirmed, false),
    'has_access_code', v_has_access_code,
    'has_voter_list', v_has_voter_list,
    'voter_list_max', v_voter_list_max,
    'voter_list_used', v_voter_list_used
  );
end $$;

revoke all on function public.check_voter_event_eligibility(uuid) from public, anon;
grant execute on function public.check_voter_event_eligibility(uuid) to anon, authenticated;

-- Update cast_free_votes to cleanly check identity matching the event's verification method
create or replace function public.cast_free_votes(
  p_event_id uuid,
  p_category_id uuid,
  p_nominee_id uuid,
  p_quantity integer,
  p_request_key uuid
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_user_id uuid := (select auth.uid());
  v_phone_confirmed_at timestamptz;
  v_email_confirmed_at timestamptz;
  v_event public.events%rowtype;
  v_used integer;
  v_batch_id uuid;
begin
  if v_user_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  select user_row.phone_confirmed_at, user_row.email_confirmed_at into v_phone_confirmed_at, v_email_confirmed_at
    from auth.users as user_row where user_row.id = v_user_id;

  if p_quantity is null or p_quantity not between 1 and 100 then raise exception 'Vote quantity must be from 1 to 100' using errcode = '22023'; end if;
  if p_request_key is null then raise exception 'Vote request key is required' using errcode = '22023'; end if;

  select * into v_event from public.events as event where event.id = p_event_id for share;
  if not found then raise exception 'Event not found' using errcode = 'P0002'; end if;
  if v_event.status <> 'published' or now() < v_event.starts_at or now() >= v_event.ends_at then
    raise exception 'Voting is not open for this event' using errcode = '22023';
  end if;
  if v_event.voting_mode <> 'free' or v_event.free_vote_limit_per_phone is null then
    raise exception 'This event does not accept free votes' using errcode = '22023';
  end if;

  -- Method-specific identity check
  if v_event.verification_method = 'phone' then
    if v_phone_confirmed_at is null then
      raise exception 'Verify your phone number before voting' using errcode = '42501';
    end if;
  elsif v_event.verification_method = 'email' then
    if v_email_confirmed_at is null then
      raise exception 'Verify your email before voting' using errcode = '42501';
    end if;
  elsif v_event.verification_method in ('invite_code', 'voter_list') then
    -- Private identity verification is handled by trigger enforce_private_vote_identity
    null;
  else
    if v_phone_confirmed_at is null and v_email_confirmed_at is null then
      raise exception 'Verify your phone or email before voting' using errcode = '42501';
    end if;
  end if;

  if not exists (
    select 1 from public.categories as category
    join public.nominees as nominee on nominee.category_id = category.id
    where category.id = p_category_id and category.event_id = p_event_id and category.is_active
      and nominee.id = p_nominee_id and nominee.is_active
  ) then raise exception 'Choose an active nominee in this event' using errcode = '22023'; end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user_id::text || ':' || p_event_id::text || ':' || p_category_id::text, 0));
  select batch.id into v_batch_id from public.vote_batches as batch
    where batch.voter_request_key = p_request_key;
  if found then
    if exists (select 1 from public.vote_batches as batch where batch.id = v_batch_id
      and batch.voter_user_id = v_user_id and batch.event_id = p_event_id
      and batch.category_id = p_category_id and batch.nominee_id = p_nominee_id
      and batch.quantity = p_quantity) then return v_batch_id; end if;
    raise exception 'Vote request key was already used' using errcode = '23505';
  end if;

  if v_event.voting_rule = 'per_nominee_limit' then
    select coalesce(sum(batch.quantity), 0)::integer into v_used
      from public.vote_batches as batch
      where batch.payment_attempt_id is null and batch.voter_user_id = v_user_id
        and batch.event_id = p_event_id and batch.category_id = p_category_id
        and batch.nominee_id = p_nominee_id;
  else
    select coalesce(sum(batch.quantity), 0)::integer into v_used
      from public.vote_batches as batch
      where batch.payment_attempt_id is null and batch.voter_user_id = v_user_id
        and batch.event_id = p_event_id and batch.category_id = p_category_id;
  end if;

  if v_used + p_quantity > v_event.free_vote_limit_per_phone then
    if v_event.voting_rule = 'per_nominee_limit' then
      raise exception 'You have reached the vote limit for this nominee' using errcode = '22023';
    else
      raise exception 'You have reached the vote limit for this category' using errcode = '22023';
    end if;
  end if;

  insert into public.vote_batches (
    event_id, category_id, nominee_id, quantity, voter_user_id, voter_request_key,
    channel, payment_attempt_id
  ) values (
    p_event_id, p_category_id, p_nominee_id, p_quantity, v_user_id, p_request_key,
    'web', null
  ) returning id into v_batch_id;

  return v_batch_id;
end $$;

revoke all on function public.cast_free_votes(uuid, uuid, uuid, integer, uuid) from public, anon;
grant execute on function public.cast_free_votes(uuid, uuid, uuid, integer, uuid) to authenticated;
