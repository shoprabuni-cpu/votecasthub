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
import { randomUUID } from 'node:crypto';
import ts from 'typescript';
import { z } from 'zod';
const org='20000000-0000-4000-8000-000000000001',org2='20000000-0000-4000-8000-000000000002';
const owner='10000000-0000-4000-8000-000000000001',other='10000000-0000-4000-8000-000000000002',admin='10000000-0000-4000-8000-000000000003',moderator='10000000-0000-4000-8000-000000000004';
const event='30000000-0000-4000-8000-000000000001',draft='30000000-0000-4000-8000-000000000002',cat='40000000-0000-4000-8000-000000000001',nominee='50000000-0000-4000-8000-000000000001';
const rows=async(sql,args=[])=>(await db.query(sql,args)).rows;
const scalar=async(sql,args=[])=>Object.values((await rows(sql,args))[0])[0];
const login=async id=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('set role authenticated');};
const privileged=async()=>{await db.exec('reset role');await db.exec("select set_config('request.jwt.claim.sub','',false)");};
const preview=async(kind,id)=>scalar('select get_admin_deletion_preview($1,$2)',[kind,id]);
const request=async(kind,id,name)=>scalar('select admin_request_deletion($1,$2,$3,$4)',[kind,id,name,'Delete unused data and reduce workspace storage.']);
const cancel=async id=>db.query('select admin_cancel_deletion($1,$2)',[id,'Cancelled for a further review']);
const run=async()=>{await privileged();return scalar('select process_admin_deletions(5)');};
const due=async id=>{await privileged();await db.query("update admin_deletion_jobs set scheduled_for=now()-interval '1 second',next_attempt_at=now() where id=$1",[id]);};
try {
 const sql=await fs.readFile('supabase/tests/database/inclusive_platform_fee.test.sql','utf8');
 await db.exec(sql.slice(sql.indexOf('insert into auth.users'),sql.indexOf('select public.confirm_paid_vote')));
 await db.query("insert into auth.users(id,email,email_confirmed_at) values($1,'admin@purge.test',now()),($2,'moderator@purge.test',now())",[admin,moderator]);
 await db.query("insert into platform_admins(user_id,role,is_active) values($1,'admin',true),($2,'moderator',true)",[admin,moderator]);
 await login(owner);await assert.rejects(()=>request('event',draft,'Draft Event'),/Only platform/);
 await assert.rejects(()=>preview('event',draft),/Platform admin/);
 await assert.rejects(()=>db.query('select process_admin_deletions(2)'),/permission denied/);
 await assert.rejects(()=>db.exec('insert into private.admin_purge_context values(txid_current())'),/permission denied/);
 await login(moderator);await assert.rejects(()=>request('event',draft,'Draft Event'),/Only platform/);
 await login(admin);assert.equal((await preview('event',draft)).immediate,true);
 await assert.rejects(()=>request('event',draft,'Wrong name'),/exact name/);
 await assert.rejects(()=>request('event',event,'Public Event'),/pending event payments/);
 await privileged();await db.query("insert into storage.objects(bucket_id,name) values('nominee-images',$1)",[`${draft}/cover.png`]);
 await login(admin);const removed=await request('event',draft,'Draft Event');assert.equal(removed.immediate,true);
 await privileged();assert.equal(await scalar('select count(*) from events where id=$1',[draft]),0);
 assert.equal(await scalar('select count(*) from event_image_cleanup where path=$1',[`${draft}/cover.png`]),1);
 assert.equal(await scalar("select count(*) from admin_audit_log where action='data_purged' and target_id=$1",[draft]),1);
 await db.exec("select confirm_paid_vote('inclusive-fee-test',123456,10000,195)");
 await db.query("update events set description='Long disposable description',image_path=$2 where id=$1",[event,`${event}/cover.png`]);
 await db.query("update nominees set biography='Biography to purge',image_path=$2 where id=$1",[nominee,`${event}/${nominee}.png`]);
 await db.query("insert into storage.objects(bucket_id,name) values('nominee-images',$1)",[`${event}/cover.png`]);
 await login(admin);let p=await preview('event',event);assert.equal(p.financial_history,true);assert.equal(p.immediate,false);
 const scheduled=await request('event',event,'Public Event');assert.equal(scheduled.immediate,false);
 assert.ok(new Date(scheduled.scheduled_for).getTime()>Date.now()+29*86400000);
 await assert.rejects(()=>request('event',event,'Public Event'),/already scheduled/);
 await login(owner);await assert.rejects(()=>db.query('select set_event_status($1,$2)',[event,'publish']),/scheduled for deletion|status change is not allowed/);
 await privileged();await assert.rejects(()=>db.query("update events set status='published',archived_at=null where id=$1",[event]),/scheduled for deletion/);
 assert.equal((await run()).completed,0);
 await login(admin);await cancel(scheduled.id);assert.equal((await preview('event',event)).job,null);
 await privileged();assert.equal(await scalar('select status from events where id=$1',[event]),'archived');
 await login(admin);const paid=await request('event',event,'Public Event');await due(paid.id);
 assert.equal((await run()).completed,1);
 await privileged();assert.ok(await scalar('select purged_at from events where id=$1',[event]));
 assert.equal(await scalar('select description from events where id=$1',[event]),null);
 assert.equal(await scalar('select biography from nominees where id=$1',[nominee]),null);
 assert.equal(await scalar('select count(*) from payment_attempts where event_id=$1',[event]),1);
 assert.equal(await scalar('select count(*) from vote_batches'),1);
 await db.exec("select apply_payment_adjustment('inclusive-fee-test','refund:after-purge',155,'refund')");
 assert.equal(Number(await scalar('select organizer_net_minor from paid_vote_ledger')),8861);
 await db.exec("select confirm_paid_vote('inclusive-fee-test',123456,10000,195)");
 assert.equal(await scalar('select count(*) from vote_batches'),1);
 await assert.rejects(()=>db.exec('delete from vote_batches'),/immutable/);
 await assert.rejects(()=>db.exec('delete from ledger_entries'),/immutable/);
 await login(admin);await assert.rejects(()=>request('event',event,'Public Event'),/already purged/);
 // An empty organization without historical references can be physically removed immediately.
 const empty=randomUUID();await privileged();await db.query("insert into organizations(id,name,slug) values($1,'Empty Organization','empty-organization')",[empty]);
 await db.query("insert into organization_members(organization_id,user_id,role) values($1,$2,'owner')",[empty,owner]);
 await login(admin);assert.equal((await preview('organization',empty)).immediate,true);
 const emptyJob=await request('organization',empty,'Empty Organization');assert.equal(emptyJob.immediate,true);
 await privileged();assert.equal(await scalar('select count(*) from organizations where id=$1',[empty]),0);
 // Free votes are removed only after the grace period, along with verification and content.
 const free=randomUUID(),freeCat=randomUUID(),freeNom=randomUUID();
 await db.query("insert into organizations(id,name,slug) values($1,'Free Organizer','free-organizer')",[org2]);
 await db.query("insert into organization_members(organization_id,user_id,role) values($1,$2,'owner')",[org2,other]);
 await db.query("insert into events(id,organization_id,name,slug,voting_mode,verification_method,free_vote_limit_per_phone,unit_price_minor,starts_at,ends_at,status,results_visibility) values($1,$2,'Free Event','free-purge-event','free','email',10,0,now()-interval '1 day',now()+interval '1 day','published','live')",[free,org2]);
 await db.query("insert into categories(id,event_id,name) values($1,$2,'Free category')",[freeCat,free]);
 await db.query("insert into nominees(id,category_id,name) values($1,$2,'Free nominee')",[freeNom,freeCat]);
 await login(other);await db.query('select cast_free_votes($1,$2,$3,1,$4)',[free,freeCat,freeNom,randomUUID()]);
 await privileged();await db.query("insert into event_voter_list_entries(event_id,identifier_hash,identifier_type,created_by) select $1,md5(i::text),'email',$2 from generate_series(1,5001) i",[free,other]);
 await login(admin);
 const saved=await scalar('select get_admin_deletion_snapshot($1,$2)',['event',free]);
 assert.equal(saved.standings[0].counted_votes,1);assert.equal(saved.preview.counts.roster_entries,5001);
 const freeJob=await request('event',free,'Free Event');assert.equal(freeJob.immediate,false);
 await due(freeJob.id);assert.equal((await run()).progressing,1);
 await privileged();assert.equal(await scalar('select count(*) from event_voter_list_entries where event_id=$1',[free]),1);
 assert.equal(await scalar('select count(*) from private.admin_purge_context'),0);
 await login(admin);await assert.rejects(()=>cancel(freeJob.id),/grace period has ended/);
 assert.equal((await run()).completed,1);
 await privileged();assert.equal(await scalar('select count(*) from events where id=$1',[free]),0);
 assert.equal(await scalar('select count(*) from vote_batches where event_id=$1',[free]),0);
 // Organization purge retains financial/audit references but removes workspace membership.
 await login(admin);const orgJob=await request('organization',org,'First Organization');assert.equal(orgJob.immediate,false);
 await due(orgJob.id);
 await privileged();await db.exec("update payment_attempts set status='pending',confirmed_at=null where provider_reference='inclusive-fee-test'");
 assert.equal((await run()).failed,1);
 await privileged();assert.match(await scalar('select last_error from admin_deletion_jobs where id=$1',[orgJob.id]),/pending vote payments/);
 assert.equal(await scalar('select count(*) from organization_members where organization_id=$1',[org]),1);
 await db.exec("update payment_attempts set status='succeeded',confirmed_at=now() where provider_reference='inclusive-fee-test'");
 await due(orgJob.id);assert.equal((await run()).completed,1);
 await privileged();assert.ok(await scalar('select purged_at from organizations where id=$1',[org]));
 assert.equal(await scalar('select count(*) from organization_members where organization_id=$1',[org]),0);
 assert.equal(await scalar('select count(*) from payment_attempts where organization_id=$1',[org]),1);
 assert.equal(await scalar('select count(*) from private.admin_purge_context'),0);
 assert.equal(await scalar("select has_function_privilege('authenticated','public.process_admin_deletions(integer)','execute')"),false);
 // Exercise the actual HTTP handler against the embedded database with a session adapter.
 let principal=null;
 const invalidations=[];
 const route={};
 const sessionClient={
  auth:{getClaims:async()=>({data:principal?{claims:{sub:principal}}:null,error:null})},
  from:()=>({select(){return this;},eq(){return this;},async maybeSingle(){return {data:(await rows('select role from platform_admins where user_id=$1 and is_active',[principal]))[0]??null};}}),
  async rpc(name,args){
   try {
    const data=name==='get_admin_deletion_snapshot'
     ? await scalar('select get_admin_deletion_snapshot($1,$2)',[args.p_kind,args.p_id])
     : name==='admin_request_deletion'
     ? await scalar('select admin_request_deletion($1,$2,$3,$4)',[args.p_kind,args.p_id,args.p_confirmation_name,args.p_reason])
     : await scalar('select admin_cancel_deletion($1,$2)',[args.p_job,args.p_reason]);
    return {data,error:null};
   } catch(error){return {data:null,error:{code:error.code,message:error.message}};}
  }
 };
 const code=ts.transpileModule(await fs.readFile('src/app/api/admin/deletions/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 new Function('require','exports',code)(name=>{
  if(name==='next/cache')return {revalidatePath:(...args)=>invalidations.push(args)};
  if(name==='zod')return {z};
  if(name==='@/lib/supabase/server')return {createClient:async()=>sessionClient};
  throw new Error(`Unexpected handler import ${name}`);
 },route);
 const post=async(body)=>route.POST(new Request('http://localhost/api/admin/deletions',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}));
 assert.equal((await post({})).status,401);
 principal=owner;await login(owner);assert.equal((await post({})).status,403);
 principal=moderator;await login(moderator);assert.equal((await post({})).status,403);
 principal=admin;await login(admin);assert.equal((await post({action:'request',kind:'event',targetId:'bad'})).status,400);
 const apiEvent=randomUUID();await privileged();await db.query("insert into events(id,organization_id,name,slug,voting_mode,verification_method,free_vote_limit_per_phone,unit_price_minor,starts_at,ends_at,status) values($1,$2,'API Event','api-purge-event','free','email',10,0,now()-interval '1 day',now()+interval '1 day','published')",[apiEvent,org2]);
 await login(admin);
 const body={action:'request',kind:'event',targetId:apiEvent,confirmationName:'API Event',reason:'Remove disposable event records after review.'};
 assert.equal((await post({...body,confirmationName:'Wrong'})).status,409);
 const response=await post(body);assert.equal(response.status,200);
 const payload=await response.json();assert.equal(payload.immediate,false);assert.ok(payload.id);
 const cancelled=await post({action:'cancel',jobId:payload.id,reason:'Keep this event for another review'});assert.equal(cancelled.status,200);
 assert.ok(invalidations.some(([path,type])=>path==='/admin'&&type==='layout'));
 const exportRequest=new Request(`http://localhost/api/admin/deletions?kind=event&targetId=${event}`);
 principal=null;assert.equal((await route.GET(exportRequest)).status,401);
 principal=owner;await login(owner);assert.equal((await route.GET(exportRequest)).status,403);
 principal=admin;await login(admin);const exported=await route.GET(exportRequest);assert.equal(exported.status,200);
 assert.equal(exported.headers.get('cache-control'),'private, no-store');
 assert.match(exported.headers.get('content-disposition'),/attachment/);
 assert.equal((await exported.json()).standings[0].counted_votes,98);
 // Automatic cleanup removes expired detail but retains active sessions and analytics totals.
 await privileged();
 await db.query("insert into ussd_sessions(session_id,phone_hash,event_id,expires_at) values('old-purge-session',repeat('a',64),$1,now()-interval '2 days'),('current-purge-session',repeat('b',64),$1,now()+interval '1 hour')",[apiEvent]);
 await db.exec("insert into payment_rate_limits(bucket,hits,expires_at) values('expired-purge-limit',1,now()-interval '2 days'),('current-purge-limit',1,now()+interval '1 hour')");
 await db.query("insert into private.event_analytics_visitors(event_id,day,visitor_hash) values($1,current_date-40,repeat('c',64)),($1,current_date-2,repeat('d',64))",[apiEvent]);
 await db.query("insert into event_analytics_daily(event_id,day,views,unique_visitors) values($1,current_date-40,10,8)",[apiEvent]);
 await db.exec('select cleanup_expired_operational_data()');
 assert.equal(await scalar("select count(*) from ussd_sessions where session_id='old-purge-session'"),0);
 assert.equal(await scalar("select count(*) from ussd_sessions where session_id='current-purge-session'"),1);
 assert.equal(await scalar("select count(*) from payment_rate_limits where bucket='expired-purge-limit'"),0);
 assert.equal(await scalar("select count(*) from payment_rate_limits where bucket='current-purge-limit'"),1);
 assert.equal(await scalar('select count(*) from private.event_analytics_visitors where event_id=$1',[apiEvent]),1);
 assert.equal(await scalar('select views from event_analytics_daily where event_id=$1',[apiEvent]),10);
 console.log('PASS: admin-only deletion, previews, exact confirmation, pending payment blockers, immediate unused deletion, grace period, cancellation, frozen items, free-vote purge, file cleanup queue, retained financial references, post-purge refunds and immutable paid history.');
 console.log('PASS: actual HTTP handler authentication, validation, request/cancel responses and cache invalidation; expired operational detail cleanup preserves current activity and analytics totals.');
} finally { await db.close(); }


