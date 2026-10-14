-- Run manually in the SQL Editor of TEST project mpajnwllttagglxnlekf only.
-- Not a migration: never run this against the live database.
-- Requires the confirmed test account already created in Authentication > Users.
-- Creates sample drafts; payment verification, event approval and USSD activation
-- still use the normal application flow. No passwords or payment records created.
begin;
do $seed$
declare
  account_id uuid;
  organizer_id uuid;
  seeded_event_id uuid;
  seeded_category_id uuid;
  mode text;
  category_name text;
begin
  -- Refuse databases with unrelated organizers/events or any financial activity.
  if exists(select 1 from public.organizations where slug <> 'ussd-simulator-test-organizer')
     or exists(select 1 from public.events where slug not in ('ussd-simulator-free-test', 'ussd-simulator-paid-test'))
     or exists(select 1 from public.payment_attempts)
     or exists(select 1 from public.ledger_entries)
     or exists(select 1 from public.ussd_access_payments) then
    raise exception 'Seed stopped: this is not an empty simulator database. Verify the test project before proceeding.';
  end if;
  select id into account_id from auth.users
    where lower(email) = 'shoprabuni@gmail.com' and email_confirmed_at is not null;
  if account_id is null then
    raise exception 'Create and confirm shoprabuni@gmail.com in the TEST project Authentication > Users first.';
  end if;
  insert into public.profiles(id, display_name)
    values(account_id, 'Simulator Tester') on conflict(id) do nothing;
  insert into public.platform_admins(user_id, role, is_active)
    values(account_id, 'admin', true)
    on conflict(user_id) do update set role='admin', is_active=true;
  insert into public.organizations(name, slug, created_by)
    values('USSD Simulator Test Organizer', 'ussd-simulator-test-organizer', account_id)
    on conflict(slug) do nothing;
  select id into organizer_id from public.organizations where slug='ussd-simulator-test-organizer';
  if not exists(select 1 from public.organizations where id=organizer_id and created_by=account_id and purged_at is null and archived_at is null and moderation_status='active') then
    raise exception 'Seed organizer is unavailable or belongs to another account.';
  end if;
  insert into public.organization_members(organization_id, user_id, role)
    values(organizer_id, account_id, 'owner') on conflict(organization_id,user_id) do nothing;
  foreach mode in array array['free','paid'] loop
    insert into public.events(organization_id, name, slug, description, voting_mode,
      unit_price_minor, free_vote_limit_per_phone, voting_rule, verification_method,
      starts_at, ends_at, status, results_visibility, created_by)
    values(organizer_id, 'USSD Simulator ' || initcap(mode) || ' Test',
      'ussd-simulator-' || mode || '-test',
      'Sample event for simulator testing only. Contestants are fictional.', mode,
      case when mode='free' then 0 else 100 end,
      case when mode='free' then 1 else null end,
      'one_per_category', 'phone', now()-interval '1 hour', now()+interval '30 days',
      'draft', 'live', account_id)
    on conflict(slug) do nothing;
    select id into seeded_event_id from public.events where slug='ussd-simulator-' || mode || '-test';
    if not exists(select 1 from public.events where id=seeded_event_id and organization_id=organizer_id and status='draft' and purged_at is null) then
      raise exception 'Seed event is no longer a draft; use the dashboard to manage it.';
    end if;
    foreach category_name in array array['Best Performer','Audience Favourite'] loop
      insert into public.categories(event_id,name,display_order)
        values(seeded_event_id,category_name,case when category_name='Best Performer' then 0 else 1 end)
        on conflict(event_id,name) do nothing;
      select id into seeded_category_id from public.categories where event_id=seeded_event_id and name=category_name;
      insert into public.nominees(category_id,name,public_code,display_order)
        values(seeded_category_id,'Test Contestant A','TEST-A',0),
              (seeded_category_id,'Test Contestant B','TEST-B',1)
        on conflict(category_id,name) do nothing;
    end loop;
  end loop;
end $seed$;
commit;
select name, id as event_uuid, status, voting_mode, unit_price_minor, starts_at, ends_at
from public.events where slug in ('ussd-simulator-free-test','ussd-simulator-paid-test')
order by voting_mode;
