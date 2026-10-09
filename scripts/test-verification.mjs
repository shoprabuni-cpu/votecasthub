process.on('uncaughtException', e => { console.error(e.message, e.where || ''); process.exit(1); });
import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { parseVoterRoster } from '../src/lib/voter-roster.ts';
assert.deepEqual(parseVoterRoster('\uFEFFindex_number,name\r\n"00123","Ada"\r\n"STU/2026/1","Ben"'), ['00123','STU/2026/1']);
assert.deepEqual(parseVoterRoster('email\na@example.test\na@example.test'), ['a@example.test']);
assert.deepEqual(parseVoterRoster('001;002,003\n004'), ['001','002','003','004']);
assert.throws(()=>parseVoterRoster('"unclosed'), /unclosed quote/);
const db = new PGlite();
const hash=s=>createHash('sha256').update(s).digest('hex');
const owner='10000000-0000-4000-8000-000000000001', voter='10000000-0000-4000-8000-000000000002', other='10000000-0000-4000-8000-000000000003', unverified='10000000-0000-4000-8000-000000000004';
const org='20000000-0000-4000-8000-000000000001', event='30000000-0000-4000-8000-000000000001', category='40000000-0000-4000-8000-000000000001', nominee='50000000-0000-4000-8000-000000000001';
try {
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
for (const file of (await fs.readdir('supabase/migrations')).filter(f=>f.endsWith('.sql')).sort()) {
 try { await db.exec(await fs.readFile(`supabase/migrations/${file}`,'utf8')); }
 catch(e) { throw new Error(`Migration ${file}: ${e.message}`,{cause:e}); }
}
console.log('All migrations applied to embedded PostgreSQL.');
const query=async(sql,args=[])=>(await db.query(sql,args)).rows;
const scalar=async(sql,args=[])=>Object.values((await query(sql,args))[0])[0];
const login=async uid=>{await db.exec('reset role'); await db.query("select set_config('request.jwt.claim.sub',$1,false)",[uid]); await db.exec('set role authenticated');};
const admin=()=>db.exec('reset role');
await db.exec(`insert into auth.users(id,email,email_confirmed_at,phone,phone_confirmed_at) values
 ('${owner}','owner@example.test',now(),null,null),('${voter}','voter@example.test',now(),'233241234567',now()),('${other}','other@example.test',now(),'233241234568',now()),('${unverified}','unverified@example.test',null,null,null);
 insert into public.organizations(id,name,slug,created_by) values('${org}','Roster Test','roster-test','${owner}');
 insert into public.organization_members(organization_id,user_id,role) values('${org}','${owner}','owner');
 insert into public.events(id,organization_id,name,slug,unit_price_minor,voting_mode,voting_rule,free_vote_limit_per_phone,starts_at,ends_at,status,verification_method) values('${event}','${org}','Roster Event','roster-event',0,'free','category_limit',10,now()-interval '1 hour',now()+interval '1 day','draft','voter_list');
 insert into public.categories(id,event_id,name) values('${category}','${event}','Category');
 insert into public.nominees(id,category_id,name) values('${nominee}','${category}','Nominee');`);
await login(owner);
assert.equal(await scalar(`select has_column_privilege('authenticated','events','organization_id','select')`),false);
await assert.rejects(()=>db.exec(`select organization_id from events`),/permission denied/);
assert.equal((await scalar(`select get_event_verification_readiness('${event}')`)).ready,false);
await assert.rejects(()=>db.exec(`select submit_event_for_review('${event}')`), /Import an approved voter list/);
const imported=await scalar(`select import_event_voters($1,$2,'identifier',2)`,[event,['00123456','STU/2026/001','00123456']]);
assert.equal(imported.count,2);
const claims=new Map(imported.claims.map(r=>[r.identifier,r.code]));
const normalized=await scalar(`select import_event_voters($1,$2,'identifier',2)`,[event,['STU/2026/001','stu/2026/001']]);
assert.equal(normalized.count,1); assert.equal(normalized.claims.length,1);
claims.set('STU/2026/001',normalized.claims[0].code);
await assert.rejects(()=>db.exec('select identifier_hash,claim_code_hash from event_voter_list_entries'),/permission denied/);
await assert.rejects(()=>db.exec(`update event_voter_list_entries set used_votes=0`),/permission denied/);
assert.equal((await query(`select id,label from event_voter_list_entries where event_id='${event}'`)).length,2);
assert.equal((await scalar(`select get_event_verification_readiness('${event}')`)).ready,true);
await assert.rejects(()=>db.exec(`insert into event_voter_list_entries(event_id,identifier_type,identifier_hash,created_by) values('${event}','identifier','x','${owner}')`),/permission denied/);
await assert.rejects(()=>db.query(`select import_event_voters($1,$2,'phone',1)`,[event,['not-a-phone']]),/Check the roster/);
await login(other);
assert.equal((await query(`select id from event_voter_list_entries`)).length,0);
await assert.rejects(()=>db.query(`select import_event_voters($1,$2,'identifier',1)`,[event,['unauthorized']]), /Organization access denied/);
await login(owner);
await db.exec(`select submit_event_for_review('${event}')`);
assert.equal(await scalar(`select status from events where id='${event}'`),'pending_review');
await admin();
await db.exec(`insert into platform_admins(user_id,role) values('${other}','admin')`);
await login(other);
await db.exec(`select admin_approve_event('${event}','Regression approval')`);
assert.equal(await scalar(`select status from events where id='${event}'`),'published');
await assert.rejects(()=>db.exec(`select admin_approve_event('${event}')`), /awaiting review/);
await admin();
await db.exec('set role service_role');
assert.equal((await scalar('select prepare_event_voter_verification($1,$2,$3,$4)',[event,'identifier','00123456',claims.get('00123456')])).success,true);
assert.match((await scalar('select prepare_event_voter_verification($1,$2,$3,$4)',[event,'identifier','00123456','WRONG'])).error,/incorrect/);
assert.match((await scalar('select prepare_event_voter_verification($1,$2,$3)',[event,'email','missing@example.test'])).error,/approved voter list/);
await admin();await db.exec('set role anon');
assert.deepEqual(await scalar('select get_event_voter_input_types($1)',[event]),['identifier']);
await assert.rejects(()=>scalar('select prepare_event_voter_verification($1,$2,$3)',[event,'identifier','00123456']),/permission denied/);
await admin();
await login(unverified);
await assert.rejects(()=>db.query('select create_organization($1,$2)',['Anonymous workspace','anonymous-workspace']),/Verify an organizer/);
assert.match((await scalar(`select verify_event_voter_identifier($1,$2,'identifier',$3)`,[event,'00123456','WRONG'])).error,/unavailable/);
assert.equal((await scalar(`select verify_event_voter_identifier($1,$2,'identifier',$3)`,[event,'STU/2026/001',claims.get('STU/2026/001')])).success,true);
assert.equal((await scalar(`select check_voter_event_eligibility('${event}')`)).is_verified,true);
await scalar('select cast_free_votes($1,$2,$3,1,$4)',[event,category,nominee,randomUUID()]);
await login(voter);
assert.equal((await scalar(`select check_voter_event_eligibility('${event}')`)).is_verified,false);
assert.match((await scalar(`select verify_event_voter_identifier($1,$2,'identifier')`,[event,'00123456'])).error,/unavailable/);
assert.equal((await scalar(`select verify_event_voter_identifier($1,$2,'identifier',$3)`,[event,' 00123456 ',claims.get('00123456')])).success,true);
assert.equal((await scalar(`select verify_event_voter_identifier($1,$2,'identifier',$3)`,[event,'00123456',claims.get('00123456')])).success,true);
assert.match((await scalar(`select verify_event_voter_identifier($1,$2,'identifier',$3)`,[event,'STU/2026/001',claims.get('STU/2026/001')])).error,/unavailable/);
assert.equal((await scalar(`select check_voter_event_eligibility('${event}')`)).is_verified,true);
const key=randomUUID();
const cast=key=>scalar(`select cast_free_votes($1,$2,$3,1,$4)`,[event,category,nominee,key]);
const batch=await cast(key);
assert.equal(await cast(key),batch);
await login(other);
assert.match((await scalar(`select verify_event_voter_identifier($1,$2,'identifier',$3)`,[event,'00123456',claims.get('00123456')])).error,/unavailable/);
await assert.rejects(()=>cast(randomUUID()),/unverified/);
await admin();
const secondCategory=randomUUID(), secondNominee=randomUUID();
await db.query('insert into categories(id,event_id,name) values($1,$2,$3)',[secondCategory,event,'Second Category']);
await db.query('insert into nominees(id,category_id,name) values($1,$2,$3)',[secondNominee,secondCategory,'Second Nominee']);
await login(voter);
await scalar('select cast_free_votes($1,$2,$3,1,$4)',[event,secondCategory,secondNominee,randomUUID()]);
await assert.rejects(()=>cast(randomUUID()),/exhausted/);
assert.equal((await scalar(`select check_voter_event_eligibility('${event}')`)).is_verified,false);
await login(owner);
const reimported=await scalar(`select import_event_voters($1,$2,'identifier',2)`,[event,['00123456']]);
assert.equal(reimported.claims.length,0);
const entry=await scalar(`select id from event_voter_list_entries where label='00123456'`);
await assert.rejects(()=>db.query('select update_event_voter_limit($1,1)',[entry]),/votes already used/);
await assert.rejects(()=>db.query('select remove_event_voter($1)',[entry]),/preserve/);
await admin();
assert.equal(await scalar(`select used_votes from event_voter_list_entries where id='${entry}'`),2);
// Exercise each method on a fresh event, including real caller permissions.
const makeEvent=async(method)=>{
 await admin(); const id=randomUUID(),cat=randomUUID(),nom=randomUUID();
 await db.query(`insert into events(id,organization_id,name,slug,unit_price_minor,voting_mode,voting_rule,free_vote_limit_per_phone,starts_at,ends_at,status,verification_method) values($1,$2,'Method Test',$1::uuid::text,0,'free','category_limit',10,now()-interval '1 hour',now()+interval '1 day','draft',$3)`,[id,org,method]);
 await db.query(`insert into categories(id,event_id,name) values($1,$2,'Category')`,[cat,id]);
 await db.query(`insert into nominees(id,category_id,name) values($1,$2,'Nominee')`,[nom,cat]);
 return {id,cat,nom};
};
for(const method of ['email','phone','invite_code','voter_list']) {
 const {id,cat,nom}=await makeEvent(method); await login(owner);
 if(method==='invite_code') {
  await assert.rejects(()=>db.query('select submit_event_for_review($1)',[id]),/active access code/);
  await db.query('select create_event_access_code($1,$2,1)',[id,hash('VOTE-TEST')]);
  assert.equal((await query('select id from event_access_codes where event_id=$1',[id])).length,1);
 } else if(method==='phone') {
  await assert.rejects(()=>db.query('select submit_event_for_review($1)',[id]),/SMS credits/);
  await admin(); await db.query(`insert into organization_sms_credits(organization_id,balance) values($1,100) on conflict(organization_id) do update set balance=100`,[org]); await login(owner);
 } else if(method==='voter_list') {
  await db.query(`select import_event_voters($1,$2,'email',3)`,[id,['voter@example.test']]);
  await db.query(`select import_event_voters($1,$2,'phone',3)`,[id,['0241234568']]);
 }
 await db.query('select submit_event_for_review($1)',[id]); await admin(); await db.query(`update events set status='published' where id=$1`,[id]);
 await login(unverified);
 await assert.rejects(()=>scalar('select cast_free_votes($1,$2,$3,1,$4)',[id,cat,nom,randomUUID()]));
 await login(method==='invite_code' ? unverified : voter);
 if(method==='invite_code') {
  assert.equal((await scalar('select verify_event_access_code($1,$2)',[id,hash('VOTE-TEST')])).success,true);
  assert.equal((await scalar('select verify_event_access_code($1,$2)',[id,hash('VOTE-TEST')])).success,true);
  await login(other); assert.match((await scalar('select verify_event_access_code($1,$2)',[id,hash('VOTE-TEST')])).error,/limit/); await login(unverified);
 } else if(method==='voter_list') {
  assert.match((await scalar(`select verify_event_voter_identifier($1,$2,'phone')`,[id,'0241234568'])).error,/Verify the email or phone/);
  assert.equal((await scalar(`select verify_event_voter_identifier($1,$2,'email')`,[id,'VOTER@EXAMPLE.TEST'])).success,true);
  await login(other); assert.equal((await scalar(`select verify_event_voter_identifier($1,$2,'phone')`,[id,'+233 24 123 4568'])).success,true); await login(voter);
 }
 assert.equal((await scalar('select check_voter_event_eligibility($1)',[id])).is_verified,true);
 await scalar('select cast_free_votes($1,$2,$3,1,$4)',[id,cat,nom,randomUUID()]);
 if(method==='invite_code') {
  await login(owner); const code=await scalar('select id from event_access_codes where event_id=$1',[id]); await db.query('select revoke_event_access_code($1)',[code]);
  await login(unverified); assert.equal((await scalar('select check_voter_event_eligibility($1)',[id])).is_verified,false);
  await assert.rejects(()=>scalar('select cast_free_votes($1,$2,$3,1,$4)',[id,cat,nom,randomUUID()]),/Redeem/);
 }
}
await login(other);
for(let i=0;i<11;i++) { const result=await scalar(`select verify_event_voter_identifier($1,$2,'identifier')`,[event,'missing']); if(i===10) assert.match(result.error,/Too many attempts/); }
await assert.rejects(()=>db.query('select redeem_event_voter_list_entry($1,$2,$3)',[event,hash('00123456'),'identifier']),/permission denied/);
await assert.rejects(()=>db.query('select redeem_event_access_code($1,$2)',[event,hash('VOTE-TEST')]),/permission denied/);
await admin();
const empty=await makeEvent('voter_list');
await assert.rejects(()=>db.query(`update events set status='published' where id=$1`,[empty.id]),/approved voter list/);
await login(owner);
await assert.rejects(()=>db.query(`select set_event_status($1,'publish')`,[empty.id]),/approved voter list/);
const normal=await scalar(`select import_event_voters($1,$2,'identifier',2)`,[empty.id,['INDEX-42']]);
assert.equal(normal.claims.length,1);
await admin(); await db.query('delete from nominees where category_id=$1',[empty.cat]); await login(owner);
await assert.rejects(()=>db.query('select submit_event_for_review($1)',[empty.id]),/Every active category/);
assert.equal(await scalar(`select has_function_privilege('anon','public.verify_event_voter_identifier(uuid,text,text,text)','execute')`),false);
await admin();
await db.query("select set_config('request.jwt.claim.sub','',false)");
await db.query(`insert into events(organization_id,name,slug,unit_price_minor,voting_mode,voting_rule,starts_at,ends_at,status,verification_method)
 select $1,'Directory '||lpad(n::text,3,'0'),'directory-'||n,0,'free','category_limit',
 case when n<=60 then now()-interval '1 hour' else now()+interval '1 day' end,
 now()+interval '2 days',case when n>90 then 'closed' else 'published' end,'email' from generate_series(1,100) n`,[org]);
await db.exec('set role anon');
const directory=async(status='all',offset=0,sort='name',search='Directory')=>scalar('select get_public_event_directory($1,$2,$3,$4,$5,$6)',[search,status,'all',sort,offset,24]);
const first=await directory();
assert.equal(first.total,100); assert.equal(first.events.length,24);
assert.equal(first.events[0].name,'Directory 001'); assert.equal(first.events[0].organization_name,'Roster Test');
assert.equal('organization_id' in first.events[0],false);
const seen=new Set();
for(let offset=0;offset<100;offset+=24)for(const item of (await directory('all',offset)).events){assert.equal(seen.has(item.id),false);seen.add(item.id);}
assert.equal(seen.size,100);
assert.equal((await directory('active')).total,90);
assert.equal((await directory('open')).total,60);
assert.equal((await directory('upcoming')).total,30);
assert.equal((await directory('closed')).total,10);
assert.equal((await directory('ending')).total,60);
assert.equal((await directory('all',0,'name','Directory 099')).total,1);
assert.equal((await directory('all',0,'name','%')).total,0);
await assert.rejects(()=>db.exec("select get_public_event_directory(p_limit=>1000)"),/Invalid event filters/);
await admin();
await db.query("update organizations set moderation_status='suspended' where id=$1",[org]);
await db.exec('set role anon');assert.equal((await directory()).total,0);
await admin();await db.query("update organizations set moderation_status='active' where id=$1",[org]);
// A previously valid review can become unpublishable while awaiting admin review.
await db.query("update events set status='draft' where id=$1",[empty.id]);
await db.query('insert into nominees(category_id,name) values($1,$2)',[empty.cat,'Restored nominee']);
await login(owner);await db.query('select submit_event_for_review($1)',[empty.id]);
await admin();await db.query('delete from nominees where category_id=$1',[empty.cat]);
await login(other);await assert.rejects(()=>db.query('select admin_approve_event($1)',[empty.id]),/Every active category/);
await admin();
assert.equal(await scalar('select status from events where id=$1',[empty.id]),'pending_review');
await login(owner);await assert.rejects(()=>db.query('select admin_approve_event($1)',[empty.id]),/Platform admin access/);
console.log('PASS: Verification safeguards, admin approval across tenants, stale/blocked reviews, and 100-event public directory pagination, timing filters, literal search, and suspended organization exclusion.');
} finally { await db.close(); }


