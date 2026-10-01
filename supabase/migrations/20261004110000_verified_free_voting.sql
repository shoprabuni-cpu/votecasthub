-- Allow verified-phone free votes to use the append-only vote ledger without a payment row.
alter table public.vote_batches
  alter column payment_attempt_id drop not null,
  add column event_id uuid,
  add column category_id uuid,
  add column nominee_id uuid,
  add column voter_user_id uuid references auth.users(id) on delete set null,
  add column voter_request_key uuid;

alter table public.vote_batches
  add constraint vote_batches_category_event_fk
    foreign key (category_id, event_id) references public.categories(id, event_id) on delete restrict,
  add constraint vote_batches_nominee_category_fk
    foreign key (nominee_id, category_id) references public.nominees(id, category_id) on delete restrict,
  add constraint vote_batches_path_check check (
    (payment_attempt_id is not null and voter_user_id is null)
    or (payment_attempt_id is null and event_id is not null and category_id is not null and nominee_id is not null)
  );

create index vote_batches_free_vote_count_idx
  on public.vote_batches(voter_user_id, event_id, category_id)
  where payment_attempt_id is null;
create unique index vote_batches_voter_request_key_idx
  on public.vote_batches(voter_request_key) where voter_request_key is not null;

create or replace function private.ensure_confirmed_payment_for_vote()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_status text;
begin
  if new.payment_attempt_id is null then
    return new;
  end if;
  select payment.status into v_status
  from public.payment_attempts as payment
  where payment.id = new.payment_attempt_id;
  if v_status is distinct from 'succeeded' then
    raise exception 'A paid vote batch requires a confirmed payment' using errcode = '23514';
  end if;
  return new;
end;
$$;

create function public.is_free_voting_open(p_event_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.events as event
    where event.id = p_event_id and event.status = 'published' and event.voting_mode = 'free'
      and now() >= event.starts_at and now() < event.ends_at
  );
$$;
revoke execute on function public.is_free_voting_open(uuid) from public, anon, authenticated;
grant execute on function public.is_free_voting_open(uuid) to anon, authenticated;

create function public.cast_free_votes(
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
  v_event public.events%rowtype;
  v_used integer;
  v_batch_id uuid;
begin
  if v_user_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  select user_row.phone_confirmed_at into v_phone_confirmed_at
    from auth.users as user_row where user_row.id = v_user_id;
  if v_phone_confirmed_at is null then raise exception 'Verify your phone number before voting' using errcode = '42501'; end if;
  if p_quantity is null or p_quantity not between 1 and 100 then raise exception 'Vote quantity must be from 1 to 100' using errcode = '22023'; end if;
  if p_request_key is null then raise exception 'Vote request key is required' using errcode = '22023'; end if;

  select * into v_event from public.events as event
    where event.id = p_event_id for share;
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

  -- Serialize votes for this verified user/event/category so concurrent requests cannot pass the cap.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user_id::text || ':' || p_event_id::text || ':' || p_category_id::text, 0));
  select batch.id into v_batch_id from public.vote_batches as batch
    where batch.voter_request_key = p_request_key;
  if found then
    if exists (select 1 from public.vote_batches as batch where batch.id = v_batch_id
      and batch.voter_user_id = v_user_id and batch.event_id = p_event_id
      and batch.category_id = p_category_id and batch.nominee_id = p_nominee_id
      and batch.quantity = p_quantity) then
      return v_batch_id;
    end if;
    raise exception 'Vote request key was already used' using errcode = '23505';
  end if;
  select coalesce(sum(batch.quantity), 0)::integer into v_used
    from public.vote_batches as batch
    where batch.payment_attempt_id is null and batch.voter_user_id = v_user_id
      and batch.event_id = p_event_id and batch.category_id = p_category_id;
  if v_used + p_quantity > v_event.free_vote_limit_per_phone then
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

create function public.get_public_event_results(p_event_id uuid)
returns table (nominee_id uuid, vote_count bigint)
language sql stable security definer set search_path = '' as $$
  select nominee.id, coalesce(sum(batch.quantity), 0)::bigint
  from public.events as event
  join public.categories as category on category.event_id = event.id and category.is_active
  join public.nominees as nominee on nominee.category_id = category.id and nominee.is_active
  left join public.vote_batches as batch on batch.nominee_id = nominee.id
  where event.id = p_event_id
    and (
      (event.results_visibility = 'live' and event.status = 'published' and now() >= event.starts_at and now() < event.ends_at)
      or (event.results_visibility = 'after_close' and (event.status in ('closed', 'archived') or now() >= event.ends_at))
    )
  group by nominee.id, nominee.display_order
  order by nominee.display_order;
$$;
revoke execute on function public.get_public_event_results(uuid) from public, anon, authenticated;
grant execute on function public.get_public_event_results(uuid) to anon, authenticated;

grant select on public.vote_batches to authenticated;
revoke select on public.vote_batches from anon;
create policy "voters can read their own vote batches" on public.vote_batches
  for select to authenticated using (voter_user_id = (select auth.uid()));
