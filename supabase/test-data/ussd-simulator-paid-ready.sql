-- TEST project mpajnwllttagglxnlekf ONLY. Run after the simulator seed.
-- Requires a real Paystack TEST subaccount already saved by the dashboard.
-- Does not invent a subaccount or mark an unverified account as verified.
-- USSD access approval is a synthetic simulator fixture, not a collected fee.
begin;
do $setup$
declare
  tester uuid;
  organizer uuid;
  paid_event uuid;
begin
  if exists(select 1 from public.organizations where slug<>'ussd-simulator-test-organizer')
     or exists(select 1 from public.events where slug not in ('ussd-simulator-free-test','ussd-simulator-paid-test'))
     or exists(select 1 from public.payment_attempts)
     or exists(select 1 from public.ledger_entries)
     or exists(select 1 from public.ussd_access_payments) then
    raise exception 'Stopped: unrelated data or payment activity found. Use the isolated simulator database.';
  end if;
  select id into tester from auth.users where lower(email)='shoprabuni@gmail.com' and email_confirmed_at is not null;
  select id into organizer from public.organizations where slug='ussd-simulator-test-organizer'
    and created_by=tester and moderation_status='active' and archived_at is null and purged_at is null;
  select id into paid_event from public.events where slug='ussd-simulator-paid-test'
    and organization_id=organizer and voting_mode='paid' and status in ('draft','published') and purged_at is null;
  if tester is null or organizer is null or paid_event is null then
    raise exception 'Run ussd-simulator.sql in the TEST project first.';
  end if;
  if not public.can_publish_paid_event(paid_event) then
    raise exception 'Test payout account not ready. In Organizer > Payments, refresh verification after Paystack approval, then run this SQL again.';
  end if;
  if exists(select 1 from public.event_ussd_requests where event_id=paid_event and terms is distinct from 'SIMULATOR FIXTURE: synthetic access approval; no fee paid and no real shortcode purchased.') then
    raise exception 'A real access request exists. Refusing to overwrite its agreement.';
  end if;
  update public.events set admin_approved=true,status='published',
    starts_at=least(starts_at,now()-interval '1 hour'),
    ends_at=greatest(ends_at,now()+interval '30 days') where id=paid_event;
  insert into public.event_ussd_requests(event_id,organization_id,status,requested_by,
    quote_id,amount_minor,terms,valid_until,quoted_by,accepted_by,accepted_at,
    access_paid,payment_status,enabled,dial_code,active_from,active_until,network_notice)
  select e.id,organizer,'accepted',tester,gen_random_uuid(),1,
    'SIMULATOR FIXTURE: synthetic access approval; no fee paid and no real shortcode purchased.',
    e.ends_at,tester,tester,now(),true,'paid',true,'*928*123#',e.starts_at,e.ends_at,
    'Simulator only. Paystack test payments; no real shortcode or session charge.'
  from public.events e where e.id=paid_event
  on conflict(event_id) do update set enabled=true,dial_code=excluded.dial_code,
    active_from=excluded.active_from,active_until=excluded.active_until,
    valid_until=excluded.valid_until,updated_at=now();
  insert into public.admin_audit_log(admin_user_id,action,target_type,target_id,note)
    values(tester,'simulator_fixture_setup','event',paid_event,
      'TEST ONLY: paid sample event activated with saved verified subaccount; USSD access fee is synthetic.');
end $setup$;
commit;
-- Copy the single returned value into the Preview branch variable of this name.
select string_agg(e.id::text,',' order by e.voting_mode) as "USSD_SIMULATOR_EVENT_IDS"
from public.events e join public.event_ussd_requests r on r.event_id=e.id
where e.slug in ('ussd-simulator-free-test','ussd-simulator-paid-test') and r.enabled;
-- Voters enter these short numeric codes, never the UUIDs above.
select e.name,r.event_code,e.unit_price_minor as price_pesewas,e.status
from public.events e join public.event_ussd_requests r on r.event_id=e.id
where e.slug in ('ussd-simulator-free-test','ussd-simulator-paid-test') and r.enabled
order by e.voting_mode;
