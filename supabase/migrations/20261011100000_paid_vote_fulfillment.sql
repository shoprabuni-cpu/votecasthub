alter table public.payment_attempts drop constraint if exists payment_attempts_status_check;
alter table public.payment_attempts add constraint payment_attempts_status_check check (status in ('created','pending','succeeded','failed','cancelled','expired','refunded','reversed'));
alter table public.vote_batches add column if not exists reversed_at timestamptz;

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
 insert into vote_batches(payment_attempt_id,event_id,category_id,nominee_id,quantity) values(p.id,p.event_id,p.category_id,p.nominee_id,p.quantity) on conflict do nothing;
 insert into ledger_entries(organization_id,payment_attempt_id,entry_type,amount_minor,currency,idempotency_key,note) values
 (p.organization_id,p.id,'gross_collection',p.total_amount_minor,p.currency,p.idempotency_key||':gross','Paystack paid vote'),
 (p.organization_id,p.id,'provider_fee',-greatest(p_provider_fee_minor,0),p.currency,p.idempotency_key||':provider','Paystack fee'),
 (p.organization_id,p.id,'platform_fee',-platform,p.currency,p.idempotency_key||':platform','VotecastHub 10% platform fee'),
 (p.organization_id,p.id,'organizer_earning',net,p.currency,p.idempotency_key||':net','Organizer net earnings');
 insert into paid_vote_ledger(organization_id,event_id,reference,gross_amount_minor,platform_fee_minor,provider_fee_minor,organizer_net_minor,status,provider_transaction_id,confirmed_at)
 values(p.organization_id,p.event_id,p.provider_reference,p.total_amount_minor,platform,greatest(p_provider_fee_minor,0),net,'confirmed',p_transaction_id,now())
 on conflict (reference) do nothing;
end $$;

create or replace function public.reverse_paid_vote(p_reference text, p_status text default 'refunded')
returns void language plpgsql security definer set search_path=public as $$
declare p payment_attempts%rowtype;
begin
 if p_status not in ('refunded','reversed') then raise exception 'Invalid reversal status'; end if;
 select * into p from payment_attempts where provider='paystack' and provider_reference=p_reference for update;
 if not found or p.status in ('refunded','reversed') then return; end if;
 update payment_attempts set status=p_status, updated_at=now() where id=p.id;
 update vote_batches set reversed_at=now() where payment_attempt_id=p.id and reversed_at is null;
 update paid_vote_ledger set status=p_status where reference=p_reference;
 insert into ledger_entries(organization_id,payment_attempt_id,entry_type,amount_minor,currency,idempotency_key,note)
 values(p.organization_id,p.id,'refund',-p.total_amount_minor,p.currency,p.idempotency_key||':refund','Paystack payment reversed or refunded') on conflict do nothing;
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
grant execute on function public.reverse_paid_vote(text,text) to service_role;

create or replace function public.get_public_event_results(p_event_id uuid)
returns table (nominee_id uuid, vote_count bigint)
language sql stable security definer set search_path = '' as $$
  select nominee.id, coalesce(sum(batch.quantity), 0)::bigint
  from public.events as event
  join public.categories as category on category.event_id = event.id and category.is_active
  join public.nominees as nominee on nominee.category_id = category.id and nominee.is_active
  left join public.vote_batches as batch on batch.nominee_id = nominee.id and batch.reversed_at is null
  where event.id = p_event_id
    and ((event.results_visibility = 'live' and event.status = 'published' and now() >= event.starts_at and now() < event.ends_at)
      or (event.results_visibility = 'after_close' and (event.status in ('closed', 'archived') or now() >= event.ends_at)))
  group by nominee.id, nominee.display_order order by nominee.display_order;
$$;

create or replace function public.set_event_status(p_event_id uuid, p_action text)
returns text language plpgsql security definer set search_path = '' as $$
declare e public.events%rowtype; s text;
begin
 select * into e from public.events where id=p_event_id for update;
 if not found then raise exception 'Event not found'; end if;
 if not private.can_manage_org(e.organization_id) then raise exception 'Organization access denied'; end if;
 if p_action='publish' and e.status='draft' then
   if e.ends_at<=now() then raise exception 'Voting period must end in the future before publication'; end if;
   if e.voting_mode='paid' and not public.can_publish_paid_event(p_event_id) then raise exception 'Verify the organizer Paystack subaccount before publishing paid voting'; end if;
   if e.voting_mode='free' and e.voting_rule='one_per_category' and e.free_vote_limit_per_phone<>1 then raise exception 'One vote per category must use a limit of one'; end if;
   if not exists(select 1 from public.categories c where c.event_id=p_event_id and c.is_active) then raise exception 'Add an active category before publishing'; end if;
   if exists(select 1 from public.categories c where c.event_id=p_event_id and c.is_active and not exists(select 1 from public.nominees n where n.category_id=c.id and n.is_active)) then raise exception 'Every active category needs an active nominee'; end if;
   s='published';
 elsif p_action='pause' and e.status='published' then s='paused'; elsif p_action='resume' and e.status='paused' and e.ends_at>now() then s='published'; elsif p_action='close' and e.status in ('published','paused') then s='closed'; else raise exception 'This event status change is not allowed'; end if;
 update public.events set status=s where id=p_event_id; return s;
end $$;
