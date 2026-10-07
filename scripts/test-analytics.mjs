process.on('uncaughtException', error => { console.error(error.message, error.where ?? ''); process.exit(1); });
import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import ts from 'typescript';
import { createRequire } from 'node:module';
import vm from 'node:vm';

const db = new PGlite();
await db.exec(`
create role anon; create role authenticated; create role service_role bypassrls;
create schema auth; create schema storage;
create table auth.users(id uuid primary key,aud text,role text,email text,encrypted_password text,email_confirmed_at timestamptz,raw_user_meta_data jsonb,created_at timestamptz,updated_at timestamptz,phone text,phone_confirmed_at timestamptz);
create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,owner uuid);
alter table storage.objects enable row level security;
grant usage on schema public,auth,storage to anon,authenticated,service_role;
grant all on all tables in schema auth,storage to service_role;
alter default privileges in schema public grant all on tables to anon,authenticated,service_role;
`);
for (const file of (await fs.readdir('supabase/migrations')).filter(file => file.endsWith('.sql')).sort()) {
  try { await db.exec(await fs.readFile(`supabase/migrations/${file}`, 'utf8')); }
  catch (error) { throw new Error(`Migration ${file}: ${error.message}`); }
}
const fixture = await fs.readFile('supabase/tests/database/inclusive_platform_fee.test.sql', 'utf8');
await db.exec(fixture.slice(fixture.indexOf('insert into auth.users'), fixture.indexOf('select public.confirm_paid_vote')));
const org = '20000000-0000-4000-8000-000000000001';
const event = '30000000-0000-4000-8000-000000000001';
const otherEvent = '30000000-0000-4000-8000-000000000002';
const owner = '10000000-0000-4000-8000-000000000001';
const outsider = '10000000-0000-4000-8000-000000000002';
const query = async sql => (await db.query(sql)).rows;
const exportRows = async sql => (await query(`select ${sql} data`))[0].data;
await db.exec(`select confirm_paid_vote('inclusive-fee-test',123456,10000,195); select set_config('request.jwt.claim.sub','${owner}',false);`);
const report = async (selected = 'null', days = 7) => (await query(`select get_scoped_organizer_analytics('${org}',${selected},${days}) data`))[0].data;
const selected = `'${event}'`;
const total = rows => rows.reduce((sum, row) => sum + Number(row.total_votes), 0);
let data = await report(selected);
assert.equal(data.rows.length, 1);
assert.equal(total(data.rows), 100);
assert.equal(total(data.nominees), 100);
assert.equal(total(data.categories), 100);
assert.equal(total(data.trends), 100);
assert.equal(data.trends.length, 7);
assert.equal(data.revenue.reduce((sum, row) => sum + Number(row.gross_minor), 0), 10000);
assert.equal((await report(`'${otherEvent}'`)).rows[0].total_votes, 0);
assert.equal((await report()).rows.length, 2);

await db.exec(`select apply_payment_adjustment('inclusive-fee-test','analytics-refund-1',155,'refund');`);
data = await report(selected);
for (const key of ['rows', 'nominees', 'categories', 'trends']) assert.equal(total(data[key]), 98, key);
assert.equal(Number(data.rows[0].gross_minor), 10000);
assert.equal(Number(data.rows[0].refunded_minor), 155);
assert.equal(Number(data.rows[0].net_minor), 8861);
let exported = await exportRows(`get_scoped_vote_export('${org}','${event}',7)`);
assert.equal(exported.length, 1); assert.equal(Number(exported[0].recorded_votes), 100); assert.equal(Number(exported[0].valid_votes), 98);
assert.equal((await exportRows(`get_scoped_vote_export('${org}','${otherEvent}',7)`)).length, 0);
const payments = await exportRows(`get_scoped_payment_export('${org}','${event}',7)`);
assert.equal(Number(payments[0].gross_minor), 10000); assert.equal(Number(payments[0].refunded_minor), 155);

await db.exec(`insert into private.event_analytics_visitors(event_id,day,visitor_hash) values
('${event}',current_date,'same-browser'),('${event}',current_date-1,'same-browser'),('${event}',current_date,'other-browser'),
('${otherEvent}',current_date,'same-browser');`);
assert.equal(Number((await report(selected)).event_visitors), 2);
assert.equal(Number((await report()).event_visitors), 3);

// Move activity just before the first of seven included UTC calendar days.
// Fixture timestamps only: production immutability triggers stay unchanged.
await db.exec('alter table vote_batches disable trigger user; alter table paid_vote_ledger disable trigger user;');
await db.exec(`update vote_batches set created_at=(date_trunc('day',now() at time zone 'UTC')-interval '6 days') at time zone 'UTC'-interval '1 second'; update paid_vote_ledger set confirmed_at=(date_trunc('day',now() at time zone 'UTC')-interval '6 days') at time zone 'UTC'-interval '1 second';`);
assert.equal(total((await report(selected, 7)).rows), 0);
assert.equal(total((await report(selected, 30)).rows), 98);
assert.equal(total((await report(selected, 0)).rows), 98);
assert.equal(Number((await report(selected, 7)).rows[0].gross_minor), 0);
assert.equal((await exportRows(`get_scoped_vote_export('${org}','${event}',7)`)).length, 0);
await db.exec(`update vote_batches set created_at=(date_trunc('day',now() at time zone 'UTC')-interval '6 days') at time zone 'UTC';`);
assert.equal(total((await report(selected, 7)).rows), 98);
await db.exec('alter table vote_batches enable trigger user; alter table paid_vote_ledger enable trigger user;');

