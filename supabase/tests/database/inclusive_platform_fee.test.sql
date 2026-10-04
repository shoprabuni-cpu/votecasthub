begin;
select plan(9);
insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_user_meta_data, created_at, updated_at)
values
  ('10000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'owner@example.test', '', now(), '{"display_name":"Owner"}', now(), now()),
  ('10000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'other@example.test', '', now(), '{"display_name":"Other"}', now(), now());

insert into public.organizations (id, name, slug, created_by)
values ('20000000-0000-4000-8000-000000000001', 'First Organization', 'first-organization', '10000000-0000-4000-8000-000000000001');
insert into public.organization_members (organization_id, user_id, role)
values ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'owner');
insert into public.events (id, organization_id, name, slug, unit_price_minor, starts_at, ends_at, status)
values
  ('30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'Public Event', 'public-event', 100, now() - interval '1 day', now() + interval '1 day', 'published'),
  ('30000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', 'Draft Event', 'draft-event', 100, now(), now() + interval '1 day', 'draft');
insert into public.categories (id, event_id, name, display_order, is_active)
values
  ('40000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', 'Public Category', 0, true),
  ('40000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000001', 'Inactive Category', 1, false),
  ('40000000-0000-4000-8000-000000000003', '30000000-0000-4000-8000-000000000002', 'Draft Category', 0, true);
insert into public.nominees (id, category_id, name, display_order, is_active)
values
  ('50000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001', 'Public Nominee', 0, true),
  ('50000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000002', 'Inactive Nominee', 0, true),
  ('50000000-0000-4000-8000-000000000003', '40000000-0000-4000-8000-000000000003', 'Draft Nominee', 0, true);

insert into public.organization_paystack_accounts(organization_id,subaccount_code,business_name,settlement_bank,account_last4,status,paystack_verified)
values('20000000-0000-4000-8000-000000000001','ACCT_original','First Organization','MTN','9221','active',true);
insert into public.payment_attempts(id,idempotency_key,event_id,organization_id,category_id,nominee_id,quantity,unit_price_minor,total_amount_minor,currency,provider,provider_reference,status)
values('60000000-0000-4000-8000-000000000001','inclusive-platform-fee-test','30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001',100,100,10000,'GHS','paystack','inclusive-fee-test','pending');
select public.confirm_paid_vote('inclusive-fee-test',123456,10000,195);
select is((select organizer_net_minor from public.paid_vote_ledger where reference='inclusive-fee-test'),9000::bigint,'Organizer receives 90%, regardless of provider fees');
select is((select platform_fee_minor from public.paid_vote_ledger where reference='inclusive-fee-test'),1000::bigint,'Platform share is 10% total');
select is((select provider_fee_minor from public.paid_vote_ledger where reference='inclusive-fee-test'),195::bigint,'Provider cost retained for reporting');
select public.confirm_paid_vote('inclusive-fee-test',123456,10000,195);
select is((select count(*) from public.vote_batches where payment_attempt_id='60000000-0000-4000-8000-000000000001'),1::bigint,'Repeated confirmation creates no extra votes');
select ok(not has_function_privilege('anon','public.confirm_paid_vote(text,bigint,bigint,bigint)','execute'),'Anonymous users cannot confirm payments');
select ok(not has_function_privilege('authenticated','public.confirm_paid_vote(text,bigint,bigint,bigint)','execute'),'Authenticated users cannot confirm payments');
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
select is((select net_minor from public.get_organization_paid_earnings('20000000-0000-4000-8000-000000000001')),9000::bigint,'Dashboard shows inclusive fee earnings');
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',true);
select throws_ok($$select * from public.get_organization_paid_earnings('20000000-0000-4000-8000-000000000001')$$,'42501','Organization access denied','Other tenants cannot read earnings');
insert into public.paystack_account_requests(organization_id) values('20000000-0000-4000-8000-000000000001');
select throws_ok($$insert into public.paystack_account_requests(organization_id) values('20000000-0000-4000-8000-000000000001')$$,'23505',null,'A second setup request cannot reserve the same organization');
select * from finish();
rollback;
