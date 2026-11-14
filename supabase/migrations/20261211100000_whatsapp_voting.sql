-- WhatsApp voting sessions, verified voting, and Paystack settlement reservation

create table if not exists public.whatsapp_sessions (
  id uuid primary key default gen_random_uuid(),
  phone text not null,
  phone_hash text not null,
  event_id uuid references public.events(id) on delete set null,
  category_id uuid references public.categories(id) on delete set null,
  nominee_id uuid references public.nominees(id) on delete set null,
  quantity integer check (quantity is null or (quantity between 1 and 10000)),
  state text not null default 'idle' check (state in ('idle', 'awaiting_quantity', 'awaiting_payment', 'completed')),
  vote_request uuid not null default gen_random_uuid(),
  reference text,
  payment_url text,
  expires_at timestamptz not null default (now() + interval '15 minutes'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists whatsapp_sessions_phone_idx on public.whatsapp_sessions(phone);
create index if not exists whatsapp_sessions_expires_idx on public.whatsapp_sessions(expires_at);

alter table public.whatsapp_sessions enable row level security;
revoke all on public.whatsapp_sessions from public, anon, authenticated;
grant all on public.whatsapp_sessions to service_role;

-- Cast verified free vote via WhatsApp with cryptographic caller identity
create or replace function public.cast_verified_whatsapp_vote(
  p_user uuid,
  p_event uuid,
  p_category uuid,
  p_nominee uuid,
  p_quantity integer,
  p_request uuid
)
returns uuid language plpgsql security definer set search_path = '' as $body$
declare
  v_event public.events%rowtype;
  old_sub text;
  old_claims text;
  result uuid;
begin
  if not exists(select 1 from auth.users where id = p_user and phone_confirmed_at is not null) then
    raise exception 'Verified phone required' using errcode = '42501';
  end if;

  select * into v_event from public.events where id = p_event for share;
  if not found or v_event.status <> 'published' or now() < v_event.starts_at or now() >= v_event.ends_at then
    raise exception 'Voting is not open for this event' using errcode = '22023';
  end if;

  if v_event.voting_mode <> 'free' then
    raise exception 'Event is not a free voting event' using errcode = '22023';
  end if;

  -- Ensure voter has email_confirmed_at if event verification_method is email
  if v_event.verification_method = 'email' and not exists(select 1 from auth.users where id = p_user and email_confirmed_at is not null) then
    update auth.users set email_confirmed_at = now() where id = p_user;
  end if;

  old_sub := current_setting('request.jwt.claim.sub', true);
  old_claims := current_setting('request.jwt.claims', true);
  perform set_config('request.jwt.claim.sub', p_user::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', p_user, 'role', 'authenticated')::text, true);

  result := public.cast_free_votes(p_event, p_category, p_nominee, p_quantity, p_request);

  perform set_config('request.jwt.claim.sub', coalesce(old_sub, ''), true);
  perform set_config('request.jwt.claims', coalesce(old_claims, '{}'), true);
  return result;
end $body$;

revoke all on function public.cast_verified_whatsapp_vote(uuid, uuid, uuid, uuid, integer, uuid) from public, anon, authenticated;
grant execute on function public.cast_verified_whatsapp_vote(uuid, uuid, uuid, uuid, integer, uuid) to service_role;

-- Reserve Paystack Mobile Money / card payment for WhatsApp paid voting
create or replace function public.reserve_paystack_whatsapp_payment(
  p_phone text,
  p_event uuid,
  p_category uuid,
  p_nominee uuid,
  p_quantity integer,
  p_vote_request uuid
)
returns public.payment_attempts language plpgsql security definer set search_path = '' as $body$
declare
  e public.events%rowtype;
  p public.payment_attempts%rowtype;
  ref text;
  account text;
begin
  select * into e from public.events where id = p_event for share;
  if not found or e.voting_mode <> 'paid' or e.status <> 'published' or now() < e.starts_at or now() >= e.ends_at then
    raise exception 'Paid event unavailable' using errcode = '22023';
  end if;

  if p_quantity is null or p_quantity not between 1 and 10000 then
    raise exception 'Invalid vote quantity' using errcode = '22023';
  end if;

  if not exists(
    select 1 from public.categories c
    join public.nominees n on n.category_id = c.id
    where c.id = p_category and c.event_id = e.id and c.is_active and n.id = p_nominee and n.is_active
  ) then
    raise exception 'Nominee unavailable' using errcode = '22023';
  end if;

  select subaccount_code into account from public.organization_paystack_accounts
   where organization_id = e.organization_id and status = 'active' and paystack_verified and percentage_charge = 10;
  if not found then
    raise exception 'Verified settlement account required' using errcode = '22023';
  end if;

  ref := 'VCH-WA-' || replace(p_vote_request::text, '-', '');

  insert into public.payment_attempts(
    idempotency_key, event_id, organization_id, category_id, nominee_id, quantity,
    unit_price_minor, total_amount_minor, currency, provider, provider_reference, status, subaccount_code
  )
  values(
    'wa-paystack-' || p_vote_request::text,
    e.id, e.organization_id, p_category, p_nominee, p_quantity,
    e.unit_price_minor, e.unit_price_minor::bigint * p_quantity, 'GHS', 'paystack', ref, 'pending', account
  ) on conflict (idempotency_key) do nothing;

  select * into p from public.payment_attempts where idempotency_key = 'wa-paystack-' || p_vote_request::text;
  if not found or p.event_id <> p_event or p.category_id <> p_category or p.nominee_id <> p_nominee or p.quantity <> p_quantity then
    raise exception 'Payment attempt already reserved' using errcode = '22023';
  end if;

  return p;
end $body$;

revoke all on function public.reserve_paystack_whatsapp_payment(text, uuid, uuid, uuid, integer, uuid) from public, anon, authenticated;
grant execute on function public.reserve_paystack_whatsapp_payment(text, uuid, uuid, uuid, integer, uuid) to service_role;

