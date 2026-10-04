-- One current account per organization; previous destinations remain auditable.
create table public.payment_account_operations (
 organization_id uuid primary key references public.organizations(id),
 token uuid not null unique,
 kind text not null check (kind in ('create','update','deactivate','refresh')),
 created_at timestamptz not null default now()
);
create table public.payment_account_history (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id),
 account jsonb not null,
 recorded_at timestamptz not null default now()
);
alter table public.payment_account_operations enable row level security;
alter table public.payment_account_history enable row level security;
revoke all on public.payment_account_operations, public.payment_account_history from anon, authenticated;
grant all on public.payment_account_operations, public.payment_account_history to service_role;

create function public.begin_payment_account_change(p_organization_id uuid,p_token uuid,p_kind text)
returns void language plpgsql security definer set search_path='' as $$
declare a public.organization_paystack_accounts;
begin
 perform 1 from public.organizations where id=p_organization_id for update;
 insert into public.payment_account_operations(organization_id,token,kind) values(p_organization_id,p_token,p_kind);
 select * into a from public.organization_paystack_accounts where organization_id=p_organization_id;
 if p_kind='create' and a.organization_id is not null and a.status<>'inactive' then
  raise exception 'Deactivate the current payment account before creating another.';
 end if;
 if p_kind in ('update','deactivate') and (a.organization_id is null or a.status='inactive') then
  raise exception 'No current payment account is available to change.';
 end if;
 if p_kind in ('update','deactivate','create') and exists(
  select 1 from public.payment_attempts where organization_id=p_organization_id and provider='paystack' and status in ('created','pending')
 ) then raise exception 'Pending vote payments must be reconciled before changing the payment account.'; end if;
 if p_kind='create' and a.status='inactive' then
  delete from public.paystack_account_requests where organization_id=p_organization_id;
 end if;
end $$;
revoke all on function public.begin_payment_account_change(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.begin_payment_account_change(uuid,uuid,text) to service_role;

create function public.guard_payment_account_checkout()
returns trigger language plpgsql security definer set search_path='' as $$
declare a public.organization_paystack_accounts;
begin
 if new.provider <> 'paystack' then return new; end if;
 perform 1 from public.organizations where id=new.organization_id for update;
 if exists(select 1 from public.payment_account_operations where organization_id=new.organization_id) then
  raise exception 'Payment account is being updated. Please try again shortly.';
 end if;
 select * into a from public.organization_paystack_accounts where organization_id=new.organization_id;
 if a.organization_id is null or a.status<>'active' or not a.paystack_verified or a.percentage_charge<>10 then
  raise exception 'A verified payment account is required.';
 end if;
 if new.subaccount_code is not null and new.subaccount_code<>a.subaccount_code then
  raise exception 'Payment account changed. Start a new checkout.';
 end if;
 new.subaccount_code:=a.subaccount_code;
 return new;
end $$;
create trigger guard_payment_account_checkout before insert on public.payment_attempts for each row execute function public.guard_payment_account_checkout();

create function public.record_payment_account_history()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.payment_account_history(organization_id,account) values(old.organization_id,to_jsonb(old));
 -- Preserve destinations for older payments before replacing the current account.
 update public.payment_attempts set subaccount_code=old.subaccount_code where organization_id=old.organization_id and provider='paystack' and subaccount_code is null;
 return new;
end $$;
create trigger record_payment_account_history before update on public.organization_paystack_accounts for each row execute function public.record_payment_account_history();

create or replace function public.can_publish_paid_event(p_event_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.events e join public.organization_paystack_accounts a on a.organization_id=e.organization_id
 where e.id=p_event_id and a.status='active' and a.paystack_verified and a.percentage_charge=10
 and not exists(select 1 from public.payment_account_operations o where o.organization_id=e.organization_id));
$$;
