-- Payment adjustments preserve original vote batches and accounting entries.
alter table public.vote_batches add column if not exists reversed_at timestamptz;
create table public.payment_adjustments (
  provider_key text primary key,
  reference text not null,
  kind text not null check(kind in ('refund','reversal')),
  amount_minor bigint not null check(amount_minor>0),
  created_at timestamptz not null default now()
);
alter table public.payment_adjustments enable row level security;
revoke all on public.payment_adjustments from public,anon,authenticated;
grant all on public.payment_adjustments to service_role;
alter table public.paid_vote_ledger add column refunded_amount_minor bigint not null default 0 check(refunded_amount_minor>=0);
alter table public.payment_attempts add column subaccount_code text;
alter table public.sms_credit_purchases add column refunded_amount_minor bigint not null default 0;
-- Negative credit balances represent already-consumed credits subsequently refunded.
alter table public.organization_sms_credits drop constraint organization_sms_credits_balance_check;

create or replace function public.apply_payment_adjustment(p_reference text,p_provider_key text,p_amount_minor bigint,p_kind text)
returns void language plpgsql security definer set search_path='' as $$
declare p public.payment_attempts%rowtype; s public.sms_credit_purchases%rowtype; old_total bigint; new_total bigint; old_net bigint; new_net bigint; full_amount bigint; org uuid;
begin
 if p_kind not in ('refund','reversal') or p_amount_minor is null or p_amount_minor<=0 or length(p_provider_key)>160 then raise exception 'Invalid adjustment'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_reference,0));
 select * into p from public.payment_attempts where provider='paystack' and provider_reference=p_reference for update;
 if found then
  if p.confirmed_at is null then raise exception 'Confirm payment before adjustment'; end if;
  full_amount:=p.total_amount_minor; org:=p.organization_id;
 else
  select * into s from public.sms_credit_purchases where reference=p_reference for update;
  if not found or s.status<>'paid' then raise exception 'Confirm purchase before adjustment'; end if;
  full_amount:=s.amount_minor; org:=s.organization_id;
 end if;
 if p_amount_minor>full_amount then raise exception 'Adjustment exceeds payment'; end if;
 if exists(select 1 from public.payment_adjustments where provider_key=p_provider_key) then
  if not exists(select 1 from public.payment_adjustments where provider_key=p_provider_key and reference=p_reference and amount_minor=p_amount_minor and kind=p_kind) then raise exception 'Adjustment identity mismatch'; end if;
  return;
 end if;
 select least(full_amount,coalesce(sum(amount_minor),0)) into old_total from public.payment_adjustments where reference=p_reference;
 insert into public.payment_adjustments(provider_key,reference,kind,amount_minor) values(p_provider_key,p_reference,p_kind,p_amount_minor);
 select least(full_amount,coalesce(sum(amount_minor),0)) into new_total from public.payment_adjustments where reference=p_reference;
 if p.id is not null then
  old_net:=full_amount-old_total-floor((full_amount-old_total)/10.0);
  new_net:=full_amount-new_total-floor((full_amount-new_total)/10.0);
  update public.paid_vote_ledger set refunded_amount_minor=new_total,organizer_net_minor=new_net,
   status=case when new_total=full_amount then case when p_kind='reversal' then 'reversed' else 'refunded' end else 'confirmed' end where reference=p_reference;
  if new_total>old_total then
   insert into public.ledger_entries(organization_id,payment_attempt_id,entry_type,amount_minor,currency,idempotency_key,note)
    values(org,p.id,'refund',-(new_total-old_total),p.currency,p.id::text||':adjust:'||md5(p_provider_key),'Confirmed provider refund/reversal');
   if old_net<>new_net then
    insert into public.ledger_entries(organization_id,payment_attempt_id,entry_type,amount_minor,currency,idempotency_key,note)
     values(org,p.id,'adjustment',new_net-old_net,p.currency,p.id::text||':net:'||md5(p_provider_key),'Organizer earning adjustment for refund/reversal');
   end if;
  end if;
 else
  update public.organization_sms_credits set balance=balance-(ceil(s.credits*new_total::numeric/full_amount)-ceil(s.credits*old_total::numeric/full_amount))::integer,updated_at=now() where organization_id=org;
  update public.sms_credit_purchases set refunded_amount_minor=new_total where id=s.id;
 end if;
end $$;
revoke all on function public.apply_payment_adjustment(text,text,bigint,text) from public,anon,authenticated;
grant execute on function public.apply_payment_adjustment(text,text,bigint,text) to service_role;
-- Remove the old unsafe reversal entry point; no append-only rows are mutated.
do $$ begin
  if to_regprocedure('public.reverse_paid_vote(text,text)') is not null then
    revoke all on function public.reverse_paid_vote(text,text) from public,anon,authenticated,service_role;
  end if;
end $$;

create or replace function public.get_public_event_results(p_event_id uuid)
returns table(nominee_id uuid,vote_count bigint) language sql stable security definer set search_path='' as $$
 select n.id,coalesce(sum(case when b.payment_attempt_id is null then b.quantity
  else greatest(0,p.quantity-ceil(coalesce(l.refunded_amount_minor,0)::numeric/p.unit_price_minor)) end),0)::bigint
 from public.events e join public.categories c on c.event_id=e.id and c.is_active
 join public.nominees n on n.category_id=c.id and n.is_active
 left join public.vote_batches b on b.nominee_id=n.id and b.reversed_at is null
 left join public.payment_attempts p on p.id=b.payment_attempt_id
 left join public.paid_vote_ledger l on l.reference=p.provider_reference
 where e.id=p_event_id and (
  (e.results_visibility='live' and e.status in ('published','paused','closed') and now()>=e.starts_at)
  or(e.results_visibility='after_close' and(e.status in ('closed','archived') or now()>=e.ends_at)))
 group by n.id,n.display_order order by n.display_order;
