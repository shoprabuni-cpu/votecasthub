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
  if v_phone_confirmed_at is null and v_email_confirmed_at is null then raise exception 'Verify your phone or email before voting' using errcode = '42501'; end if;
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
      raise exception 'This verified phone has reached the vote limit for this nominee' using errcode = '22023';
    end if;
    raise exception 'This verified phone has reached the vote limit for this category' using errcode = '22023';
  end if;

  insert into public.vote_batches (payment_attempt_id, event_id, category_id, nominee_id, voter_user_id, voter_request_key, quantity)
  values (null, p_event_id, p_category_id, p_nominee_id, v_user_id, p_request_key, p_quantity)
  returning id into v_batch_id;
  insert into public.audit_logs (organization_id, actor_user_id, action, resource_type, resource_id, metadata)
  values (v_event.organization_id, v_user_id, 'free_votes_cast', 'vote_batch', v_batch_id::text,
    jsonb_build_object('event_id', p_event_id, 'category_id', p_category_id, 'nominee_id', p_nominee_id, 'quantity', p_quantity));
  return v_batch_id;
end;
$$;
revoke execute on function public.cast_free_votes(uuid, uuid, uuid, integer, uuid) from public, anon, authenticated;
grant execute on function public.cast_free_votes(uuid, uuid, uuid, integer, uuid) to authenticated;
