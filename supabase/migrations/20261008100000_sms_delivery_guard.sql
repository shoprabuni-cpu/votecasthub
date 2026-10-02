-- No raw phone numbers, codes, or provider keys are stored here.
-- No FK to auth.users: Auth invokes HTTP hooks inside its own transaction.
create table public.sms_delivery_attempts (
  request_hash text primary key check (request_hash ~ '^[a-f0-9]{64}$'),
  recipient_hash text not null check (recipient_hash ~ '^[a-f0-9]{64}$'),
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  created_at timestamptz not null default clock_timestamp()
);
create index sms_delivery_attempts_created_idx on public.sms_delivery_attempts(created_at);
create index sms_delivery_attempts_recipient_idx on public.sms_delivery_attempts(recipient_hash, created_at);
alter table public.sms_delivery_attempts enable row level security;
revoke all on public.sms_delivery_attempts from public, anon, authenticated;
grant select, insert, update, delete on public.sms_delivery_attempts to service_role;

create function public.claim_sms_delivery(p_request_hash text, p_recipient_hash text, p_daily_limit integer)
returns text language plpgsql security invoker set search_path = '' as $$
declare
  v_status text;
  v_now timestamptz;
begin
  if p_request_hash is null or p_request_hash !~ '^[a-f0-9]{64}$'
    or p_recipient_hash is null or p_recipient_hash !~ '^[a-f0-9]{64}$'
    or p_daily_limit is null or p_daily_limit < 1 or p_daily_limit > 10000 then
    raise exception 'Invalid SMS guard input' using errcode = '22023';
  end if;
  -- Serialize only the short reservation, never an external HTTP call.
  perform pg_catalog.pg_advisory_xact_lock(81732, 1);
  v_now := clock_timestamp();
  delete from public.sms_delivery_attempts where created_at < v_now - interval '2 days';
  select status into v_status from public.sms_delivery_attempts where request_hash = p_request_hash;
  if found then return v_status; end if;

  -- Failed and uncertain sends also consume the budget, preventing retry abuse.
  if exists (select 1 from public.sms_delivery_attempts
      where recipient_hash = p_recipient_hash and created_at > v_now - interval '60 seconds')
    or (select count(*) from public.sms_delivery_attempts
      where recipient_hash = p_recipient_hash and created_at > v_now - interval '1 hour') >= 5
    or (select count(*) from public.sms_delivery_attempts
      where recipient_hash = p_recipient_hash and created_at > v_now - interval '24 hours') >= 10
    or (select count(*) from public.sms_delivery_attempts
      where created_at > v_now - interval '24 hours') >= p_daily_limit then
    return 'rate_limited';
  end if;
  insert into public.sms_delivery_attempts(request_hash, recipient_hash, created_at)
    values (p_request_hash, p_recipient_hash, v_now);
  return 'claimed';
end;
$$;

create function public.finish_sms_delivery(p_request_hash text, p_sent boolean)
returns void language sql security invoker set search_path = '' as $$
  update public.sms_delivery_attempts
    set status = case when p_sent then 'sent' else 'failed' end
    where request_hash = p_request_hash and status = 'pending';
$$;

revoke all on function public.claim_sms_delivery(text, text, integer) from public, anon, authenticated;
revoke all on function public.finish_sms_delivery(text, boolean) from public, anon, authenticated;
grant execute on function public.claim_sms_delivery(text, text, integer) to service_role;
grant execute on function public.finish_sms_delivery(text, boolean) to service_role;
