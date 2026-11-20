-- ============================================================================
-- Migration: Public Call for Nominations & Vetting Portal
-- Allows organizers to open public nominations (free or with Paystack MoMo filing fee),
-- and enables contestants/fans to submit entries that organizers review and approve with one click.
-- ============================================================================

-- 1. Extend events table with nomination settings
alter table public.events
  add column if not exists nominations_enabled boolean not null default false,
  add column if not exists nomination_fee_minor integer not null default 0 check (nomination_fee_minor >= 0),
  add column if not exists nominations_starts_at timestamptz,
  add column if not exists nominations_ends_at timestamptz,
  add column if not exists allow_self_nomination boolean not null default true,
  add column if not exists allow_third_party_nomination boolean not null default true;

-- 2. Create the event_nominations table
create table if not exists public.event_nominations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  nominee_name text not null check (length(trim(nominee_name)) > 0 and length(nominee_name) <= 120),
  nominee_phone text not null check (length(nominee_phone) <= 32),
  nominee_email text check (nominee_email is null or length(nominee_email) <= 320),
  nominee_bio text check (nominee_bio is null or length(nominee_bio) <= 2000),
  image_path text check (image_path is null or length(image_path) <= 512),
  portfolio_url text check (portfolio_url is null or length(portfolio_url) <= 1000),
  nominator_type text not null default 'self' check (nominator_type in ('self', 'third_party')),
  nominator_name text check (nominator_name is null or length(nominator_name) <= 120),
  nominator_phone text check (nominator_phone is null or length(nominator_phone) <= 32),
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined', 'pending_payment')),
  payment_attempt_id uuid references public.payment_attempts(id) on delete set null,
  approved_nominee_id uuid references public.nominees(id) on delete set null,
  review_notes text check (review_notes is null or length(review_notes) <= 1000),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3. Indexes for rapid dashboard lookups
create index if not exists event_nominations_event_status_idx
  on public.event_nominations(event_id, status);

create index if not exists event_nominations_category_idx
  on public.event_nominations(category_id);

-- 4. Enable RLS
alter table public.event_nominations enable row level security;

-- Organizers can select nominations for their events
create policy "organizers can read nominations for their events"
  on public.event_nominations
  for select
  to authenticated
  using (
    exists (
      select 1 from public.events e
      join public.organization_members m on m.organization_id = e.organization_id
      where e.id = event_nominations.event_id and m.user_id = (select auth.uid())
    )
    or exists (
      select 1 from public.platform_admins a where a.user_id = (select auth.uid())
    )
  );

-- Organizers can update nominations (review, approve, decline)
create policy "organizers can update nominations for their events"
  on public.event_nominations
  for update
  to authenticated
  using (
    exists (
      select 1 from public.events e
      join public.organization_members m on m.organization_id = e.organization_id
      where e.id = event_nominations.event_id and m.user_id = (select auth.uid())
    )
    or exists (
      select 1 from public.platform_admins a where a.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.events e
      join public.organization_members m on m.organization_id = e.organization_id
      where e.id = event_nominations.event_id and m.user_id = (select auth.uid())
    )
    or exists (
      select 1 from public.platform_admins a where a.user_id = (select auth.uid())
    )
  );

-- Grants
grant select, update on public.event_nominations to authenticated;
grant insert on public.event_nominations to anon, authenticated;

