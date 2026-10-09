import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const {Webhook}=require('standardwebhooks');
const compiled={exports:{}};
new Function('require','module','exports',ts.transpileModule(fs.readFileSync('src/lib/sms/arkesel-hook.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText)(name=>name==='server-only'?{}:name==='next/server'?{after:()=>{throw Error('Test must supply scheduler')}}:require(name),compiled,compiled.exports);
const {handleArkeselSmsHook}=compiled.exports;
const secret='whsec_'+Buffer.from('test-secret-at-least-thirty-two-bytes').toString('base64');
const env={ARKESEL_API_KEY:'private-api-key',ARKESEL_SENDER_ID:'VoteCast',SUPABASE_SEND_SMS_HOOK_SECRET:secret,SUPABASE_SECRET_KEY:'sb_secret_private',NEXT_PUBLIC_SUPABASE_URL:'https://test.supabase.co'};
const body=JSON.stringify({user:{phone:'+233245259221'},sms:{otp:'123456'}});
const date=new Date(),id='test-request';
function request(){return new Request('https://test/api/auth/send-sms',{method:'POST',headers:{'content-type':'application/json','webhook-id':id,'webhook-timestamp':String(Math.floor(date.getTime()/1000)),'webhook-signature':new Webhook(secret).sign(id,date,body)},body});}
const logs=[],originalInfo=console.info,originalError=console.error;
console.info=(...args)=>logs.push(args);console.error=(...args)=>logs.push(args);
async function run({provider=()=>Response.json({status:'success'}),receiptError=false,claim='claimed'}={}){
 const tasks=[],calls=[];
 const response=await handleArkeselSmsHook(request(),{env,schedule:task=>tasks.push(task),fetch:async(url,options)=>{
  calls.push(url);
  if(url.endsWith('/claim_sms_delivery'))return Response.json(claim);
  if(url.endsWith('/finish_sms_delivery')){if(receiptError)return Response.json({code:'42501',message:body},{status:403});return Response.json(null);}
  return provider(options);
 }});
 return {response,tasks,calls};
}
try{
 let result=await run({receiptError:true});assert.equal(result.response.status,200);assert.equal(result.response.headers.get('content-type'),'application/json');assert.deepEqual(await result.response.json(),{});assert.equal(result.calls.length,2,'Receipt must not delay hook response');await result.tasks[0]();assert.ok(logs.some(([,entry])=>entry.stage==='receipt_write_failed'&&entry.errorCode==='42501'&&entry.httpStatus===403&&entry.accepted));
 for(const response of [()=>Response.json([]),()=>new Response(null,{status:200})]){result=await run({provider:response});assert.equal(result.response.status,200);await result.tasks[0]();}
 result=await run({provider:async options=>{await new Promise(resolve=>setTimeout(resolve,2200));if(options.signal.aborted)throw options.signal.reason;return Response.json({status:'success'});}});assert.equal(result.response.status,200,'A provider response after two seconds must still succeed within the hook budget');await result.tasks[0]();
 result=await run({provider:()=>Response.json({error:'private-api-key'},{status:401})});assert.equal(result.response.status,502);await result.tasks[0]();assert.ok(logs.some(([,entry])=>entry.stage==='provider_http_error'&&entry.httpStatus===401));
 result=await run({provider:()=>Response.json({status:'error'})});assert.equal(result.response.status,502);await result.tasks[0]();
 result=await run({provider:()=>{throw new DOMException('private-api-key 123456 +233245259221','TimeoutError')}});assert.equal(result.response.status,502);assert.equal(result.calls.filter(url=>url.includes('arkesel')).length,1);await result.tasks[0]();assert.ok(logs.some(([,entry])=>entry.stage==='provider_request_failed'&&entry.errorName==='TimeoutError'&&entry.deliveryUncertain));
 result=await run({claim:'sent'});assert.equal(result.response.status,200);assert.equal(result.calls.length,1);assert.equal(result.tasks.length,0);
 result=await run({claim:'pending'});assert.equal(result.response.status,503);assert.equal(result.calls.length,1);
 result=await run({claim:'rate_limited'});assert.equal(result.response.status,429);assert.equal(result.calls.length,1);
 const output=JSON.stringify(logs);for(const sensitive of ['123456','245259221','private-api-key','sb_secret_private',secret])assert.equal(output.includes(sensitive),false);
}finally{console.info=originalInfo;console.error=originalError;}
console.log('PASS: SMS acceptance, background receipt failure, empty/array responses, explicit rejection, timeout without resend, duplicate guards, stage diagnostics and private-data exclusion.');
