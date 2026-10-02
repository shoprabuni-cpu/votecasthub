create table public.sms_credit_purchases (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  reference text not null unique check (reference ~ '^VCH-SMS-[A-Z0-9-]{12,64}$'),
  credits integer not null check (credits in (100,500,1000)),
  amount_minor integer not null check (amount_minor in (2000,8000,15000)),
  status text not null default 'pending' check (status in ('pending','paid','failed')),
  provider_transaction_id bigint,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index sms_credit_purchase_paid_tx_idx on public.sms_credit_purchases(provider_transaction_id) where provider_transaction_id is not null;
alter table public.sms_credit_purchases enable row level security;
create policy sms_credit_purchase_member_read on public.sms_credit_purchases for select to authenticated using (private.is_org_member(organization_id));
revoke insert, update, delete on public.sms_credit_purchases from anon, authenticated;

create table public.organization_sms_credits (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  balance integer not null default 0 check (balance >= 0),
  updated_at timestamptz not null default now()
);
alter table public.organization_sms_credits enable row level security;
create policy sms_credit_balance_member_read on public.organization_sms_credits for select to authenticated using (private.is_org_member(organization_id));
revoke insert, update, delete on public.organization_sms_credits from anon, authenticated;

create function public.fulfill_sms_credit_purchase(p_reference text, p_transaction_id bigint)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_purchase public.sms_credit_purchases; begin
  select * into v_purchase from public.sms_credit_purchases where reference = p_reference for update;
  if not found then return false; end if;
  if v_purchase.status = 'paid' then return true; end if;
  update public.sms_credit_purchases set status='paid', provider_transaction_id=p_transaction_id, paid_at=now() where id=v_purchase.id;
  insert into public.organization_sms_credits(organization_id,balance) values(v_purchase.organization_id,v_purchase.credits)
    on conflict (organization_id) do update set balance=organization_sms_credits.balance + excluded.balance, updated_at=now();
  return true;
end; $$;
revoke all on function public.fulfill_sms_credit_purchase(text,bigint) from public, anon, authenticated;
grant execute on function public.fulfill_sms_credit_purchase(text,bigint) to service_role;
