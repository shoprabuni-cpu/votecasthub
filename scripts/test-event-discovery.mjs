import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import ts from 'typescript';
import { JSDOM } from 'jsdom';

const require=createRequire(import.meta.url);
const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost'});
globalThis.window=dom.window;globalThis.document=dom.window.document;
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const React=require('react');const {act}=React;const {createRoot}=require('react-dom/client');
const cache=new Map();
const mocks={
 'next/link':{__esModule:true,default:({children,...props})=>React.createElement('a',props,children)},
 'next/image':{__esModule:true,default:props=>{const attributes={...props};delete attributes.fill;delete attributes.unoptimized;return React.createElement('img',attributes);}},
 '@/components/ui/app-modal':{AppModal:()=>null},
 'next/cache':{revalidatePath:()=>{}},
 'next/navigation':{useRouter:()=>({refresh:()=>{}})},
};
function load(file){
 file=path.resolve(file);
 if(cache.has(file))return cache.get(file).exports;
 const compiled={exports:{}};cache.set(file,compiled);
 const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
 const localRequire=name=>{
  if(mocks[name])return mocks[name];
  if(name.startsWith('@/')||name.startsWith('.')){
   const base=name.startsWith('@/')?path.resolve('src',name.slice(2)):path.resolve(path.dirname(file),name);
   const target=['.ts','.tsx','.js'].map(ext=>base+ext).find(candidate=>fs.existsSync(candidate));
   return load(target??base);
  }
  return require(name);
 };
 new Function('require','module','exports',code)(localRequire,compiled,compiled.exports);
 return compiled.exports;
}
const root=createRoot(document.getElementById('root'));
const wait=async()=>act(async()=>{await new Promise(resolve=>setTimeout(resolve,320));});
const now=Date.now();
const event=(id,name)=>({id,name,slug:id,description:null,organization_name:'Organizer',unit_price_minor:0,voting_mode:'free',status:'published',starts_at:new Date(now-1000).toISOString(),ends_at:new Date(now+86400000).toISOString()});
const calls=[];
let fail=false;
globalThis.fetch=async(url,options)=>{
 calls.push({url,options});
 return fail?{ok:false,json:async()=>({error:'Import an approved voter list before publishing this event'})}:{ok:true,json:async()=>url.startsWith('/api/events')?{events:[event('second','Second event')],total:2,now}:{ok:true}};
};
try{
 const {EventBrowser}=load('src/components/events/event-browser.tsx');
 await act(async()=>root.render(React.createElement(EventBrowser,{initialPage:{events:[event('first','First event')],total:2,now}})));
 assert.equal(calls.length,0);
 assert.equal(document.querySelectorAll('article').length,1);
 const grid=document.querySelector('[aria-busy]');
 for(const utility of ['grid-cols-2','lg:grid-cols-4','xl:grid-cols-5','2xl:grid-cols-6'])assert.ok(grid.classList.contains(utility));
 const more=[...document.querySelectorAll('button')].find(button=>button.textContent==='Load more events');
 await act(async()=>more.click());
 assert.equal(document.querySelectorAll('article').length,2);
 assert.equal(new URL(calls.at(-1).url,'http://localhost').searchParams.get('offset'),'1');
 const status=document.querySelectorAll('select')[0];
 await act(async()=>{status.value='upcoming';status.dispatchEvent(new dom.window.Event('change',{bubbles:true}));});await wait();
 assert.equal(new URL(calls.at(-1).url,'http://localhost').searchParams.get('status'),'upcoming');
 assert.equal(document.querySelectorAll('article').length,1);
 await act(async()=>{status.value='active';status.dispatchEvent(new dom.window.Event('change',{bubbles:true}));});await wait();
 assert.equal(new URL(calls.at(-1).url,'http://localhost').searchParams.get('status'),'active');
 assert.equal(document.querySelector('[aria-busy]').getAttribute('aria-busy'),'false');
 fail=true;
 const mode=document.querySelectorAll('select')[1];
 await act(async()=>{mode.value='paid';mode.dispatchEvent(new dom.window.Event('change',{bubbles:true}));});await wait();
 assert.match(document.querySelector('[role=alert]').textContent,/approved voter list/);

 const {AdminEvents}=load('src/components/admin/admin-events.tsx');
 await act(async()=>root.render(React.createElement(AdminEvents,{events:[{...event('pending','Pending event'),status:'pending_review'}]})));
 let approve=[...document.querySelectorAll('button')].find(button=>button.textContent==='Approve');
 await act(async()=>approve.click());
 assert.match(document.querySelector('[role=alert]').textContent,/approved voter list/);
 approve=[...document.querySelectorAll('button')].find(button=>button.textContent==='Approve');assert.equal(approve.disabled,false);
 fail=false;await act(async()=>approve.click());assert.equal(document.querySelector('[role=alert]'),null);
 assert.ok([...document.querySelectorAll('button')].some(button=>button.textContent.trim()==='Pause'));

 const {OrganizationEventsList}=load('src/components/organizations/organization-events-list.tsx');
 const expired={...event('expired','Expired review'),status:'draft',ends_at:new Date(now-1000).toISOString(),last_review_kind:'returned',review_feedback:'Please correct the voting dates.'};
 await act(async()=>root.render(React.createElement(OrganizationEventsList,{events:[expired],organizationId:'organization',now})));
 assert.match(document.body.textContent,/Changes requested/);assert.match(document.body.textContent,/Voting dates expired/);assert.match(document.body.textContent,/Please correct the voting dates/);assert.match(document.body.textContent,/View feedback & edit/);
 await act(async()=>root.render(React.createElement(OrganizationEventsList,{events:[{...expired,status:'pending_review'}],organizationId:'organization',now})));
 assert.match(document.body.textContent,/Awaiting approval/);
 mocks['@/lib/auth/actions']={setEventStatusAction:async()=>({success:true,message:'Submitted'})};
 const {EventStatusForm}=load('src/components/events/event-status-form.tsx');
 await act(async()=>root.render(React.createElement(EventStatusForm,{eventId:'test-event',action:'publish',backTo:'/organizer',label:'Submit for review'})));
 assert.equal(document.querySelector('button').textContent,'Submit for review');
 assert.doesNotMatch(document.body.textContent,/Publish Event Now/);
 mocks['@/lib/events/actions']={updatePublicEventAction:async()=>null,sendEventReviewMessageAction:async()=>({success:true,message:'Message sent.'})};
 const {PublicEventEditor}=load('src/components/events/public-event-editor.tsx');
 await act(async()=>root.render(React.createElement(PublicEventEditor,{event:{...event('live','Live event'),results_visibility:'live',voting_rules:'Existing rules'},startLocked:true,expired:false})));
 await act(async()=>document.querySelector('button').click());
 assert.equal(document.querySelector('textarea[name=description]').readOnly,false);
 assert.equal(document.querySelector('textarea[name=votingRules]').readOnly,true);
 assert.equal(document.querySelector('input[type=datetime-local]').disabled,true);
 const {ReviewMessageForm}=load('src/components/events/review-message-form.tsx');
 await act(async()=>root.render(React.createElement(ReviewMessageForm,{eventId:'event'})));
 assert.equal(document.querySelector('textarea').maxLength,2000);
 assert.equal(document.querySelector('textarea').minLength,5);
 assert.match(document.querySelector('button').textContent,/Send private message/);
 const {AdminReviewQueue}=load('src/components/admin/review-queue.tsx');
 await act(async()=>root.render(React.createElement(AdminReviewQueue,{requests:[{id:'correction',event_name:'Live event',kind:'name',proposed_value:'Corrected name',original_value:'Name',reason:'Spelling correction',created_at:new Date(now).toISOString()}],previewUrls:{}})));
 assert.equal(document.querySelector('textarea').minLength,20);
 assert.ok([...document.querySelectorAll('button')].every(button=>button.disabled));
 await act(async()=>{
   const input=document.querySelector('textarea');
   Object.getOwnPropertyDescriptor(dom.window.HTMLTextAreaElement.prototype,'value').set.call(input,'Confirmed the same competition identity and unchanged voting rules.');
   input.dispatchEvent(new dom.window.Event('input',{bubbles:true}));
 });
 assert.equal(document.querySelector('button').disabled,false);
 await act(async()=>document.querySelector('button').click());
 assert.match(JSON.parse(calls.at(-1).options.body).note,/same competition/);

 let rpcError=null,authenticated=true,admin=true,deliveryScheduled=0;
 mocks['@/lib/notifications/delivery']={scheduleNotificationDelivery:()=>{deliveryScheduled++;}};
 mocks['@/lib/supabase/server']={createClient:async()=>({
  auth:{getClaims:async()=>({data:authenticated?{claims:{sub:'10000000-0000-4000-8000-000000000001'}}:null,error:null})},
  from:()=>({select:()=>({eq:()=>({eq:()=>({maybeSingle:async()=>({data:admin?{role:'admin'}:null,error:null})})})})}),
  rpc:async()=>({error:rpcError}),
 })};
 const {POST}=load('src/app/api/admin/events/approve/route.ts');
 const post=(id='30000000-0000-4000-8000-000000000001')=>POST(new Request('http://localhost/api/admin/events/approve',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id})}));
 assert.equal((await post('invalid')).status,400);
 authenticated=false;assert.equal((await post()).status,401);authenticated=true;
 admin=false;assert.equal((await post()).status,403);admin=true;
 rpcError={code:'22023',message:'Import an approved voter list before submitting or publishing this event'};
 let response=await post();assert.equal(response.status,409);assert.match((await response.json()).error,/approved voter list/);
 rpcError={code:'P0002',message:'Event not found'};assert.equal((await post()).status,404);
 assert.equal(deliveryScheduled,0);
 rpcError=null;assert.equal((await post()).status,200);assert.equal(deliveryScheduled,1);
 const {POST:returnEvent}=load('src/app/api/admin/events/reject/route.ts');
 const reject=reason=>returnEvent(new Request('http://localhost/api/admin/events/reject',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id:'30000000-0000-4000-8000-000000000001',reason})}));
 assert.equal((await reject('x')).status,400);assert.equal((await reject('Update the expired dates before resubmitting.')).status,200);
 const {POST:reviewCorrection}=load('src/app/api/admin/corrections/review/route.ts');
 const correctionRequest=note=>reviewCorrection(new Request('http://localhost/api/admin/corrections/review',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id:'40000000-0000-4000-8000-000000000001',approve:true,note})}));
 assert.equal((await correctionRequest(undefined)).status,400);
 assert.equal((await correctionRequest('Confirmed identity and unchanged competition rules.')).status,200);
 authenticated=false;assert.equal((await reject('Update the expired dates before resubmitting.')).status,401);
 let copied='';
 Object.defineProperty(globalThis.navigator,'clipboard',{configurable:true,value:{writeText:async value=>{copied=value;}}});
 const {EventPromotionTools}=load('src/components/sharing/event-promotion-tools.tsx');
 await act(async()=>root.render(React.createElement(EventPromotionTools,{name:'Awards </a><script>alert(1)</script>',url:'https://www.votecasthub.com/events/awards'})));
 await act(async()=>[...document.querySelectorAll('button')].find(button=>button.textContent==='Copy website link HTML').click());
 assert.match(copied,/&lt;script&gt;/);assert.ok(!copied.includes('<script>'));
 await act(async()=>[...document.querySelectorAll('button')].find(button=>button.textContent==='Copy event link').click());
 assert.equal(copied,'https://www.votecasthub.com/events/awards');
 assert.match(document.querySelector('[role=status]').textContent,/Event link copied/);
 console.log('PASS: React discovery/review screens, approval responses, background dispatch hooks and promotion copy tools with escaped website HTML. DOM tests do not verify rendered browser layout.');
}finally{await act(async()=>root.unmount());dom.window.close();}
