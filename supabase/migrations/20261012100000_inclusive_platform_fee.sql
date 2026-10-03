-- One durable reservation prevents concurrent/retried requests creating extra Paystack accounts.
alter table public.organization_paystack_accounts
  add column account_name text,
  add column account_type text check (account_type in ('ghipss','mobile_money'));
create table public.paystack_account_requests (
  organization_id uuid primary key references public.organizations(id),
  created_at timestamptz not null default now()
);
alter table public.paystack_account_requests enable row level security;
revoke all on public.paystack_account_requests from anon, authenticated;
grant all on public.paystack_account_requests to service_role;
create or replace function public.confirm_paid_vote(p_reference text, p_transaction_id bigint, p_paid_amount_minor bigint, p_provider_fee_minor bigint default 0)
returns void language plpgsql security definer set search_path = public as $$
declare p payment_attempts%rowtype; platform bigint; net bigint;
begin
 select * into p from payment_attempts where provider='paystack' and provider_reference=p_reference for update;
 if not found then raise exception 'Payment attempt not found'; end if;
 if p.status in ('succeeded','refunded','reversed') then return; end if;
 if p_provider_fee_minor is null or p_provider_fee_minor < 0 then raise exception 'Invalid provider fee'; end if;
 if p_paid_amount_minor is distinct from p.total_amount_minor then raise exception 'Payment amount mismatch'; end if;
 platform := floor(p.total_amount_minor * 0.10); net := p.total_amount_minor - platform;
 update payment_attempts set status='succeeded', confirmed_at=coalesce(confirmed_at,now()), updated_at=now() where id=p.id;
 insert into vote_batches(payment_attempt_id,event_id,category_id,nominee_id,quantity) values(p.id,p.event_id,p.category_id,p.nominee_id,p.quantity) on conflict do nothing;
 insert into ledger_entries(organization_id,payment_attempt_id,entry_type,amount_minor,currency,idempotency_key,note) select * from (values
 (p.organization_id,p.id,'gross_collection',p.total_amount_minor,p.currency,p.idempotency_key||':gross','Paystack paid vote'),
 (p.organization_id,p.id,'provider_fee',-greatest(p_provider_fee_minor,0),p.currency,p.idempotency_key||':provider','Paystack fee included in platform share; not an organizer deduction'),
 (p.organization_id,p.id,'platform_fee',-platform,p.currency,p.idempotency_key||':platform','VotecastHub 10% platform fee'),
 (p.organization_id,p.id,'organizer_earning',net,p.currency,p.idempotency_key||':net','Organizer net earnings')) as entries(org,attempt,kind,amount,currency,key,note) where amount <> 0;
 insert into paid_vote_ledger(organization_id,event_id,reference,gross_amount_minor,platform_fee_minor,provider_fee_minor,organizer_net_minor,status,provider_transaction_id,confirmed_at)
 values(p.organization_id,p.event_id,p.provider_reference,p.total_amount_minor,platform,greatest(p_provider_fee_minor,0),net,'confirmed',p_transaction_id,now())
 on conflict (reference) do nothing;
end $$;


revoke all on function public.confirm_paid_vote(text,bigint,bigint,bigint) from public, anon, authenticated;
grant execute on function public.confirm_paid_vote(text,bigint,bigint,bigint) to service_role;
do $$ begin
  if to_regprocedure('public.reverse_paid_vote(text,text)') is not null then
    revoke all on function public.reverse_paid_vote(text,text) from public, anon, authenticated;
    revoke execute on function public.reverse_paid_vote(text,text) from service_role;
  end if;
end $$;

-- Preserve historical entries. Correct prior understatements with explicit adjustments.
insert into public.ledger_entries(organization_id,payment_attempt_id,entry_type,amount_minor,currency,idempotency_key,note)
select l.organization_id,p.id,'adjustment',l.gross_amount_minor-l.platform_fee_minor-l.organizer_net_minor,p.currency,
  p.idempotency_key||':inclusive-fee-correction','Paystack fees borne by platform; organizer share correction'
from public.paid_vote_ledger l join public.payment_attempts p on p.provider_reference=l.reference and p.provider='paystack'
where l.gross_amount_minor-l.platform_fee_minor-l.organizer_net_minor <> 0
on conflict(idempotency_key) do nothing;
update public.paid_vote_ledger set organizer_net_minor=gross_amount_minor-platform_fee_minor;

create or replace function public.get_organization_paid_earnings(p_organization_id uuid)
returns table(gross_minor bigint,provider_fee_minor bigint,platform_fee_minor bigint,net_minor bigint,payment_count bigint)
language plpgsql security definer set search_path='' as $$
begin
 if not private.is_org_member(p_organization_id) then raise exception 'Organization access denied' using errcode='42501'; end if;
 return query select coalesce(sum(l.gross_amount_minor),0)::bigint,coalesce(sum(l.provider_fee_minor),0)::bigint,
 coalesce(sum(l.platform_fee_minor),0)::bigint,coalesce(sum(l.organizer_net_minor),0)::bigint,count(*)
 from public.paid_vote_ledger l where l.organization_id=p_organization_id and l.status='confirmed';
end $$;
revoke all on function public.get_organization_paid_earnings(uuid) from public,anon;
grant execute on function public.get_organization_paid_earnings(uuid) to authenticated;

