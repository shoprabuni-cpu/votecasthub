import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import ts from 'typescript';

const source=(await fs.readFile('src/lib/notifications/delivery.ts','utf8'))
 .replace('import "server-only";','')
 .replace('import { after } from "next/server";','const after = callback => globalThis.notificationTest.after(callback);')
 .replace('import { paymentAdmin } from "@/lib/payments/admin";','const paymentAdmin = () => globalThis.notificationTest.db;');
const code=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
const {processNotificationEmails}=await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
const savedEnv={...process.env}, originalFetch=globalThis.fetch, originalError=console.error;
const job={id:'job-1',lease_id:'lease-1',recipient:'admin@test.example',subject:'Review event',body:'Review this event',path:'/admin/events/event-1',attempts:1,payload:null,delivery_uncertain:false};
let updates=[],requests=[],claimCalls=0,fetchMode='success',saveStatusFails=false;
globalThis.notificationTest={after(){},db:{
 async rpc(){claimCalls++;return {data:[{...job}],error:null};},
 from(){let value,filters={};const builder={
  update(v){value=v;return this;},delete(){return this;},
  eq(k,v){filters[k]=v;return this;},in(){return this;},lt(){return this;},
  async select(){updates.push({value,filters});job.payload=value.payload;return {data:[{id:job.id}],error:null};},
  then(resolve){if(value)updates.push({value,filters});resolve({error:saveStatusFails && value?.status==='sent'?new Error('database unavailable'):null});},
 };return builder;},
}};
globalThis.fetch=async(url,options)=>{
 requests.push({url,options});
 if(fetchMode==='timeout')throw new Error('Request timed out');
 return Response.json(fetchMode==='success'?{id:'provider-1'}:{message:'Provider error'},{status:fetchMode==='rate-limit'?429:fetchMode==='invalid'?422:200});
};
console.error=()=>{};
try{
 delete process.env.RESEND_API_KEY;
 assert.equal((await processNotificationEmails()).configured,false);assert.equal(claimCalls,0);
 process.env.RESEND_API_KEY='test-key';process.env.RESEND_FROM_EMAIL='VotecastHub <info@votecasthub.com>';process.env.NEXT_PUBLIC_SITE_URL='https://votecasthub.com';
 assert.equal((await processNotificationEmails()).sent,1);
 assert.equal(updates.at(-1).value.provider_id,'provider-1');
 assert.equal(requests[0].options.headers['Idempotency-Key'],'notification/job-1');
 assert.match(JSON.parse(requests[0].options.body).text,/https:\/\/votecasthub.com\/admin\/events\/event-1/);
 const frozen=requests[0].options.body;
 process.env.RESEND_FROM_EMAIL='Different sender <info@votecasthub.com>';
 fetchMode='rate-limit';updates=[];
 assert.equal((await processNotificationEmails()).failed,1);
 assert.equal(requests.at(-1).options.body,frozen);
 assert.equal(updates.at(-1).value.status,'pending');assert.equal(updates.at(-1).value.delivery_uncertain,false);
 fetchMode='invalid';updates=[];await processNotificationEmails();assert.equal(updates.at(-1).value.status,'failed');
 fetchMode='timeout';updates=[];await processNotificationEmails();assert.equal(updates.at(-1).value.delivery_uncertain,true);
 fetchMode='success';saveStatusFails=true;updates=[];await processNotificationEmails();assert.equal(updates.at(-1).value.delivery_uncertain,true);
 assert.ok(updates.every(update=>update.filters.lease_id==='lease-1'));
 console.log('PASS: Missing config, Resend request, frozen payload/idempotency, rate-limit retry, permanent rejection, timeout and ambiguous persistence failure.');
}finally{
 globalThis.fetch=originalFetch;console.error=originalError;delete globalThis.notificationTest;
 for(const key of Object.keys(process.env))if(!(key in savedEnv))delete process.env[key];Object.assign(process.env,savedEnv);
}
