create table public.organization_paystack_accounts (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  subaccount_code text not null unique check (subaccount_code ~ '^ACCT_[A-Za-z0-9]+$'),
  business_name text not null check (char_length(business_name) between 2 and 160),
  settlement_bank text not null,
  account_last4 text not null check (account_last4 ~ '^\d{4}$'),
  percentage_charge numeric(5,2) not null default 10 check (percentage_charge = 10),
  status text not null default 'pending' check (status in ('pending','active','inactive','rejected')),
  paystack_verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.organization_paystack_accounts enable row level security;
create policy paystack_account_member_read on public.organization_paystack_accounts for select to authenticated using (private.is_org_member(organization_id));
revoke insert, update, delete on public.organization_paystack_accounts from anon, authenticated;

create table public.paid_vote_ledger (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  event_id uuid not null references public.events(id) on delete restrict,
  reference text not null unique,
  gross_amount_minor bigint not null check (gross_amount_minor > 0),
  platform_fee_minor bigint not null check (platform_fee_minor >= 0),
  provider_fee_minor bigint not null default 0 check (provider_fee_minor >= 0),
  organizer_net_minor bigint not null check (organizer_net_minor >= 0),
  status text not null default 'pending' check (status in ('pending','confirmed','reversed','refunded')),
  provider_transaction_id bigint unique,
  created_at timestamptz not null default now(),
  confirmed_at timestamptz
);
alter table public.paid_vote_ledger enable row level security;
create policy paid_ledger_member_read on public.paid_vote_ledger for select to authenticated using (private.is_org_member(organization_id));
revoke insert, update, delete on public.paid_vote_ledger from anon, authenticated;

create function public.can_publish_paid_event(p_event_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.events e join public.organization_paystack_accounts a on a.organization_id=e.organization_id
    where e.id=p_event_id and a.status='active' and a.paystack_verified=true and a.percentage_charge=10);
$$;
revoke all on function public.can_publish_paid_event(uuid) from public, anon;
grant execute on function public.can_publish_paid_event(uuid) to authenticated;

-- Keep the existing event-status RPC's paid-event rule authoritative by replacing
-- its old payment-provider placeholder in the next migration.