await db.exec(`select apply_payment_adjustment('inclusive-fee-test','analytics-refund-2',9845,'refund');`);
data = await report(selected, 30);
for (const key of ['rows', 'nominees', 'categories', 'trends']) assert.equal(total(data[key]), 0, key);
assert.equal(Number(data.rows[0].net_minor), 0);
// More than the default hosted row cap, with same-named unrelated events.
await db.exec(`alter table vote_batches disable trigger user;
 insert into vote_batches(event_id,category_id,nominee_id,quantity)
 select '${otherEvent}','40000000-0000-4000-8000-000000000003','50000000-0000-4000-8000-000000000003',1 from generate_series(1,1101);
 alter table vote_batches enable trigger user;`);
assert.equal((await exportRows(`get_scoped_vote_export('${org}','${otherEvent}',7)`)).length, 1101);
assert.equal(total((await report(`'${otherEvent}'`)).rows), 1101);
assert.equal(total((await report(selected)).rows), 0);
await db.exec(`insert into sms_credit_purchases(organization_id,reference,credits,amount_minor) values('${org}','VCH-SMS-ANALYTICS12345',100,2000);`);
const sms = (await query(`select get_scoped_sms_export('${org}',7) data`))[0].data;
assert.equal(sms.length, 1); assert.equal(sms[0].entry_type, 'purchase'); assert.equal(Number(sms[0].credits), 100);
await db.exec(`insert into organizations(id,name,slug,created_by) values('20000000-0000-4000-8000-000000000002','Other organization','other-analytics-org','${outsider}');
 insert into events(id,organization_id,name,slug,unit_price_minor,starts_at,ends_at) values('30000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000002','Other event','other-analytics-event',100,now(),now()+interval '1 day');`);
await assert.rejects(() => report("'30000000-0000-4000-8000-000000000003'"));
await assert.rejects(() => report("'30000000-0000-4000-8000-000000000099'"));
await assert.rejects(() => report(selected, 2));
await db.exec(`select set_config('request.jwt.claim.sub','${outsider}',false); set role authenticated;`);
await assert.rejects(() => report(selected));
await assert.rejects(() => query(`select * from get_scoped_vote_export('${org}','${event}',7)`));
await assert.rejects(() => query(`select * from get_scoped_payment_export('${org}','${event}',7)`));
await assert.rejects(() => query(`select get_scoped_sms_export('${org}',7)`));
await db.exec('reset role; set role anon;');
await assert.rejects(() => report(selected));
await db.exec('reset role;');
await db.close();

const source = await fs.readFile('src/lib/analytics.ts', 'utf8');
const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const context = { exports: {}, require: createRequire(import.meta.url), URLSearchParams };
vm.runInNewContext(output, context);
const { categoryStandings, analyticsScope, csvValue } = context.exports;
const row = (id, category, votes) => ({ nominee_id: id, category_id: category, event_id: 'event', total_votes: votes });
const standings = categoryStandings([row('c', 'a', 1), row('a', 'a', 10), row('b', 'a', 10), row('d', 'b', 100)]);
assert.equal(standings.find(row => row.nominee_id === 'a').rank, 1);
assert.equal(standings.find(row => row.nominee_id === 'b').rank, 1);
assert.equal(standings.find(row => row.nominee_id === 'c').rank, 3);
assert.equal(standings.find(row => row.nominee_id === 'd').rank, 1);
assert.equal(analyticsScope({}).days, 30);
assert.equal(analyticsScope({ range: 'all', event }).days, 0);
assert.equal(analyticsScope({ range: '7', event }).params.p_event, event);
assert.throws(() => analyticsScope({ event: 'malformed' }));
assert.throws(() => analyticsScope({ event: [event, otherEvent] }));
assert.throws(() => analyticsScope({ range: '0' }));
assert.equal(csvValue('=1+1'), "'=1+1");
assert.equal(csvValue('A,"B"'), '"A,""B"""');
console.log('Analytics checks passed: scopes, date boundaries, refunds, trends, visitor deduplication, exports, access denial, category ties and CSV escaping.');


// Arrival must fetch event choices without requesting any analytics totals.
const pageSource = await fs.readFile('src/app/organizer/[organizationId]/analytics/page.tsx', 'utf8');
let analyticsCalls = 0;
const choicesQuery = { select() { return this; }, eq() { return this; }, async order() { return { data: [], error: null }; } };
const pageContext = { exports: {}, require(name) {
  if (name === '@/lib/auth/require-user') return { requireVerifiedUser: async () => ({ supabase: { from: () => choicesQuery, rpc: async () => { analyticsCalls++; throw new Error('Unexpected analytics request'); } } }) };
  if (name === '@/lib/analytics') return context.exports;
  if (name === 'react/jsx-runtime') return createRequire(import.meta.url)(name);
  return new Proxy({}, { get: () => () => null });
} };
vm.runInNewContext(ts.transpileModule(pageSource, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, pageContext);
await pageContext.exports.default({ params: Promise.resolve({ organizationId: org }), searchParams: Promise.resolve({}) });
assert.equal(analyticsCalls, 0, 'Unselected analytics page must not request totals');
console.log('Event selection gate passed: no analytics request before selecting an event.');
