-- VoteHub GH core schema. Client-facing writes are denied except the validated
-- create_organization RPC. Payment, vote, ledger and audit writes stay server-only.

create schema if not exists private authorization postgres;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text check (display_name is null or char_length(display_name) <= 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 80),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create table public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'editor', 'viewer')),
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);
create index organization_members_user_idx on public.organization_members(user_id, organization_id);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  name text not null check (char_length(btrim(name)) between 2 and 160),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 100),
  description text check (description is null or char_length(description) <= 5000),
  currency text not null default 'GHS' check (currency ~ '^[A-Z]{3}$'),
  unit_price_minor bigint not null check (unit_price_minor between 1 and 1000000000000),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'draft' check (status in ('draft', 'published', 'paused', 'closed', 'archived')),
  results_visibility text not null default 'organizer_only' check (results_visibility in ('organizer_only', 'live', 'after_close', 'hidden')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  unique (organization_id, slug),
  unique (id, organization_id),
  check (starts_at < ends_at),
  check ((status = 'archived') = (archived_at is not null))
);
create index events_public_lookup_idx on public.events(status, starts_at, ends_at) where status in ('published', 'paused', 'closed');
create index events_organization_idx on public.events(organization_id, created_at desc);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete restrict,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  description text check (description is null or char_length(description) <= 2000),
  display_order integer not null default 0 check (display_order >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, name),
  unique (id, event_id)
);
create index categories_event_order_idx on public.categories(event_id, display_order);

