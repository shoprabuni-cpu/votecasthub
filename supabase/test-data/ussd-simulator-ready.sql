-- TEST project mpajnwllttagglxnlekf ONLY. Run after ussd-simulator.sql.
-- Synthetic simulator setup, not proof of SMS purchase or access-fee payment.
-- No SMS is sent by this script or by the free USSD caller-identification flow.
begin;
do $setup$
declare
  tester uuid;
  organizer uuid;
  free_event uuid;
begin
  if exists(select 1 from public.organizations where slug<>'ussd-simulator-test-organizer')
     or exists(select 1 from public.events where slug not in ('ussd-simulator-free-test','ussd-simulator-paid-test'))
     or exists(select 1 from public.payment_attempts)
     or exists(select 1 from public.ledger_entries)
     or exists(select 1 from public.ussd_access_payments)
     or exists(select 1 from public.sms_credit_purchases) then
    raise exception 'Stopped: unrelated data or payment activity found. Use the isolated simulator database.';
  end if;
  select id into tester from auth.users where lower(email)='shoprabuni@gmail.com' and email_confirmed_at is not null;
  select id into organizer from public.organizations
    where slug='ussd-simulator-test-organizer' and created_by=tester
      and archived_at is null and purged_at is null and moderation_status='active';
  select id into free_event from public.events
    where slug='ussd-simulator-free-test' and organization_id=organizer
      and voting_mode='free' and verification_method='phone' and purged_at is null
      and status in ('draft','published');
  if tester is null or organizer is null or free_event is null then
    raise exception 'Run ussd-simulator.sql in the TEST database first.';
  end if;
  if exists(select 1 from public.event_ussd_requests where event_id=free_event and terms is distinct from 'SIMULATOR FIXTURE: synthetic access approval; no fee paid and no real shortcode purchased.') then
    raise exception 'A real access request exists. Refusing to overwrite its agreement.';
  end if;
  insert into public.platform_admins(user_id,role,is_active) values(tester,'admin',true)
    on conflict(user_id) do update set role='admin',is_active=true;
  -- A test balance meets publication readiness without purchasing or sending SMS.
  -- Re-running does not replenish credits that have subsequently been consumed.
  insert into public.organization_sms_credits(organization_id,balance)
    values(organizer,1000) on conflict(organization_id) do nothing;
  update public.events set admin_approved=true,status='published',
    starts_at=least(starts_at,now()-interval '1 hour'),
    ends_at=greatest(ends_at,now()+interval '30 days') where id=free_event;
  insert into public.event_ussd_requests(event_id,organization_id,status,requested_by,
    quote_id,amount_minor,terms,valid_until,quoted_by,accepted_by,accepted_at,
    access_paid,payment_status,enabled,dial_code,active_from,active_until,network_notice)
  select e.id,organizer,'accepted',tester,gen_random_uuid(),1,
    'SIMULATOR FIXTURE: synthetic access approval; no fee paid and no real shortcode purchased.',
    e.ends_at,tester,tester,now(),true,'paid',true,'*928*123#',e.starts_at,e.ends_at,
    'Simulator only. No real shortcode or subscriber session charge.'
  from public.events e where e.id=free_event
  on conflict(event_id) do update set enabled=true,dial_code=excluded.dial_code,
    active_from=excluded.active_from,active_until=excluded.active_until,
    valid_until=excluded.valid_until,updated_at=now();
  insert into public.admin_audit_log(admin_user_id,action,target_type,target_id,note)
    values(tester,'simulator_fixture_setup','event',free_event,
      'TEST ONLY: seeded 1000 SMS credits and synthetic USSD approval; no money collected.');
end $setup$;
commit;
select e.name,e.id as ussd_simulator_event_ids,r.event_code,
  r.dial_code,s.balance as test_sms_credits,e.status
from public.events e join public.event_ussd_requests r on r.event_id=e.id
join public.organization_sms_credits s on s.organization_id=e.organization_id
where e.slug='ussd-simulator-free-test';
