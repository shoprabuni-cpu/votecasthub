import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {createRequire} from 'node:module';import {createHmac} from 'node:crypto';import ts from 'typescript';
const require=createRequire(import.meta.url),cache=new Map();let dbCalls=0,votes=0,initiations=0;let flow='root';let chargeReply={status:'send_otp',reference:'VCH-USSD-'+ 'a'.repeat(32)},chargeCalls=[];
const secret='s'.repeat(32),phone='233241234567';let stored={session_id:'session',phone_hash:createHmac('sha256',secret).update('ussd:'+phone).digest('hex'),expires_at:new Date(Date.now()+600000).toISOString(),final_response:null};
const mocks={'server-only':{},'@/lib/payments/reconcile':{reconcileReference:async()=>true},'@/lib/payments/gateway':{allow:async()=>true,paystack:async(path,body)=>{chargeCalls.push({path,body});return chargeReply}},'@/lib/payments/admin':{paymentAdmin:()=>{dbCalls++;return {
 from:table=>{const q={select(){return this},eq(){return this},order(){return this},update(values){this.values=values;return this},maybeSingle:async()=>({data:table==='ussd_sessions'?{...stored}:table==='event_ussd_requests'?{event_id:'event',event_code:1000,dial_code:'*928*123#'}:null,error:null}),single:async()=>({data:{id:'event',name:'Test',voting_mode:flow,verification_method:'phone',unit_price_minor:100,free_vote_limit_per_phone:2},error:null}),then(resolve){if(this.values&&table==='ussd_sessions')Object.assign(stored,this.values);resolve({data:table==='categories'?[{id:'cat',name:'Category'}]:table==='nominees'?[{id:'nom',name:'Ama'}]:null,error:null})}};return q;},
 rpc:async(name,args)=>{
if(name==='begin_native_ussd'){if(stored.native_reply&&(!stored.native_reply.continueSession||args.p_new))return {data:{reply:stored.native_reply},error:null};stored.previous=stored.native_path??'';stored.native_path=args.p_new?stored.previous:stored.previous+(stored.previous?'*':'')+args.p_input;return {data:{path:stored.native_path,lease:'lease'},error:null}}
if(name==='finish_native_ussd'){if(args.p_failed||args.p_restore_path)stored.native_path=stored.previous;else stored.native_reply=args.p_reply;return {error:null}}
if(name==='get_public_ussd')return {data:[{network_notice:'Session sponsored'}],error:null};if(name==='find_ussd_voter')return {data:'voter',error:null};if(name==='cast_verified_ussd_vote'){votes++;return {data:'batch',error:null}};if(name==='find_ussd_receipt_email')return {data:null,error:null};if(name==='claim_ussd_charge'){const fresh=!stored.charge_started;stored.charge_started=true;return {data:fresh,error:null}};if(name==='reserve_ussd_payment'||name==='reserve_paystack_ussd_payment'){stored.reference='VCH-USSD-'+'a'.repeat(32);return {data:{provider_reference:stored.reference,total_amount_minor:200,subaccount_code:'ACCT_test'},error:null}};return {data:null,error:null}}
 }}}};
