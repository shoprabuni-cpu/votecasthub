import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
const require=createRequire(import.meta.url);
const calls=[];
let prepared, current, otpError, redemptionError, anonymousError, allowed, security;
function reset(){calls.length=0;prepared={success:true,slug:'test-event',method:'voter_list'};current=null;otpError=null;redemptionError=null;anonymousError=null;allowed=true;security=true;delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;delete process.env.TURNSTILE_SECRET_KEY;}
const supabase={auth:{
 getUser:async()=>({data:{user:current}}),
 signInAnonymously:async options=>{calls.push({name:'anonymous',options});return {error:anonymousError};},
 verifyOtp:async options=>{calls.push({name:'otp',options});return {error:otpError};},
},rpc:async(name,args)=>{calls.push({name,args});return {data:redemptionError?{error:redemptionError}:{success:true},error:null};}};
const mocks={
 'next/headers':{headers:async()=>new Headers({'x-vercel-forwarded-for':'192.0.2.1'})},
 'next/cache':{revalidatePath:path=>calls.push({name:'revalidate',path})},
 '@/lib/auth/voter-auth':{createVoterAuth:async()=>supabase.auth},
 '@/lib/supabase/server':{createClient:async()=>supabase},
 '@/lib/payments/admin':{paymentAdmin:()=>({rpc:async(name,args)=>{calls.push({name,args});return {data:prepared,error:null};}})},
 '@/lib/payments/gateway':{allow:async()=>allowed},
 '@/lib/auth/phone':{normalizeGhanaPhone:value=>value.startsWith('0')?'+233'+value.slice(1):value},
 '@/lib/auth/actions':Object.fromEntries(['Phone','Email'].map(type=>['requestVoter'+type+'CodeAction',async(_,form)=>{calls.push({name:'send'+type,fields:Object.fromEntries(form)});return {message:'Code sent',success:true,codeSent:true};}])),
};
const compiled=ts.transpileModule(fs.readFileSync('src/lib/auth/voter-verification.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const compiledModule={exports:{}};new Function('require','module','exports',compiled)(name=>mocks[name]??require(name),compiledModule,compiledModule.exports);
const action=compiledModule.exports.verifyEventVoterAction;
const form=(type,extra={})=>{const data=new FormData();for(const [key,value] of Object.entries({eventId:'10000000-0000-4000-8000-000000000001',type,identifier:type==='phone'?'0241234567':type==='email'?'voter@example.test':'INDEX-001',...extra}))data.set(key,value);return data;};
reset();prepared={error:'Not on the approved list'};assert.match((await action(null,form('phone'))).message,/approved list/);assert.equal(calls.some(c=>c.name==='sendPhone'),false);
reset();await action(null,form('phone'));assert.equal(calls.at(-1).name,'sendPhone');assert.equal(calls.at(-1).fields.phone,'+233241234567');assert.equal(calls.at(-1).fields.next,'/events/test-event');
reset();await action(null,form('email'));assert.equal(calls.at(-1).name,'sendEmail');
reset();assert.equal((await action(null,form('email',{otp:'123456'}))).success,true);assert.equal(calls.find(c=>c.name==='otp').options.type,'email');assert.ok(calls.some(c=>c.name==='verify_event_voter_identifier'));assert.equal(calls.at(-1).name,'revalidate');
reset();prepared.method='phone';await action(null,form('phone',{otp:'123456'}));assert.equal(calls.find(c=>c.name==='otp').options.type,'sms');assert.equal(calls.some(c=>c.name==='verify_event_voter_identifier'),false);
reset();otpError={};assert.match((await action(null,form('email',{otp:'123456'}))).message,/invalid or expired/);assert.equal(calls.some(c=>c.name==='verify_event_voter_identifier'),false);
reset();prepared={error:'Incorrect private code'};await action(null,form('identifier',{claimCode:'BAD'}));assert.equal(calls.some(c=>c.name==='anonymous'),false);
reset();process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY='test';assert.equal((await action(null,form('identifier',{claimCode:'secret','cf-turnstile-response':'captcha'}))).success,true);assert.equal(calls.find(c=>c.name==='anonymous').options.options.captchaToken,'captcha');assert.equal(calls.find(c=>c.name==='verify_event_voter_identifier').args.p_claim_code,'SECRET');
reset();prepared.method='invite_code';await action(null,form('invite_code',{identifier:'vote-abc'}));assert.match(calls.find(c=>c.name==='verify_event_access_code').args.p_code_hash,/^[a-f0-9]{64}$/);
reset();anonymousError={};await action(null,form('invite_code'));assert.equal(calls.some(c=>c.name==='verify_event_access_code'),false);
reset();process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY='test';current={id:'existing'};process.env.TURNSTILE_SECRET_KEY='server-secret';const oldFetch=globalThis.fetch;globalThis.fetch=async()=>({ok:true,json:async()=>({success:security})});
try{security=false;assert.match((await action(null,form('invite_code',{'cf-turnstile-response':'expired'}))).message,/expired/);assert.equal(calls.some(c=>c.name==='verify_event_access_code'),false);security=true;assert.equal((await action(null,form('invite_code',{'cf-turnstile-response':'fresh'}))).success,true);assert.equal(calls.some(c=>c.name==='anonymous'),false);}finally{globalThis.fetch=oldFetch;}
reset();allowed=false;assert.match((await action(null,form('phone'))).message,/Too many/);assert.equal(calls.length,0);
reset();assert.equal((await action(null,form('identifier',{otp:'123456'}))).success,undefined);assert.equal(calls.length,0);
reset();process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY='test';assert.match((await action(null,form('email'))).message,/security/);assert.equal(calls.length,0);
reset();redemptionError='Allowance exhausted';assert.match((await action(null,form('identifier',{claimCode:'secret'}))).message,/exhausted/);
reset();
console.log('PASS: On-page verification actions: roster preflight before OTP/session creation, phone/email OTP, anonymous code redemption, captcha rejection, rate limits, invalid OTPs and exhausted allowances.');
