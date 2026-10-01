-- Run with: npm run supabase:start && npm run db:reset && npm run db:test
begin;
select plan(68);

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
update auth.users set phone = '+233241234567', phone_confirmed_at = now()
where id = '10000000-0000-4000-8000-000000000001';

select ok(not has_table_privilege('anon', 'public.payment_attempts', 'select'), 'anonymous users cannot read payment attempts');
select ok(not has_table_privilege('anon', 'public.vote_batches', 'select'), 'anonymous users cannot read vote batches');
select ok(not has_column_privilege('anon', 'public.events', 'created_by', 'select'), 'anonymous users cannot read organizer account identifiers');
select ok(not has_column_privilege('anon', 'public.events', 'organization_id', 'select'), 'anonymous users cannot read internal organization identifiers');
select ok(not has_column_privilege('authenticated', 'public.events', 'organization_id', 'select'), 'organizers use a membership-checked RPC for internal organization identifiers');
select ok(not has_table_privilege('authenticated', 'public.payment_attempts', 'select'), 'authenticated clients cannot read payment attempts');
select ok(not has_table_privilege('authenticated', 'public.ledger_entries', 'select'), 'authenticated clients cannot read financial ledger entries');
select ok(not has_table_privilege('authenticated', 'public.audit_logs', 'select'), 'authenticated clients cannot read audit logs');
select ok(not has_table_privilege('authenticated', 'public.payment_attempts', 'insert'), 'authenticated clients cannot create payment attempts directly');
select ok(not has_table_privilege('authenticated', 'public.ledger_entries', 'update'), 'authenticated clients cannot edit ledger entries');
select ok(not has_function_privilege('anon', 'public.update_nominee_image(uuid,text)', 'execute'), 'anonymous users cannot update nominee images');
select ok(has_function_privilege('authenticated', 'public.update_nominee_image(uuid,text)', 'execute'), 'authenticated organizers can call the guarded nominee image RPC');
select ok(not has_function_privilege('anon', 'public.create_organization_invitation(uuid,text,text,text)', 'execute'), 'anonymous users cannot create team invitations');

