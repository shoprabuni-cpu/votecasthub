alter table public.payment_attempts drop constraint if exists payment_attempts_status_check;
alter table public.payment_attempts add constraint payment_attempts_status_check check (status in ('created','pending','succeeded','failed','cancelled','expired','refunded','reversed'));

create or replace function public.confirm_paid_vote(p_reference text, p_transaction_id bigint, p_paid_amount_minor bigint, p_provider_fee_minor bigint default 0)
returns void language plpgsql security definer set search_path = public as $$
declare p payment_attempts%rowtype; platform bigint; net bigint;
begin
 select * into p from payment_attempts where provider='paystack' and provider_reference=p_reference for update;
 if not found then raise exception 'Payment attempt not found'; end if;
 if p.status='succeeded' then return; end if;
 if p_paid_amount_minor <> p.total_amount_minor then raise exception 'Payment amount mismatch'; end if;
 platform := floor(p.total_amount_minor * 0.10); net := p.total_amount_minor - platform - greatest(p_provider_fee_minor,0);
 update payment_attempts set status='succeeded', confirmed_at=coalesce(confirmed_at,now()), updated_at=now() where id=p.id;
 insert into vote_batches(payment_attempt_id,quantity) values(p.id,p.quantity) on conflict do nothing;
 insert into ledger_entries(organization_id,payment_attempt_id,entry_type,amount_minor,currency,idempotency_key,note) values
 (p.organization_id,p.id,'gross_collection',p.total_amount_minor,p.currency,p.idempotency_key||':gross','Paystack paid vote'),
 (p.organization_id,p.id,'provider_fee',-greatest(p_provider_fee_minor,0),p.currency,p.idempotency_key||':provider','Paystack fee'),
 (p.organization_id,p.id,'platform_fee',-platform,p.currency,p.idempotency_key||':platform','VotecastHub 10% platform fee'),
 (p.organization_id,p.id,'organizer_earning',net,p.currency,p.idempotency_key||':net','Organizer net earnings');
end $$;

create or replace function public.get_organization_paid_earnings(p_organization_id uuid)
returns table(gross_minor bigint, provider_fee_minor bigint, platform_fee_minor bigint, net_minor bigint, payment_count bigint)
language sql security definer set search_path=public as $$
 select coalesce(sum(case when entry_type='gross_collection' then amount_minor else 0 end),0),
 coalesce(sum(case when entry_type='provider_fee' then -amount_minor else 0 end),0),
 coalesce(sum(case when entry_type='platform_fee' then -amount_minor else 0 end),0),
 coalesce(sum(case when entry_type='organizer_earning' then amount_minor else 0 end),0),
 count(*) filter (where entry_type='gross_collection')
 from ledger_entries where organization_id=p_organization_id;
$$;
grant execute on function public.confirm_paid_vote(text,bigint,bigint,bigint) to service_role;
grant execute on function public.get_organization_paid_earnings(uuid) to authenticated;
