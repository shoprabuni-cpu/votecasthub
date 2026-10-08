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

 let rpcError=null,authenticated=true,admin=true;
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
 rpcError=null;assert.equal((await post()).status,200);
 console.log('PASS: Actual React directory filters/pagination/retry state, responsive utility classes, visible admin approval failure/retry, and approval HTTP statuses. DOM tests do not verify rendered browser layout.');
}finally{await act(async()=>root.unmount());dom.window.close();}