create table public.nominees (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories(id) on delete restrict,
  name text not null check (char_length(btrim(name)) between 1 and 160),
  public_code text check (public_code is null or (char_length(public_code) between 1 and 32 and public_code ~ '^[A-Za-z0-9-]+$')),
  biography text check (biography is null or char_length(biography) <= 3000),
  image_path text check (image_path is null or char_length(image_path) <= 512),
  display_order integer not null default 0 check (display_order >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (category_id, name),
  unique (category_id, public_code),
  unique (id, category_id)
);
create index nominees_category_order_idx on public.nominees(category_id, display_order);

create table public.payment_attempts (
  id uuid primary key default gen_random_uuid(),
  idempotency_key text not null unique check (char_length(idempotency_key) between 16 and 128),
  event_id uuid not null,
  organization_id uuid not null,
  category_id uuid not null,
  nominee_id uuid not null,
  quantity integer not null check (quantity between 1 and 10000),
  unit_price_minor bigint not null check (unit_price_minor > 0),
  total_amount_minor bigint not null check (total_amount_minor > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  provider text not null check (char_length(provider) between 1 and 64),
  provider_reference text,
  status text not null default 'created' check (status in ('created', 'pending', 'succeeded', 'failed', 'cancelled', 'expired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  confirmed_at timestamptz,
  unique (provider, provider_reference),
  unique (id, event_id, category_id, nominee_id),
  unique (id, quantity),
  unique (id, organization_id, currency),
  foreign key (event_id, organization_id) references public.events(id, organization_id) on delete restrict,
  foreign key (category_id, event_id) references public.categories(id, event_id) on delete restrict,
  foreign key (nominee_id, category_id) references public.nominees(id, category_id) on delete restrict,
  check (total_amount_minor = unit_price_minor * quantity),
  check ((status = 'succeeded') = (confirmed_at is not null))
);
create index payment_attempts_event_created_idx on public.payment_attempts(event_id, created_at desc);

create table public.vote_batches (
  id uuid primary key default gen_random_uuid(),
  payment_attempt_id uuid not null unique,
  quantity integer not null check (quantity between 1 and 10000),
  created_at timestamptz not null default now(),
  foreign key (payment_attempt_id, quantity) references public.payment_attempts(id, quantity) on delete restrict
);

create table public.ledger_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  payment_attempt_id uuid,
  payout_request_id uuid,
  entry_type text not null check (entry_type in ('gross_collection', 'provider_fee', 'platform_fee', 'organizer_earning', 'refund', 'payout', 'adjustment')),
  amount_minor bigint not null check (amount_minor <> 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  idempotency_key text not null unique check (char_length(idempotency_key) between 16 and 160),
  note text check (note is null or char_length(note) <= 500),
  created_at timestamptz not null default now(),
  foreign key (payment_attempt_id, organization_id, currency) references public.payment_attempts(id, organization_id, currency) on delete restrict,
  check (
    (entry_type in ('gross_collection', 'provider_fee', 'platform_fee', 'organizer_earning', 'refund') and payment_attempt_id is not null and payout_request_id is null)
    or (entry_type = 'payout' and payment_attempt_id is null and payout_request_id is not null)
    or entry_type = 'adjustment'
  )
);
create index ledger_entries_organization_created_idx on public.ledger_entries(organization_id, created_at desc);
create index ledger_entries_payment_idx on public.ledger_entries(payment_attempt_id) where payment_attempt_id is not null;

create table public.payout_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  amount_minor bigint not null check (amount_minor > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  status text not null default 'requested' check (status in ('requested', 'approved', 'processing', 'paid', 'failed', 'rejected', 'cancelled')),
  requested_by uuid references auth.users(id) on delete set null,
  reviewed_by uuid references auth.users(id) on delete set null,
  provider_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  reviewed_at timestamptz,
  paid_at timestamptz,
  unique (id, organization_id, currency),
  check ((status = 'paid') = (paid_at is not null))
);
alter table public.ledger_entries
  add constraint ledger_entries_payout_org_currency_fk
  foreign key (payout_request_id, organization_id, currency)
  references public.payout_requests(id, organization_id, currency) on delete restrict;
create unique index payout_requests_provider_reference_key on public.payout_requests(provider_reference) where provider_reference is not null;
create index payout_requests_org_created_idx on public.payout_requests(organization_id, created_at desc);

create table public.provider_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (char_length(provider) between 1 and 64),
  provider_event_id text not null check (char_length(provider_event_id) between 1 and 256),
  payload_digest text not null check (payload_digest ~ '^[a-f0-9]{64}$'),
  processing_status text not null default 'received' check (processing_status in ('received', 'processed', 'ignored', 'failed')),
  error_code text check (error_code is null or char_length(error_code) <= 80),
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (provider, provider_event_id)
);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  organization_id uuid references public.organizations(id) on delete restrict,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null check (char_length(action) between 1 and 100),
  resource_type text not null check (char_length(resource_type) between 1 and 80),
  resource_id text check (resource_id is null or char_length(resource_id) <= 128),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);
create index audit_logs_org_created_idx on public.audit_logs(organization_id, created_at desc);

create or replace function private.is_org_member(p_organization_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.organization_members as member
    where member.organization_id = p_organization_id and member.user_id = (select auth.uid())
  );
$$;

create or replace function private.can_view_event(p_event_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.events as event
    where event.id = p_event_id
      and (event.status in ('published', 'paused', 'closed') or private.is_org_member(event.organization_id))
  );
$$;

create or replace function private.can_view_category(p_category_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.categories as category
    join public.events as event on event.id = category.event_id
    where category.id = p_category_id
      and ((category.is_active and event.status in ('published', 'paused', 'closed')) or private.is_org_member(event.organization_id))
  );
$$;

create or replace function private.can_view_nominee(p_nominee_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.nominees as nominee
    join public.categories as category on category.id = nominee.category_id
    join public.events as event on event.id = category.event_id
    where nominee.id = p_nominee_id
      and ((nominee.is_active and category.is_active and event.status in ('published', 'paused', 'closed')) or private.is_org_member(event.organization_id))
  );
$$;

create or replace function public.create_organization(p_name text, p_slug text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_user_id uuid := (select auth.uid());
  v_name text := btrim(coalesce(p_name, ''));
  v_slug text := lower(btrim(coalesce(p_slug, '')));
  v_organization_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if char_length(v_name) < 2 or char_length(v_name) > 120 then
    raise exception 'Organization name must be between 2 and 120 characters' using errcode = '22023';
  end if;
  if char_length(v_slug) > 80 or v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    raise exception 'Organization slug is invalid' using errcode = '22023';
  end if;

  insert into public.organizations (name, slug, created_by)
  values (v_name, v_slug, v_user_id)
  on conflict (slug) do nothing
  returning id into v_organization_id;
  if v_organization_id is null then
    raise exception 'Organization slug is already in use' using errcode = '23505';
  end if;

  insert into public.organization_members (organization_id, user_id, role)
  values (v_organization_id, v_user_id, 'owner');
  return v_organization_id;
end;
$$;

create or replace function public.get_organization_events(p_organization_id uuid)
returns table (
  id uuid,
  organization_id uuid,
  name text,
  slug text,
  description text,
  currency text,
  unit_price_minor bigint,
  starts_at timestamptz,
  ends_at timestamptz,
  status text,
  results_visibility text,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select event.id, event.organization_id, event.name, event.slug, event.description,
         event.currency, event.unit_price_minor, event.starts_at, event.ends_at,
         event.status, event.results_visibility, event.created_at, event.updated_at
  from public.events as event
  where event.organization_id = p_organization_id
    and private.is_org_member(p_organization_id)
  order by event.created_at desc;
$$;
create or replace function private.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, left(nullif(btrim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), ''), 80))
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace function private.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function private.ensure_confirmed_payment_for_vote()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_status text;
begin
  select payment.status into v_status
  from public.payment_attempts as payment
  where payment.id = new.payment_attempt_id;
  if v_status is distinct from 'succeeded' then
    raise exception 'A vote batch requires a confirmed payment' using errcode = '23514';
  end if;
  return new;
end;
$$;

create or replace function private.reject_immutable_row_change()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'This record is append-only' using errcode = '55000';
end;
$$;

create trigger on_auth_user_created after insert on auth.users for each row execute function private.handle_new_user();
create trigger vote_batches_require_confirmed_payment before insert on public.vote_batches for each row execute function private.ensure_confirmed_payment_for_vote();
create trigger vote_batches_append_only before update or delete on public.vote_batches for each row execute function private.reject_immutable_row_change();
create trigger ledger_entries_append_only before update or delete on public.ledger_entries for each row execute function private.reject_immutable_row_change();
create trigger audit_logs_append_only before update or delete on public.audit_logs for each row execute function private.reject_immutable_row_change();
create trigger profiles_set_updated_at before update on public.profiles for each row execute function private.set_updated_at();
create trigger organizations_set_updated_at before update on public.organizations for each row execute function private.set_updated_at();
create trigger events_set_updated_at before update on public.events for each row execute function private.set_updated_at();
create trigger categories_set_updated_at before update on public.categories for each row execute function private.set_updated_at();
create trigger nominees_set_updated_at before update on public.nominees for each row execute function private.set_updated_at();
create trigger payment_attempts_set_updated_at before update on public.payment_attempts for each row execute function private.set_updated_at();
create trigger payout_requests_set_updated_at before update on public.payout_requests for each row execute function private.set_updated_at();

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.events enable row level security;
alter table public.categories enable row level security;
alter table public.nominees enable row level security;
alter table public.payment_attempts enable row level security;
alter table public.vote_batches enable row level security;
alter table public.ledger_entries enable row level security;
alter table public.payout_requests enable row level security;
alter table public.provider_events enable row level security;
alter table public.audit_logs enable row level security;

create policy "users read own profile" on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy "users update own display name" on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy "organization members read their organizations" on public.organizations for select to authenticated using (private.is_org_member(id));
create policy "members read organization membership" on public.organization_members for select to authenticated using (user_id = (select auth.uid()) or private.is_org_member(organization_id));
create policy "published event information is readable" on public.events for select to anon, authenticated using (private.can_view_event(id));
create policy "visible event categories are readable" on public.categories for select to anon, authenticated using (private.can_view_category(id));
create policy "visible event nominees are readable" on public.nominees for select to anon, authenticated using (private.can_view_nominee(id));

revoke all on all tables in schema public from anon, authenticated;
grant select (id, display_name, created_at, updated_at) on public.profiles to authenticated;
grant update (display_name) on public.profiles to authenticated;
grant select on public.organizations, public.organization_members to authenticated;
grant select (id, name, slug, description, currency, unit_price_minor, starts_at, ends_at, status, results_visibility) on public.events to anon;
grant select (id, event_id, name, description, display_order, is_active) on public.categories to anon;
grant select (id, category_id, name, public_code, biography, image_path, display_order, is_active) on public.nominees to anon;
grant select (id, name, slug, description, currency, unit_price_minor, starts_at, ends_at, status, results_visibility) on public.events to authenticated;
grant select on public.categories, public.nominees to authenticated;

revoke execute on all functions in schema private from public, anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function private.is_org_member(uuid) to authenticated;
grant execute on function private.can_view_event(uuid) to anon, authenticated;
grant execute on function private.can_view_category(uuid) to anon, authenticated;
grant execute on function private.can_view_nominee(uuid) to anon, authenticated;
grant execute on function public.create_organization(text, text) to authenticated;
grant execute on function public.get_organization_events(uuid) to authenticated;

alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;