-- 5. RPC: Submit Public Nomination
create or replace function public.submit_public_nomination(
  p_event_id uuid,
  p_category_id uuid,
  p_nominee_name text,
  p_nominee_phone text,
  p_nominee_email text default null,
  p_nominee_bio text default null,
  p_image_path text default null,
  p_portfolio_url text default null,
  p_nominator_type text default 'self',
  p_nominator_name text default null,
  p_nominator_phone text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.events%rowtype;
  v_category public.categories%rowtype;
  v_nomination_id uuid;
  v_initial_status text;
  v_clean_name text := trim(p_nominee_name);
  v_clean_phone text := trim(p_nominee_phone);
begin
  if v_clean_name is null or length(v_clean_name) < 2 then
    raise exception 'Nominee name must be at least 2 characters long' using errcode = '22023';
  end if;

  if v_clean_phone is null or length(v_clean_phone) < 9 then
    raise exception 'Valid contact phone number is required' using errcode = '22023';
  end if;

  select * into v_event from public.events where id = p_event_id;
  if not found then
    raise exception 'Event not found' using errcode = 'P0002';
  end if;

  if v_event.status <> 'published' then
    raise exception 'Nominations are not active for this event' using errcode = '22023';
  end if;

  if not v_event.nominations_enabled then
    raise exception 'This event is not accepting public nominations' using errcode = '22023';
  end if;

  if v_event.nominations_starts_at is not null and now() < v_event.nominations_starts_at then
    raise exception 'Nominations for this event have not opened yet' using errcode = '22023';
  end if;

  if v_event.nominations_ends_at is not null and now() >= v_event.nominations_ends_at then
    raise exception 'Nominations for this event have closed' using errcode = '22023';
  end if;

  if p_nominator_type = 'third_party' and not v_event.allow_third_party_nomination then
    raise exception 'This event only accepts self-nominations' using errcode = '22023';
  end if;

  select * into v_category from public.categories where id = p_category_id and event_id = p_event_id and is_active = true;
  if not found then
    raise exception 'Selected category is not active or not in this event' using errcode = '22023';
  end if;

  -- Determine initial status: if filing fee is required, must go through payment first
  if v_event.nomination_fee_minor > 0 then
    v_initial_status := 'pending_payment';
  else
    v_initial_status := 'pending';
  end if;

  insert into public.event_nominations (
    event_id,
    category_id,
    nominee_name,
    nominee_phone,
    nominee_email,
    nominee_bio,
    image_path,
    portfolio_url,
    nominator_type,
    nominator_name,
    nominator_phone,
    status
  ) values (
    p_event_id,
    p_category_id,
    v_clean_name,
    v_clean_phone,
    nullif(trim(p_nominee_email), ''),
    nullif(trim(p_nominee_bio), ''),
    nullif(trim(p_image_path), ''),
    nullif(trim(p_portfolio_url), ''),
    coalesce(p_nominator_type, 'self'),
    nullif(trim(p_nominator_name), ''),
    nullif(trim(p_nominator_phone), ''),
    v_initial_status
  ) returning id into v_nomination_id;

  return jsonb_build_object(
    'success', true,
    'nomination_id', v_nomination_id,
    'status', v_initial_status,
    'requires_payment', v_event.nomination_fee_minor > 0,
    'fee_minor', v_event.nomination_fee_minor
  );
end;
$$;

revoke all on function public.submit_public_nomination(uuid, uuid, text, text, text, text, text, text, text, text, text) from public;
grant execute on function public.submit_public_nomination(uuid, uuid, text, text, text, text, text, text, text, text, text) to anon, authenticated;

-- 6. RPC: Approve Nomination (Organizer Action)
create or replace function public.approve_nomination(
  p_nomination_id uuid,
  p_custom_public_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_nomination public.event_nominations%rowtype;
  v_event public.events%rowtype;
  v_created_nominee_id uuid;
  v_next_order integer;
  v_public_code text;
  v_existing_count integer;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select * into v_nomination from public.event_nominations where id = p_nomination_id for update;
  if not found then
    raise exception 'Nomination not found' using errcode = 'P0002';
  end if;

  select * into v_event from public.events where id = v_nomination.event_id;
  if not exists (
    select 1 from public.organization_members m
    where m.organization_id = v_event.organization_id and m.user_id = v_user_id
  ) and not exists (
    select 1 from public.platform_admins a where a.user_id = v_user_id
  ) then
    raise exception 'Permission denied to review nominations for this event' using errcode = '42501';
  end if;

  if v_nomination.status = 'approved' and v_nomination.approved_nominee_id is not null then
    return jsonb_build_object(
      'success', true,
      'already_approved', true,
      'nominee_id', v_nomination.approved_nominee_id
    );
  end if;

  -- Compute next display order
  select coalesce(max(display_order) + 1, 0) into v_next_order
  from public.nominees
  where category_id = v_nomination.category_id;

  -- Generate public code if not supplied
  if p_custom_public_code is not null and length(trim(p_custom_public_code)) > 0 then
    v_public_code := upper(trim(p_custom_public_code));
  else
    select count(*) + 1 into v_existing_count
    from public.nominees
    where category_id = v_nomination.category_id;

    v_public_code := 'NOM-' || lpad(v_existing_count::text, 2, '0');
  end if;

  -- Create official ballot nominee
  insert into public.nominees (
    category_id,
    name,
    biography,
    image_path,
    public_code,
    display_order,
    is_active
  ) values (
    v_nomination.category_id,
    v_nomination.nominee_name,
    v_nomination.nominee_bio,
    v_nomination.image_path,
    v_public_code,
    v_next_order,
    true
  ) returning id into v_created_nominee_id;

  -- Update nomination status
  update public.event_nominations set
    status = 'approved',
    approved_nominee_id = v_created_nominee_id,
    reviewed_by = v_user_id,
    reviewed_at = now(),
    updated_at = now()
  where id = p_nomination_id;

  -- Audit log
  insert into public.audit_logs (
    organization_id,
    actor_user_id,
    action,
    resource_type,
    resource_id,
    metadata
  ) values (
    v_event.organization_id,
    v_user_id,
    'nomination_approved',
    'nominee',
    v_created_nominee_id::text,
    jsonb_build_object(
      'nomination_id', p_nomination_id,
      'category_id', v_nomination.category_id,
      'public_code', v_public_code,
      'nominee_name', v_nomination.nominee_name
    )
  );

  return jsonb_build_object(
    'success', true,
    'nominee_id', v_created_nominee_id,
    'public_code', v_public_code
  );
end;
$$;

revoke all on function public.approve_nomination(uuid, text) from public;
grant execute on function public.approve_nomination(uuid, text) to authenticated;

-- 7. RPC: Decline Nomination (Organizer Action)
create or replace function public.decline_nomination(
  p_nomination_id uuid,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_nomination public.event_nominations%rowtype;
  v_event public.events%rowtype;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select * into v_nomination from public.event_nominations where id = p_nomination_id for update;
  if not found then
    raise exception 'Nomination not found' using errcode = 'P0002';
  end if;

  select * into v_event from public.events where id = v_nomination.event_id;
  if not exists (
    select 1 from public.organization_members m
    where m.organization_id = v_event.organization_id and m.user_id = v_user_id
  ) and not exists (
    select 1 from public.platform_admins a where a.user_id = v_user_id
  ) then
    raise exception 'Permission denied' using errcode = '42501';
  end if;

  update public.event_nominations set
    status = 'declined',
    review_notes = nullif(trim(p_reason), ''),
    reviewed_by = v_user_id,
    reviewed_at = now(),
    updated_at = now()
  where id = p_nomination_id;

  return jsonb_build_object('success', true);
end;
$$;

revoke all on function public.decline_nomination(uuid, text) from public;
grant execute on function public.decline_nomination(uuid, text) to authenticated;