set local role anon;
select is((select count(id) from public.events), 1::bigint, 'anonymous users only see published event data');
select is((select count(id) from public.categories), 1::bigint, 'anonymous users do not see inactive or draft categories');
select is((select count(id) from public.nominees), 1::bigint, 'anonymous users do not see inactive or draft nominees');
select ok(private.can_view_nominee_image_path('30000000-0000-4000-8000-000000000001/50000000-0000-4000-8000-000000000001/60000000-0000-4000-8000-000000000001.jpg'), 'public event members can read published nominee image paths');
select ok(not private.can_view_nominee_image_path('30000000-0000-4000-8000-000000000002/50000000-0000-4000-8000-000000000003/60000000-0000-4000-8000-000000000002.jpg'), 'public users cannot read draft nominee image paths');
select is((select count(*) from public.get_public_event_results('30000000-0000-4000-8000-000000000001')), 0::bigint, 'organizer-only results are not exposed to anonymous users');
reset role;

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
set local role authenticated;
select is((select count(*) from public.organizations), 1::bigint, 'organization owner can see their organization');
select is((select count(id) from public.events), 2::bigint, 'organization owner can see published and draft events');
select is((select count(id) from public.get_organization_events('20000000-0000-4000-8000-000000000001')), 2::bigint, 'organization event RPC returns rows to a member');
select is((select count(*) from public.get_organization_team('20000000-0000-4000-8000-000000000001')), 1::bigint, 'organization managers can read the team roster');
select ok(public.create_organization_invitation('20000000-0000-4000-8000-000000000001', 'other@example.test', 'viewer', repeat('a', 64)) is not null, 'owner can create a role-limited invitation');
select is((select count(*) from public.get_organization_invitations('20000000-0000-4000-8000-000000000001') where status = 'pending'), 1::bigint, 'organization managers can view pending invitations');
select throws_ok($$select public.accept_organization_invitation(repeat('a', 64))$$, '42501', 'Sign in with the invited email address', 'invitation requires the matching confirmed email');
select ok(not has_table_privilege('authenticated', 'public.events', 'insert'), 'organizers cannot write event rows directly');
select ok(private.can_manage_nominee_image_path('30000000-0000-4000-8000-000000000002/50000000-0000-4000-8000-000000000003/60000000-0000-4000-8000-000000000003.jpg'), 'event editors can upload media for their draft nominees');
select ok(not has_function_privilege('anon', 'public.create_event(uuid,text,text,text,bigint,timestamptz,timestamptz,text,text,smallint,text)', 'execute'), 'anonymous users cannot call event creation');
select ok(not has_function_privilege('anon', 'public.update_event_category(uuid,text,text,integer,boolean)', 'execute'), 'anonymous users cannot edit event categories');
select ok(not has_function_privilege('anon', 'public.cast_free_votes(uuid,uuid,uuid,integer,uuid)', 'execute'), 'anonymous users cannot cast free votes');
select ok(has_function_privilege('authenticated', 'public.cast_free_votes(uuid,uuid,uuid,integer,uuid)', 'execute'), 'authenticated voters can call the verified free-vote RPC');
select public.create_event('20000000-0000-4000-8000-000000000001', 'Workflow Test Event', 'workflow-test-event', 'Draft event for workflow policy tests', 0::bigint, now() - interval '1 hour', now() + interval '3 days', 'live', 'free', 3::smallint, 'One verified phone may cast three votes per category.');
select is((select count(*) from public.events where slug = 'workflow-test-event'), 1::bigint, 'authorized organizer can create a draft through the RPC');
select is((select unit_price_minor from public.events where slug = 'workflow-test-event'), 0::bigint, 'free events persist a zero vote price');
select is((select voting_mode from public.events where slug = 'workflow-test-event'), 'free', 'event voting mode is persisted');
select is((select free_vote_limit_per_phone from public.events where slug = 'workflow-test-event'), 3::smallint, 'free-vote cap per verified phone is persisted');
select is((select voting_rules from public.events where slug = 'workflow-test-event'), 'One verified phone may cast three votes per category.', 'organizer voting rules are persisted');
select throws_ok($$select public.create_event('20000000-0000-4000-8000-000000000001', 'Invalid Free Event', 'invalid-free-event', null, 100::bigint, now() + interval '1 day', now() + interval '3 days', 'organizer_only', 'free', 3::smallint, null)$$, '22023', 'Free voting requires a zero price and a verified-phone vote limit from 1 to 100', 'free event cannot carry a positive per-vote price');
select throws_ok($$select public.set_event_status((select id from public.events where slug = 'workflow-test-event'), 'publish')$$, '22023', 'Add an active category before publishing', 'event cannot publish without an active category');
select public.add_event_category((select id from public.events where slug = 'workflow-test-event'), 'Best New Artist', 'First test category', null);
select is((select count(*) from public.categories where name = 'Best New Artist'), 1::bigint, 'authorized organizer can add a category through the RPC');
select public.update_event_category((select id from public.categories where name = 'Best New Artist'), 'Best New Artist', 'Updated category rules', 2, true);
select is((select display_order from public.categories where name = 'Best New Artist'), 2, 'organizer can reorder a draft category through the validated RPC');
select is((select description from public.categories where name = 'Best New Artist'), 'Updated category rules', 'organizer can edit a draft category through the validated RPC');
select throws_ok($$select public.set_event_status((select id from public.events where slug = 'workflow-test-event'), 'publish')$$, '22023', 'Every active category needs an active nominee', 'event cannot publish until each active category has a nominee');
select public.add_category_nominee((select id from public.categories where name = 'Best New Artist'), 'Test Nominee', 'BNA-01', 'Test biography', null);
select public.update_category_nominee((select id from public.nominees where name = 'Test Nominee'), 'Updated Test Nominee', 'BNA-02', 'Updated biography', 1, true);
select is((select name from public.nominees where public_code = 'BNA-02'), 'Updated Test Nominee', 'organizer can edit a draft nominee through the validated RPC');
select is((select display_order from public.nominees where public_code = 'BNA-02'), 1, 'organizer can reorder a draft nominee through the validated RPC');
select is(public.set_event_status((select id from public.events where slug = 'workflow-test-event'), 'publish'), 'published', 'authorized organizer can publish a complete event');
select ok(public.is_free_voting_open((select id from public.events where slug = 'workflow-test-event')), 'free voting opens only during the configured published window');
select is(public.cast_free_votes((select id from public.events where slug = 'workflow-test-event'), (select id from public.categories where name = 'Best New Artist'), (select id from public.nominees where public_code = 'BNA-02'), 3, '60000000-0000-4000-8000-000000000001'), public.cast_free_votes((select id from public.events where slug = 'workflow-test-event'), (select id from public.categories where name = 'Best New Artist'), (select id from public.nominees where public_code = 'BNA-02'), 3, '60000000-0000-4000-8000-000000000001'), 'same vote request retry returns the original batch');
select is((select count(*) from public.vote_batches where event_id = (select id from public.events where slug = 'workflow-test-event')), 1::bigint, 'idempotent retry does not duplicate a free-vote batch');
select is((select sum(quantity)::integer from public.vote_batches where event_id = (select id from public.events where slug = 'workflow-test-event')), 3, 'free vote quantity is stored once');
select is((select result.vote_count from public.get_public_event_results((select id from public.events where slug = 'workflow-test-event')) as result where result.nominee_id = (select id from public.nominees where public_code = 'BNA-02')), 3::bigint, 'public live-results policy returns the approved vote total');
select throws_ok($$select public.cast_free_votes((select id from public.events where slug = 'workflow-test-event'), (select id from public.categories where name = 'Best New Artist'), (select id from public.nominees where public_code = 'BNA-02'), 1, '60000000-0000-4000-8000-000000000002')$$, '22023', 'This verified phone has reached the vote limit for this category', 'free-vote limit is enforced transactionally');
select throws_ok($$select public.update_event_category((select id from public.categories where name = 'Best New Artist'), 'Best New Artist', null, 2, true)$$, '22023', 'Only draft event categories can be edited', 'published event categories are locked');
reset role;

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', true);
set local role authenticated;
select is((select count(*) from public.organizations), 0::bigint, 'another organizer cannot see the first organization');
select is((select count(id) from public.events), 2::bigint, 'another organizer sees only published event data');
select is((select count(id) from public.get_organization_events('20000000-0000-4000-8000-000000000001')), 0::bigint, 'organization event RPC hides another tenant’s drafts');
select throws_ok($$select public.create_event('20000000-0000-4000-8000-000000000001', 'Cross Tenant Event', 'cross-tenant-event', null, 100::bigint, now() + interval '1 day', now() + interval '3 days', 'organizer_only', 'paid', null, null)$$, '42501', 'Organization access denied', 'nonmember cannot create an event for another organization');
select throws_ok($$select public.update_event_category('40000000-0000-4000-8000-000000000003', 'Stolen Category', null, 0, true)$$, '42501', 'Organization access denied', 'nonmember cannot edit another tenant’s category');
select throws_ok($$select public.create_organization_invitation('20000000-0000-4000-8000-000000000001', 'third@example.test', 'viewer', repeat('b', 64))$$, '42501', 'Organization access denied', 'nonmember cannot create a team invitation');
select is(public.accept_organization_invitation(repeat('a', 64)), '20000000-0000-4000-8000-000000000001'::uuid, 'invited confirmed user can join the organization');
select is((select role from public.organization_members where organization_id = '20000000-0000-4000-8000-000000000001' and user_id = '10000000-0000-4000-8000-000000000002'), 'viewer', 'invitation applies its assigned least-privilege role');
select throws_ok($$select public.accept_organization_invitation(repeat('a', 64))$$, '22023', 'Invitation is invalid, expired, or already used', 'accepted invitation cannot be replayed');
reset role;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
set local role authenticated;
select is((select status from public.get_organization_invitations('20000000-0000-4000-8000-000000000001') where email = 'other@example.test'), 'accepted', 'invitation becomes single-use after acceptance');
reset role;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', true);
set local role authenticated;
select ok(public.create_organization('Second Organization', 'second-organization') is not null, 'authenticated organizer can create an organization through the validated RPC');
select is((select role from public.organization_members where organization_id = (select id from public.organizations where slug = 'second-organization')), 'owner', 'organization creation atomically grants the caller owner membership');
reset role;

set local role anon;
select is((select count(id) from public.events where slug = 'workflow-test-event'), 1::bigint, 'published event becomes visible to public readers');
reset role;
select is((select count(*) from public.audit_logs where resource_type in ('event', 'category', 'nominee', 'vote_batch') and resource_id is not null), 7::bigint, 'event creation, edits, category, nominee, publication, and votes are audited');
select is((select count(*) from public.audit_logs where action in ('organization_invitation_created', 'organization_invitation_accepted')), 2::bigint, 'invitation creation and acceptance are audited');

select * from finish();
rollback;
