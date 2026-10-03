process.on('uncaughtException', e => { console.error(e.message, e.where || '', e.query || ''); process.exit(1); });
import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
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
for(const file of (await fs.readdir('supabase/migrations')).filter(f=>f.endsWith('.sql')).sort()){
 try { await db.exec(await fs.readFile(`supabase/migrations/${file}`,'utf8')); }
 catch(e){ console.error('Migration failed:',file,e.message);process.exit(1); }
}
console.log('All migrations applied to embedded PostgreSQL.');
const sql=await fs.readFile('supabase/tests/database/inclusive_platform_fee.test.sql','utf8');
const fixture=sql.slice(sql.indexOf('insert into auth.users'),sql.indexOf('select public.confirm_paid_vote'));
await db.exec(fixture);
const value=async sql=>(await db.query(sql)).rows[0];
await db.exec(`select public.confirm_paid_vote('inclusive-fee-test',123456,10000,195)`);
assert.equal(Number((await value(`select organizer_net_minor n from paid_vote_ledger`)).n),9000);
await db.exec(`select public.confirm_paid_vote('inclusive-fee-test',123456,10000,195)`);
assert.equal(Number((await value(`select count(*) n from vote_batches`)).n),1);
await db.exec(`update events set results_visibility='live' where id='30000000-0000-4000-8000-000000000001'`);
const count=async()=>Number((await value(`select vote_count n from get_public_event_results('30000000-0000-4000-8000-000000000001') where nominee_id='50000000-0000-4000-8000-000000000001'`)).n);
assert.equal(await count(),100);
await db.exec(`select apply_payment_adjustment('inclusive-fee-test','refund:1',155,'refund')`);
assert.equal(await count(),98); // only fully funded votes remain
assert.equal(Number((await value(`select organizer_net_minor n from paid_vote_ledger`)).n),8861);
await db.exec(`select apply_payment_adjustment('inclusive-fee-test','refund:1',155,'refund')`);
assert.equal(await count(),98);
await db.exec(`select apply_payment_adjustment('inclusive-fee-test','refund:2',9845,'refund')`);
assert.equal(await count(),0);
assert.equal(Number((await value(`select organizer_net_minor n from paid_vote_ledger`)).n),0);
await db.exec(`select public.confirm_paid_vote('inclusive-fee-test',123456,10000,195)`);
assert.equal(await count(),0);
assert.equal(Number((await value(`select sum(quantity) n from vote_batches`)).n),100);
await assert.rejects(()=>db.exec(`update vote_batches set quantity=1`));
assert.equal((await value(`select has_function_privilege('authenticated','public.confirm_paid_vote(text,bigint,bigint,bigint)','execute') b`)).b,false);
await db.exec(`select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',false)`);
await assert.rejects(()=>db.exec(`select * from get_organization_paid_earnings('20000000-0000-4000-8000-000000000001')`));
await db.exec(`insert into sms_credit_purchases(organization_id,reference,credits,amount_minor) values('20000000-0000-4000-8000-000000000001','VCH-SMS-123456789012',100,2000); select fulfill_sms_credit_purchase('VCH-SMS-123456789012',9001); select fulfill_sms_credit_purchase('VCH-SMS-123456789012',9001);`);
assert.equal(Number((await value(`select balance n from organization_sms_credits`)).n),100);
await db.exec(`update events set voting_mode='free',unit_price_minor=0 where id='30000000-0000-4000-8000-000000000001'`);
assert.equal((await value(`select prepare_voter_sms(repeat('a',64),'public-event') b`)).b,true);
assert.equal((await value(`select claim_sms_delivery(repeat('b',64),repeat('a',64),100) s`)).s,'claimed');
await db.exec(`select finish_sms_delivery(repeat('b',64),true)`);
assert.equal((await value(`select claim_sms_delivery(repeat('b',64),repeat('a',64),100) s`)).s,'sent');
assert.equal(Number((await value(`select balance n from organization_sms_credits`)).n),99);
await db.exec(`select apply_payment_adjustment('VCH-SMS-123456789012','refund:3',2000,'refund')`);
assert.equal(Number((await value(`select balance n from organization_sms_credits`)).n),-1);
assert.equal((await value(`select prepare_voter_sms(repeat('c',64),'public-event') b`)).b,false);
assert.equal((await value(`select payment_rate_limit('test',1,60) b`)).b,true);
assert.equal((await value(`select payment_rate_limit('test',1,60) b`)).b,false);
await db.exec(`insert into paystack_account_requests(organization_id) values('20000000-0000-4000-8000-000000000001')`);
await assert.rejects(()=>db.exec(`insert into paystack_account_requests(organization_id) values('20000000-0000-4000-8000-000000000001')`));
await db.close();
console.log('PASS: fees, duplicate confirmations, partial/full refunds, delayed success, immutable votes, tenant isolation, SMS purchases/debits/refunds, insufficient credits, rate limits and duplicate account reservations.');

