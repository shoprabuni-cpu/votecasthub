import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';

const db = new PGlite();
try {
  const operations = await fs.readFile('scripts/test-ussd-operations.mjs', 'utf8');
  const setup = operations.match(/await db\.exec\(`([\s\S]*?)`\);/);
  assert(setup, 'Database test fixture must be available');
  await db.exec(setup[1]);
  for (const file of (await fs.readdir('supabase/migrations')).filter(name => name.endsWith('.sql')).sort()) {
    await db.exec(await fs.readFile(`supabase/migrations/${file}`, 'utf8'));
  }
  const seed = await fs.readFile('supabase/test-data/ussd-simulator.sql', 'utf8');
  const readiness = await db.exec(await fs.readFile('supabase/checks/ussd-production-readiness.sql', 'utf8'));
  assert(readiness[0].rows.every(row => row.status === 'Ready'), 'Live schema check matches deployed migration signatures');
  await assert.rejects(db.exec(seed), /Create and confirm/);
  await db.exec('rollback');
  await db.exec("insert into auth.users(id,email,email_confirmed_at) values('00000000-0000-4000-8000-000000000099','shoprabuni@gmail.com',now())");
  await db.exec(seed);
  await db.exec(seed);
  const count = async table => (await db.query(`select count(*)::int n from ${table}`)).rows[0].n;
  assert.equal(await count('events'), 2);
  assert.equal(await count('categories'), 4);
  assert.equal(await count('nominees'), 8);
  assert.equal(await count('platform_admins'), 1);
  assert.equal(await count('payment_attempts'), 0);
  assert.equal(await count('ledger_entries'), 0);
  assert.equal(await count('ussd_access_payments'), 0);
  assert.equal((await db.query("select count(*)::int n from events where status='draft' and not admin_approved")).rows[0].n, 2);
  assert.equal((await db.query("select role from organization_members")).rows[0].role, 'owner');
  const ready = await fs.readFile('supabase/test-data/ussd-simulator-ready.sql', 'utf8');
  await db.exec(ready);
  await db.exec(ready);
  assert.equal((await db.query('select balance from organization_sms_credits')).rows[0].balance, 1000);
  const paidReady = await fs.readFile('supabase/test-data/ussd-simulator-paid-ready.sql', 'utf8');
  await assert.rejects(db.exec(paidReady), /Test payout account not ready/);
  await db.exec('rollback');
  const organizer = (await db.query('select id from organizations')).rows[0].id;
  await db.query("insert into organization_paystack_accounts(organization_id,subaccount_code,business_name,settlement_bank,account_last4,status,paystack_verified) values($1,'ACCT_testfixture','Simulator','MTN','1234','pending',false)",[organizer]);
  await assert.rejects(db.exec(paidReady), /Test payout account not ready/);
  await db.exec('rollback');
  await db.query("update organization_paystack_accounts set status='active',paystack_verified=true where organization_id=$1",[organizer]);
  await db.exec(paidReady);
  await db.exec(paidReady);
  const paidEvent = (await db.query("select id from events where slug='ussd-simulator-paid-test' and status='published' and admin_approved")).rows[0].id;
  assert.equal((await db.query('select * from get_public_ussd($1)',[paidEvent])).rows.length, 1);
  const paidNominee = (await db.query('select c.id category,n.id nominee from categories c join nominees n on n.category_id=c.id where c.event_id=$1 limit 1',[paidEvent])).rows[0];
  await db.exec("insert into ussd_sessions(session_id,phone_hash) values('seed-paid-session',repeat('a',64))");
  const reserved = (await db.query("select (reserve_paystack_ussd_payment('seed-paid-session',repeat('a',64),$1,$2,$3,2)).*",[paidEvent,paidNominee.category,paidNominee.nominee])).rows[0];
  assert.equal(Number(reserved.total_amount_minor), 200);
  assert.equal(reserved.subaccount_code, 'ACCT_testfixture');
  await assert.rejects(db.exec(paidReady), /payment activity/);
  await db.exec('rollback');
  const active = (await db.query("select e.id,r.event_code from events e join event_ussd_requests r on r.event_id=e.id where e.slug='ussd-simulator-free-test' and e.status='published' and e.admin_approved and r.enabled and r.access_paid")).rows;
  assert.equal(active.length, 1);
  assert.equal((await db.query('select * from get_public_ussd($1)',[active[0].id])).rows.length, 1);
  await db.exec("insert into auth.users(id,phone,phone_confirmed_at) values('00000000-0000-4000-8000-000000000098','233241231234',now())");
  const nominee = (await db.query('select c.id category,n.id nominee from categories c join nominees n on n.category_id=c.id where c.event_id=$1 limit 1',[active[0].id])).rows[0];
  await db.query('select cast_verified_ussd_vote($1,$2,$3,$4,1,$5)',[
    '00000000-0000-4000-8000-000000000098',active[0].id,nominee.category,nominee.nominee,
    '00000000-0000-4000-8000-000000000097',
  ]);
  assert.equal((await db.query('select sum(quantity)::int n from vote_batches')).rows[0].n, 1);
  assert.equal((await db.query('select balance from organization_sms_credits')).rows[0].balance, 1000);
  assert.equal(await count('sms_credit_purchases'), 0);
  assert.equal(await count('ussd_access_payments'), 0);
  await db.exec("insert into organizations(name,slug) values('Existing organizer','existing-organizer')");
  await assert.rejects(db.exec(seed), /not an empty simulator database/);
  await db.exec('rollback');
  await assert.rejects(db.exec(ready), /unrelated data/);
  await db.exec('rollback');
  console.log('PASS: full schema, test ownership/admin, free vote, synthetic SMS/access, paid setup requires verified account, GH₵1 reservation and saved subaccount, repeat safety, unrelated data/payment guards');
} finally {
  await db.close();
}