function load(file){file=path.resolve(file);if(cache.has(file))return cache.get(file).exports;const mod={exports:{}};cache.set(file,mod);const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;new Function('require','module','exports',code)(name=>{if(mocks[name])return mocks[name];if(name.startsWith('.')||name.startsWith('@/')){const base=name.startsWith('@/')?path.resolve('src',name.slice(2)):path.resolve(path.dirname(file),name);return load(['.ts','.tsx'].map(ext=>base+ext).find(fs.existsSync))}return require(name)},mod,mod.exports);return mod.exports}
const {handleArkeselUssd}=load('src/lib/ussd/arkesel.ts'),{menuSelection}=load('src/lib/ussd/menu.ts');
Object.assign(process.env,{USSD_ENABLED:'true',USSD_PAYMENT_PROVIDER:'adapter',USSD_ADAPTER_CONTRACT:'normalized-v1',USSD_ADAPTER_URL:'https://adapter.example',USSD_ADAPTER_TOKEN:'t'.repeat(32),ARKESEL_USSD_SHARED_SECRET:secret,ARKESEL_USSD_SERVICE_CODE:'*928*123#'});
function request(text='',signed=true,timestamp=String(Math.floor(Date.now()/1000))){const raw=new URLSearchParams({sessionId:'session',serviceCode:'*928*123#',phoneNumber:phone,text}).toString();return new Request('https://site/api/ussd',{method:'POST',body:raw,headers:signed?{'x-vch-timestamp':timestamp,'x-vch-signature':createHmac('sha256',secret).update(timestamp+'.'+raw).digest('hex')}:undefined})}
assert.equal((await handleArkeselUssd(request('',false))).status,401);assert.equal(dbCalls,0);
assert.equal((await handleArkeselUssd(request('',true,'1000000000'))).status,401);
assert.match(await (await handleArkeselUssd(request())).text(),/^CON VotecastHub/);
stored={...stored,phone_hash:'other'};assert.equal((await handleArkeselUssd(request())).status,403);
stored={...stored,phone_hash:createHmac('sha256',secret).update('ussd:'+phone).digest('hex'),expires_at:new Date(0).toISOString()};assert.match(await (await handleArkeselUssd(request())).text(),/expired/);
stored={...stored,expires_at:new Date(Date.now()+600000).toISOString(),final_response:'Already recorded'};assert.equal(await (await handleArkeselUssd(request('1*1000*1*1*1*1'))).text(),'END Already recorded');
process.env.USSD_ENABLED='false';assert.equal((await handleArkeselUssd(request())).status,503);
const items=Array.from({length:11},(_,i)=>({id:String(i),name:'Nominee '+i}));assert.match(menuSelection(items,[],0).prompt,/9. More/);assert.equal(menuSelection(items,['9','2'],0).item.id,'5');assert.equal(menuSelection(items,['9','9','8','1'],0).item.id,'4');assert.equal(menuSelection(items,['9','9','4'],0).error,true);
process.env.USSD_ENABLED='true';flow='free';stored={...stored,final_response:null,reference:null,vote_request:'key'};
let result=await handleArkeselUssd(request('1*1000*1*1*1'));assert.match(await result.text(),/1. Confirm/);assert.equal(votes,0);
result=await handleArkeselUssd(request('1*1000*1*1*1*1'));assert.match(await result.text(),/recorded for Ama/);await handleArkeselUssd(request('1*1000*1*1*1*1'));assert.equal(votes,1);
flow='paid';stored={...stored,final_response:null,reference:null};globalThis.fetch=async(_url,options)=>{initiations++;const payload=JSON.parse(options.body);return Response.json({accepted:true,reference:payload.reference})};
result=await handleArkeselUssd(request('1*1000*1*1*2'));assert.match(await result.text(),/GH₵2.00/);assert.equal(initiations,0);
result=await handleArkeselUssd(request('1*1000*1*1*2*1'));assert.match(await result.text(),/Mobile Money prompt/);await handleArkeselUssd(request('1*1000*1*1*2*1'));assert.equal(initiations,1);
console.log('PASS: free and paid menus, explicit confirmation, totals, single vote and single payment initiation on retry');
console.log('PASS: disabled gate, mandatory full-body signature, stale signature, caller binding, expiry, completed-session replay and paginated menus');

const {verifiedUssdTransaction}=load('src/lib/ussd/provider.ts');
let transaction={reference:'VCH-USSD-'+ 'a'.repeat(32),transactionId:10,mode:'test',status:'success',amount:200,currency:'GHS',fees:2};globalThis.fetch=async()=>Response.json(transaction);
assert.equal((await verifiedUssdTransaction(transaction.reference)).amount,200);
transaction={...transaction,mode:'live'};await assert.rejects(verifiedUssdTransaction(transaction.reference),/mode mismatch/);
transaction={...transaction,mode:'test',currency:'USD'};await assert.rejects(verifiedUssdTransaction(transaction.reference));
transaction={...transaction,currency:'GHS',reference:'other'};await assert.rejects(verifiedUssdTransaction('expected'),/reference mismatch/);
console.log('PASS: authoritative transaction contract, amount units, currency, reference and test/live mode validation');

const {handleNativeArkesel}=load('src/lib/ussd/native-arkesel.ts');
Object.assign(process.env,{USSD_SESSION_PROTOCOL:'arkesel-json',ARKESEL_USSD_USER_ID:'USSD_DOCUMENTATION',ARKESEL_USSD_CALLBACK_TOKEN:'k'.repeat(32)});process.env.USSD_ADAPTER_URL='';process.env.USSD_ADAPTER_TOKEN='';
flow='free';stored={...stored,final_response:null,reference:null,native_path:'',native_reply:null};const before=votes;
function native(userData,newSession=false,key='k'.repeat(32),userID='USSD_DOCUMENTATION'){return new Request('https://site/api/ussd/arkesel?key='+key,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({sessionID:'session',userID,newSession,msisdn:phone,userData,network:'AIRTELTIGO'})})}
assert.equal((await handleNativeArkesel(native('*928*123#',true,'wrong'))).status,401);assert.equal((await handleNativeArkesel(native('*928*123#',true,undefined,'wrong'))).status,403);
let nativeReply=await (await handleNativeArkesel(native('*928*123#',true))).json();assert.equal(nativeReply.continueSession,true);assert.equal(nativeReply.sessionID,'session');assert.equal(nativeReply.msisdn,phone);
for(const value of ['1','1000','1','1','1'])nativeReply=await (await handleNativeArkesel(native(value))).json();
const challenge=nativeReply.message.match(/Enter (\d{6}) to confirm/)[1];assert.equal(votes,before);
nativeReply=await (await handleNativeArkesel(native('1'))).json();assert.equal(nativeReply.continueSession,true);assert.equal(votes,before);
nativeReply=await (await handleNativeArkesel(native(challenge))).json();assert.equal(nativeReply.continueSession,false);assert.match(nativeReply.message,/recorded for Ama/);assert.equal(votes,before+1);
assert.deepEqual(await (await handleNativeArkesel(native(challenge))).json(),nativeReply);assert.equal(votes,before+1);
console.log('PASS: native Arkesel JSON contract, subscription and URL authentication, incremental menus, free-only configuration, safe confirmation and completed callback replay');