$$;
create or replace function public.get_organization_paid_earnings(p_organization_id uuid)
returns table(gross_minor bigint,provider_fee_minor bigint,platform_fee_minor bigint,net_minor bigint,payment_count bigint)
language plpgsql security definer set search_path='' as $$
begin
 if not private.is_org_member(p_organization_id) then raise exception 'Organization access denied' using errcode='42501'; end if;
 return query select coalesce(sum(l.gross_amount_minor-l.refunded_amount_minor),0)::bigint,coalesce(sum(l.provider_fee_minor),0)::bigint,
 coalesce(sum(floor((l.gross_amount_minor-l.refunded_amount_minor)/10.0)),0)::bigint,
 coalesce(sum(l.organizer_net_minor),0)::bigint,count(*) from public.paid_vote_ledger l where l.organization_id=p_organization_id;
end $$;

create table public.checkout_sessions (
 request_key uuid primary key, fingerprint text not null, reference text not null unique,
 authorization_url text, created_at timestamptz not null default now()
);
create table public.payment_rate_limits(bucket text primary key, hits integer not null, expires_at timestamptz not null);
create table public.payment_jobs (
 id text primary key, kind text not null, resource text not null,
 processed_at timestamptz, attempts integer not null default 0, created_at timestamptz not null default now()
);
create table public.payment_operations (
 name text primary key, last_success_at timestamptz not null default now()
);
alter table public.checkout_sessions enable row level security;
alter table public.payment_rate_limits enable row level security;
alter table public.payment_jobs enable row level security;
alter table public.payment_operations enable row level security;
revoke all on public.checkout_sessions,public.payment_rate_limits,public.payment_jobs,public.payment_operations from public,anon,authenticated;
grant all on public.checkout_sessions,public.payment_rate_limits,public.payment_jobs,public.payment_operations to service_role;
create function public.payment_rate_limit(p_bucket text,p_limit integer,p_seconds integer)
returns boolean language plpgsql security definer set search_path='' as $$
declare hits integer;
begin
 if p_limit<1 or p_seconds<1 or length(p_bucket)>200 then raise exception 'Invalid limit'; end if;
 insert into public.payment_rate_limits as r(bucket,hits,expires_at) values(p_bucket,1,now()+make_interval(secs=>p_seconds))
 on conflict(bucket) do update set hits=case when r.expires_at<=now() then 1 else r.hits+1 end,
 expires_at=case when r.expires_at<=now() then now()+make_interval(secs=>p_seconds) else r.expires_at end returning r.hits into hits;
 return hits<=p_limit;
end $$;
revoke all on function public.payment_rate_limit(text,integer,integer) from public,anon,authenticated;
grant execute on function public.payment_rate_limit(text,integer,integer) to service_role;

-- Enforce SMS package/amount pairing even for server callers.
alter table public.sms_credit_purchases add constraint sms_package_price check((credits=100 and amount_minor=2000)or(credits=500 and amount_minor=8000)or(credits=1000 and amount_minor=15000));
alter table public.payment_jobs add column last_attempt_at timestamptz;
alter table public.payment_operations add column cursor_page integer not null default 1;
create function public.get_payment_history(p_org uuid,p_offset integer default 0)
returns table(reference text,created_at timestamptz,status text,gross bigint,refunded bigint,platform bigint,provider bigint,net bigint)
language plpgsql security definer set search_path='' as $$
begin
 if not private.is_org_member(p_org) then raise exception 'Organization access denied' using errcode='42501'; end if;
 return query select p.provider_reference,p.created_at,
 case when l.refunded_amount_minor>0 and l.refunded_amount_minor<l.gross_amount_minor then 'partially refunded' else coalesce(l.status,p.status) end,
 p.total_amount_minor,coalesce(l.refunded_amount_minor,0),coalesce(floor((l.gross_amount_minor-l.refunded_amount_minor)/10.0)::bigint,0),coalesce(l.provider_fee_minor,0),coalesce(l.organizer_net_minor,0)
 from public.payment_attempts p left join public.paid_vote_ledger l on l.reference=p.provider_reference
 where p.organization_id=p_org order by p.created_at desc,p.id limit 25 offset greatest(0,least(p_offset,100000));
end $$;
revoke all on function public.get_payment_history(uuid,integer) from public,anon;
grant execute on function public.get_payment_history(uuid,integer) to authenticated;


create function public.enqueue_pending_payments() returns void language sql security definer set search_path='' as $$
 insert into public.payment_jobs(id,kind,resource)
 select 'charge.success:'||provider_reference,'charge.success',provider_reference from public.payment_attempts where status in ('created','pending') and provider_reference is not null and created_at>now()-interval '30 days'
 union all select 'charge.success:'||reference,'charge.success',reference from public.sms_credit_purchases where status='pending' and created_at>now()-interval '30 days'
 on conflict(id) do nothing;
$$;
revoke all on function public.enqueue_pending_payments() from public,anon,authenticated;
grant execute on function public.enqueue_pending_payments() to service_role;
