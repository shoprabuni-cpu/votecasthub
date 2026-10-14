import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
function load(file, mocks) {
  const fixture = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('require', 'exports', code)(name => mocks[name] ?? require(name), fixture.exports);
  return fixture.exports;
}
const { ussdLiveReadiness } = load('src/lib/ussd/live-readiness.ts', { 'server-only': {} });
const env = { VERCEL_ENV:'production', NEXT_PUBLIC_SUPABASE_URL:'https://live-project.supabase.co', NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'public', SUPABASE_SECRET_KEY:'private-key', NEXT_PUBLIC_SITE_URL:'https://votecasthub.example', CRON_SECRET:'c'.repeat(32), PAYSTACK_SECRET_KEY:'sk_live_example', USSD_ENABLED:'false', USSD_SIMULATOR_MODE:'false', USSD_SESSION_PROTOCOL:'arkesel-json', USSD_PAYMENT_PROVIDER:'paystack', ARKESEL_USSD_CALLBACK_TOKEN:'k'.repeat(32), ARKESEL_USSD_SHARED_SECRET:'s'.repeat(32) };
assert.equal(ussdLiveReadiness(env).prepared, true);
assert.equal(ussdLiveReadiness(env).configured, false);
assert.equal(ussdLiveReadiness({ ...env, VERCEL_ENV:'preview' }).prepared, false);
assert.equal(ussdLiveReadiness({ ...env, PAYSTACK_SECRET_KEY:'sk_test_example' }).prepared, false);
assert.equal(ussdLiveReadiness({ ...env, ARKESEL_USSD_SERVICE_CODE:'*928*123#', ARKESEL_USSD_USER_ID:'assigned' }).configured, false);
assert.equal(ussdLiveReadiness({ ...env, USSD_ENABLED:'true' }).enabled, false);
assert.equal(ussdLiveReadiness({ ...env, USSD_LIVE_LAUNCH_ENABLED:'true', ARKESEL_USSD_SERVICE_CODE:'*928*123#', ARKESEL_USSD_USER_ID:'assigned' }).configured, true);
assert(!JSON.stringify(ussdLiveReadiness(env)).includes('private-key'));

const reference = 'VCH-USSD-'+'a'.repeat(32);
let transaction = { id:10,reference,status:'failed',amount:100,currency:'GHS',domain:'live',fees:0,subaccount:{subaccount_code:'ACCT_live'} };
let status='pending', confirmations=0, adjustments=0, missing=false;
const db = {
  from() { const query={ values:null, select(){return this;},eq(){return this;},update(values){this.values=values;return this;},maybeSingle:async()=>({data:missing?null:{provider:'paystack',status,total_amount_minor:100,currency:'GHS',subaccount_code:'ACCT_live'},error:null}),then(resolve){if(this.values && status==='pending')status=this.values.status;resolve({error:null});} };return query; },
  async rpc(name) { if(name==='confirm_paid_vote'){confirmations++;status='succeeded';}if(name==='apply_payment_adjustment'){adjustments++;status='refunded';}return {error:null}; },
};
const { reconcileReference, processPaymentJob } = load('src/lib/payments/reconcile.ts', {
  'server-only': {}, '@/lib/ussd/reconcile':{}, '@/lib/ussd/provider':{},
  './admin':{paymentAdmin:()=>db}, './gateway':{paystack:async()=>transaction}, './paystack':{paystackSecret:()=> 'sk_live_example'},
});
assert.equal(await reconcileReference(reference), false);assert.equal(status,'failed');assert.equal(confirmations,0);
assert.equal(await processPaymentJob('charge.success',reference), true);
status='pending';transaction={...transaction,status:'pending'};assert.equal(await processPaymentJob('charge.success',reference),false);assert.equal(status,'pending');
transaction={...transaction,status:'success'};assert.equal(await reconcileReference(reference),true);assert.equal(confirmations,1);
transaction={...transaction,status:'reversed'};assert.equal(await reconcileReference(reference),false);assert.equal(adjustments,1);
assert.equal(await processPaymentJob('charge.success',reference),true,'Verified reversal completes recovery without telling the voter it succeeded');
transaction={...transaction,status:'failed',domain:'test'};status='pending';await assert.rejects(reconcileReference(reference),/mode mismatch/);assert.equal(status,'pending');
transaction={...transaction,status:'success',domain:'live',reference:'wrong'};await assert.rejects(reconcileReference(reference),/Reference mismatch/);
transaction={...transaction,reference};missing=true;await assert.rejects(reconcileReference(reference),/attempt not found/);
const recoveryOrder=[];let adapterCalls=0;
const recoveryDb={
  from(table){const query={select(){return this;},is(){return this;},order(){return this;},limit(){return this;},eq(){return this;},lt(){return this;},delete(){return this;},update(){return this;},upsert(){return this;},maybeSingle:async()=>({data:null,error:null}),then(resolve){if(table==='payment_jobs')recoveryOrder.push('jobs');resolve({data:[],error:null});}};return query;},
  async rpc(name){recoveryOrder.push(name);return {error:null};},
};
const recovery=load('src/app/api/payments/paystack/reconcile/route.ts',{
  '@/lib/ussd/reconcile':{reconcileUssdBatch:async()=>{adapterCalls++;return 0;}},
  '@/lib/ussd/provider':{ussdConfiguration:()=>({success:true,data:{USSD_PAYMENT_PROVIDER:'paystack'}})},
  '@/lib/payments/admin':{paymentAdmin:()=>recoveryDb},
  '@/lib/payments/gateway':{paystack:async()=>[]},
  '@/lib/payments/reconcile':{processPaymentJob:async()=>true},
  '@/lib/events/image-cleanup':{cleanupEventImages:async()=>{}},
  '@/lib/events/deletion-cleanup':{processOrganizerEventDeletions:async()=>{}},
  '@/lib/admin/process-deletions':{processAdminDeletions:async()=>({completed:0,failed:0})},
});
const priorSecret=process.env.CRON_SECRET;process.env.CRON_SECRET='c'.repeat(32);
try{
  assert.equal((await recovery.GET(new Request('https://site/api/payments/paystack/reconcile'))).status,401);
  assert.equal((await recovery.GET(new Request('https://site/api/payments/paystack/reconcile',{headers:{authorization:'Bearer '+process.env.CRON_SECRET}}))).status,200);
  assert.equal(adapterCalls,0);
  assert(recoveryOrder.indexOf('enqueue_pending_payments')<recoveryOrder.indexOf('jobs'));
  assert(recoveryOrder.indexOf('enqueue_ussd_access_reconciliation')<recoveryOrder.indexOf('jobs'));
}finally{if(priorSecret===undefined)delete process.env.CRON_SECRET;else process.env.CRON_SECRET=priorSecret;}
console.log('PASS: pre-purchase readiness, live/test isolation, verified decline recovery, success/reversal distinction, cron authentication and same-run queueing without the unused adapter');