process.env.USSD_PAYMENT_PROVIDER='paystack';process.env.PAYSTACK_SECRET_KEY='sk_test_example';flow='paid';
stored={...stored,final_response:null,reference:null,native_path:'',native_reply:null,charge_status:null,charge_started:false,awaiting_email:false,payment_email:null,native_network:'MTN'};
await handleNativeArkesel(native('*928*123#',true));await handleNativeArkesel(native('1'));nativeReply=await (await handleNativeArkesel(native('1000'))).json();assert.match(nativeReply.message,/email/);
assert.equal((await (await handleNativeArkesel(native('invalid-email'))).json()).continueSession,true);
nativeReply=await (await handleNativeArkesel(native('payer@example.com'))).json();assert.match(nativeReply.message,/Choose category/);assert.equal(stored.native_path,'1*1000');assert.equal(stored.payment_email,'payer@example.com');
for(const value of ['1','1','2'])nativeReply=await (await handleNativeArkesel(native(value))).json();const paymentChallenge=nativeReply.message.match(/Enter (\d{6}) to confirm/)[1];
nativeReply=await (await handleNativeArkesel(native(paymentChallenge))).json();assert.equal(nativeReply.continueSession,true);assert.match(nativeReply.message,/OTP/);
assert.equal(chargeCalls[0].path,'/charge');assert.equal(chargeCalls[0].body.mobile_money.provider,'mtn');assert.equal(chargeCalls[0].body.mobile_money.phone,'0241234567');assert.equal(chargeCalls[0].body.email,'payer@example.com');assert.equal(chargeCalls[0].body.amount,200);assert.equal(chargeCalls[0].body.subaccount,'ACCT_test');assert.equal(chargeCalls[0].body.transaction_charge,20);
chargeReply={...chargeReply,status:'pay_offline'};nativeReply=await (await handleNativeArkesel(native('24682468'))).json();assert.equal(nativeReply.continueSession,false);assert.match(nativeReply.message,/Mobile Money prompt/);
assert.equal(chargeCalls[1].path,'/charge/submit_otp');assert.equal(chargeCalls[1].body.otp,'24682468');assert.equal(stored.native_path.includes('24682468'),false,'OTP never persists in navigation');
await handleNativeArkesel(native('24682468'));assert.equal(chargeCalls.length,2,'Completed callback does not resend a charge or OTP');
console.log('PASS: native Paystack MoMo charge, customer receipt email, organizer split, OTP continuation without persisted OTP, offline approval and retry safety');

process.env.USSD_SIMULATOR_MODE='true';process.env.USSD_PAYMENT_PROVIDER='paystack';process.env.ARKESEL_USSD_USER_ID='';process.env.PAYSTACK_SECRET_KEY='sk_test_example';process.env.USSD_SIMULATOR_EVENT_IDS='';
flow='free';stored={...stored,native_path:'',native_reply:null,final_response:null,reference:null,charge_status:null,awaiting_email:false,payment_email:null};
nativeReply=await (await handleNativeArkesel(native('*928*123#',true,undefined,''))).json();assert.equal(nativeReply.continueSession,true);
assert.equal((await handleNativeArkesel(native('*928*123#',true,'wrong',''))).status,401);
await handleNativeArkesel(native('1',false,undefined,''));nativeReply=await (await handleNativeArkesel(native('1000',false,undefined,''))).json();assert.match(nativeReply.message,/Simulator test event not configured/);
stored={...stored,native_path:'',native_reply:null,final_response:null};process.env.USSD_SIMULATOR_EVENT_IDS='event';await handleNativeArkesel(native('*928*123#',true,undefined,''));await handleNativeArkesel(native('1',false,undefined,''));nativeReply=await (await handleNativeArkesel(native('1000',false,undefined,''))).json();assert.match(nativeReply.message,/Choose category/);
process.env.PAYSTACK_SECRET_KEY='sk_live_example';assert.equal((await handleNativeArkesel(native('*928*123#',true,undefined,''))).status,503);
process.env.PAYSTACK_SECRET_KEY='sk_test_example';process.env.USSD_PAYMENT_PROVIDER='adapter';assert.equal((await handleNativeArkesel(native('*928*123#',true,undefined,''))).status,503);
process.env.USSD_PAYMENT_PROVIDER='paystack';process.env.USSD_SIMULATOR_MODE='false';assert.equal((await handleNativeArkesel(native('*928*123#',true,undefined,''))).status,503);
console.log('PASS: unlinked simulator IDs, mandatory secret URL, event allowlist, live-key and alternate-provider rejection, strict live subscription configuration');
