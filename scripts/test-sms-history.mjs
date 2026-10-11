process.on('uncaughtException', e => { console.error(e.stack, e.where || '', e.query || ''); process.exit(1); });
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

try {
 for (const file of (await fs.readdir('supabase/migrations')).filter(file=>file.endsWith('.sql')).sort()) {
  if (file === '20261204100000_sms_purchase_history_read_access.sql') {
   const prior = await db.query("select has_table_privilege('authenticated','public.sms_credit_purchases','SELECT') as allowed");
   assert.equal(prior.rows[0].allowed, false, 'Reproduce the missing history permission before the repair');
  }
  await db.exec(await fs.readFile('supabase/migrations/'+file,'utf8'));
 }
 const owner='10000000-0000-4000-8000-000000000001', other='10000000-0000-4000-8000-000000000002';
 const org='20000000-0000-4000-8000-000000000001', otherOrg='20000000-0000-4000-8000-000000000002';
 await db.query("insert into auth.users(id,email,email_confirmed_at) values($1,'owner@sms.test',now()),($2,'other@sms.test',now())",[owner,other]);
 await db.query("insert into organizations(id,name,slug) values($1,'SMS owner','sms-owner'),($2,'SMS other','sms-other')",[org,otherOrg]);
 await db.query("insert into organization_members(organization_id,user_id,role) values($1,$2,'owner'),($3,$4,'owner')",[org,owner,otherOrg,other]);
 await db.query("insert into sms_credit_purchases(organization_id,reference,credits,amount_minor,status) values($1,'VCH-SMS-OWNER-PURCHASE-001',100,500,'paid'),($2,'VCH-SMS-OTHER-PURCHASE-001',100,500,'pending')",[org,otherOrg]);
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",[owner]);
 await db.exec('set role authenticated');
 const history=await db.query('select reference,credits,amount_minor,status,refunded_amount_minor,created_at from sms_credit_purchases where organization_id=$1 order by created_at desc limit 25',[org]);
 assert.equal(history.rows.length,1);assert.equal(history.rows[0].status,'paid');
 assert.equal((await db.query('select reference from sms_credit_purchases where organization_id=$1',[otherOrg])).rows.length,0,'Other organizers remain private');
 assert.equal((await db.query('select reference from sms_credit_purchases')).rows.length,1,'Unfiltered reads remain tenant-scoped');
 await assert.rejects(()=>db.exec("update sms_credit_purchases set status='failed'"),/permission denied/);
 await assert.rejects(()=>db.exec('delete from sms_credit_purchases'),/permission denied/);
 await db.exec('reset role; set role anon');
 await assert.rejects(()=>db.exec('select reference from sms_credit_purchases'),/permission denied/);
 console.log('PASS: missing SELECT permission reproduced; actual page query loads history after repair; cross-organizer and anonymous reads, updates and deletion remain blocked.');
} finally {await db.close();}
