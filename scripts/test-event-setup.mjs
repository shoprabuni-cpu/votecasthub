import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import ts from 'typescript';
import { JSDOM } from 'jsdom';
const require = createRequire(import.meta.url);
const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, FormData: dom.window.FormData, IS_REACT_ACT_ENVIRONMENT: true });
dom.window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
dom.window.HTMLDialogElement.prototype.close = function () { this.open = false; };
const React = require('react');
const { act } = React;
const { createRoot } = require('react-dom/client');
const cache = new Map();
const publicSaves = [], corrections = [], deletions = [];
const navigations = [];
let failSave = false;
const photoUploads=[];
const mocks = { '@/lib/supabase/client': { createClient: () => ({ storage: { from: () => ({ upload: async (path,file) => { photoUploads.push(file.name); return { error:null }; }, remove:async()=>({error:null}) }) } }) }, '@/lib/auth/actions': { addEventCategoryAction: async () => ({success:true,message:'Category added.',createdId:'new-category'}), updateNomineeImageAction: async () => ({success:true,message:'Saved'}), addCategoryNomineeAction: async () => ({success:true,message:'Nominee added.'}) }, '@/lib/events/actions': {
  deleteOrganizerEventAction: async (_, data) => { deletions.push(Object.fromEntries(data)); return null; },
  updatePublicEventAction: async (_, data) => { publicSaves.push(Object.fromEntries(data)); return failSave ? { message: 'Saving failed. Please try again.' } : { success: true, message: 'Saved' }; },
  requestEventCorrectionAction: async (_, data) => { corrections.push(Object.fromEntries(data)); return { success: true, message: 'Correction sent' }; },
}, 'next/link': { __esModule: true, default: ({ children, ...props }) => React.createElement('a', props, children) }, 'next/navigation': { useRouter: () => ({ push: href => navigations.push(href) }) } };
function load(file) {
  file = path.resolve(file);
  if (cache.has(file)) return cache.get(file).exports;
  const mod = { exports: {} }; cache.set(file, mod);
  const compiled = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  new Function('require', 'module', 'exports', compiled)(name => {
    if (mocks[name]) return mocks[name];
    if (name.startsWith('.') || name.startsWith('@/')) {
      const base = name.startsWith('@/') ? path.resolve('src', name.slice(2)) : path.resolve(path.dirname(file), name);
      return load(['.ts', '.tsx', '.js'].map(ext => base + ext).find(candidate => fs.existsSync(candidate)) ?? base);
    }
    return require(name);
  }, mod, mod.exports);
  return mod.exports;
}

const draftSaves = [], creations = [], submissions = [];
let draftFailure = false, savedSetupReady = true;
mocks['@/lib/auth/actions'].updateEventDraftAction = async (_,data) => { draftSaves.push(Object.fromEntries(data)); return draftFailure ? { message: 'Save failed. Please try again.' } : { success:true,message:'Saved',setupReady:savedSetupReady }; };
mocks['@/lib/auth/actions'].createEventAction = async (_,data) => { creations.push(Object.fromEntries(data)); return { success:true,message:'Created' }; };
mocks['@/lib/auth/actions'].setEventStatusAction = async (_,data) => { submissions.push(Object.fromEntries(data)); return { success:true,message:'Sent for approval' }; };
mocks['framer-motion'] = { motion: { div:({children,className})=>React.createElement('div',{className},children) }, AnimatePresence:({children})=>children };
dom.window.matchMedia=()=>({matches:true});
const {EventWorkspace}=load('src/components/events/event-workspace.tsx');
const {EventDetailsForm}=load('src/components/events/event-details-form.tsx');
const {NomineeForm}=load('src/components/events/nominee-form.tsx');
const {EventStatusForm}=load('src/components/events/event-status-form.tsx');
const root=createRoot(document.getElementById('root'));
const render=async(component,props)=>act(async()=>root.render(React.createElement(component,props)));
const button=text=>[...document.querySelectorAll('button')].find(node=>node.textContent.trim()===text);
const click=async node=>act(async()=>node.click());
const change=async(id,value)=>act(async()=>{
 const input=document.getElementById(id);Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype,'value').set.call(input,value);input.dispatchEvent(new dom.window.Event('input',{bubbles:true}));
});
const initial={name:'Campus Awards',description:'Campus leaders',price:0,startsAt:'2026-11-01T09:00:00Z',endsAt:'2026-11-14T23:59:00Z',resultsVisibility:'organizer_only',votingMode:'free',verificationMethod:'email',votingRule:'one_per_category',freeVoteLimit:1,votingRules:'Choose your leader'};
const props={canEdit:true,canManageVoting:true,viewLink:null,guided:{initialSection:'details',nomineesReady:true},
 details:React.createElement('p',null,'Cover image'),nominees:React.createElement(NomineeForm,{categoryId:'category',backTo:'/organizer'}),voting:React.createElement('p',null,'Selected access tools'),
 review:React.createElement(EventStatusForm,{eventId:'event',action:'publish',backTo:'/organizer',label:'Submit for approval',confirmMessage:'Submit your event for approval?'}),
 editor:React.createElement(EventDetailsForm,{organizationId:'org',eventId:'event',initial})};
try {
 await render(EventWorkspace,props);
 assert.equal(document.querySelector('[role=tablist]'),null,'Guided draft setup has one progress indicator, not nested tabs');
 assert.ok(document.getElementById('input-event-name'));assert.equal(document.getElementById('input-price-ghs'),null);
 await change('input-event-name','Updated Campus Awards');
 draftFailure=true;await click(button('Save & Continue'));
 assert.equal(document.querySelector('#workspace-details').hidden,false,'Failed save does not advance');
 assert.match(document.body.textContent,/Save failed/);
 draftFailure=false;await click(button('Save & Continue'));
 assert.equal(document.querySelector('#workspace-nominees').hidden,false,'Successful save advances to categories');
 assert.equal(draftSaves.at(-1).name,'Updated Campus Awards');
 assert.equal(draftSaves.at(-1).verificationMethod,'email');assert.equal(draftSaves.at(-1).votingRules,'Choose your leader','Full voting payload survives the details save');
 const nomineeName=document.querySelector('#workspace-nominees [name=name]');nomineeName.value='Akua';
 await act(async()=>nomineeName.dispatchEvent(new dom.window.Event('input',{bubbles:true})));
 await click(button('Continue'));
 assert.equal(document.querySelector('#workspace-nominees').hidden,false,'Incomplete nominee entry does not disappear');
 await click(button('Back'));assert.equal(document.getElementById('input-event-name').value,'Updated Campus Awards');
 await click(button('Save & Continue'));assert.equal(document.querySelector('#workspace-nominees [name=name]').value,'Akua','Back keeps unsaved nominee entries');
 await act(async()=>document.querySelector('#workspace-nominees form').requestSubmit());
 assert.equal(document.querySelector('#workspace-nominees').hidden,false,'Adding a nominee never advances the step');
 await click(button('Continue'));assert.equal(document.querySelector('#workspace-voting').hidden,false);
 assert.ok(document.getElementById('input-voting-rule'));assert.ok(document.querySelector('[name=resultsVisibility]'));
 await click(button('Save & Continue'));assert.equal(document.querySelector('#workspace-review').hidden,false);
 assert.equal(submissions.length,0,'Reaching review never publishes');
 await click(button('Submit for approval'));assert.equal(submissions.length,0,'Submission requires explicit confirmation');
 const confirm=[...document.querySelectorAll('dialog button')].find(node=>node.textContent.trim()==='Submit for approval');
 assert.ok(confirm);await click(confirm);assert.equal(submissions.length,1);assert.equal(submissions[0].action,'publish');
 await render(EventWorkspace,{...props,key:'no-nominees',guided:{initialSection:'nominees',nomineesReady:false}});
 await click(button('Continue'));assert.equal(document.querySelector('#workspace-nominees').hidden,false);assert.match(document.body.textContent,/active nominee in each category/);
 await render(EventWorkspace,{...props,key:'incomplete-access',guided:{initialSection:'voting',nomineesReady:true,votingReady:false}});
 await click(button('Save & Continue'));assert.equal(document.querySelector('#workspace-voting').hidden,false);assert.match(document.body.textContent,/required voter access or payment setup/);
 await render(EventWorkspace,{...props,key:'readiness-race',guided:{initialSection:'voting',nomineesReady:true,votingReady:true}});
 savedSetupReady=false;
 const rules=document.querySelector('textarea#input-voting-rules');
 if(rules) { await act(async()=>{Object.getOwnPropertyDescriptor(dom.window.HTMLTextAreaElement.prototype,'value').set.call(rules,'New rules');rules.dispatchEvent(new dom.window.Event('input',{bubbles:true}));}); }
 else {await act(async()=>{document.getElementById('input-verification-method').value='invite_code';document.getElementById('input-verification-method').dispatchEvent(new dom.window.Event('change',{bubbles:true}));});}
 await click(button('Save & Continue'));assert.equal(document.querySelector('#workspace-voting').hidden,false,'Authoritative saved readiness prevents premature advance despite stale page props');
 savedSetupReady=true;
 const animations=[];
 dom.window.matchMedia=()=>({matches:false});dom.window.requestAnimationFrame=callback=>setTimeout(callback,0);
 dom.window.HTMLElement.prototype.animate=function(frames){animations.push(frames);return {finished:Promise.resolve()};};
 dom.window.HTMLElement.prototype.getAnimations=()=>[];
 await render(EventWorkspace,{...props,key:'animated',guided:{initialSection:'nominees',nomineesReady:true,votingReady:true}});
 await click(button('Continue'));
 for(let attempt=0;attempt<20&&animations.length<2;attempt++)await act(async()=>{await new Promise(resolve=>setTimeout(resolve,25));});
 assert.equal(document.querySelector('#workspace-voting').hidden,false);assert.equal(animations.length,2);assert.match(animations[0][1].transform,/-36px/);
 await click(button('Back'));
 for(let attempt=0;attempt<20&&animations.length<4;attempt++)await act(async()=>{await new Promise(resolve=>setTimeout(resolve,25));});
 assert.match(animations[2][1].transform,/36px/);
 dom.window.matchMedia=()=>({matches:true});const animationCount=animations.length;
 await click(button('Continue'));assert.equal(animations.length,animationCount,'Reduced-motion preference skips the slide');
 await render(EventDetailsForm,{key:'new-event',organizationId:'org',creationFlow:true});
 await click(button('Save & Continue'));assert.equal(creations.length,0,'Missing required details never create an event');
 await change('input-event-name','New event');await change('input-starts-at','2026-11-01T09:00');await change('input-ends-at','2026-11-14T23:59');
 await click(button('Save & Continue'));assert.equal(creations.length,1);assert.equal(creations[0].setupFlow,'guided');assert.equal(creations[0].votingMode,'free');

 const actionExports={},rpcCalls=[];let readiness=true,rpcFailure=false,redirectPath;
 const sqlClient={rpc:async(name,args)=>{rpcCalls.push({name,args});if(name==='update_event_draft'&&rpcFailure)return {data:null,error:{code:'42501'}};return {data:name==='get_event_verification_readiness'?{ready:readiness}:name==='create_event'?'30000000-0000-4000-8000-000000000001':true,error:null};}};
 const actionCode=ts.transpileModule(fs.readFileSync('src/lib/auth/actions.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 new Function('require','exports',actionCode)(name=>{
  if(name==='node:crypto'||name==='zod')return require(name);
  if(name==='next/cache')return {revalidatePath:()=>{}};
  if(name==='next/navigation')return {redirect:path=>{redirectPath=path;throw new Error('Redirect requested');}};
  if(name==='@/lib/supabase/server')return {createClient:async()=>sqlClient};
  if(name==='@/lib/auth/form-state')return load('src/lib/auth/form-state.ts');
  return {};
 },actionExports);
 const payload=new FormData();
 for(const [key,value] of Object.entries({...creations[0],organizationId:'20000000-0000-4000-8000-000000000001',eventId:'30000000-0000-4000-8000-000000000001'}))payload.set(key,value);
 let result=await actionExports.updateEventDraftAction(null,payload);assert.equal(result.success,true);assert.equal(result.setupReady,true);
 assert.ok(rpcCalls.some(call=>call.name==='get_event_verification_readiness'));
 readiness=false;result=await actionExports.updateEventDraftAction(null,payload);assert.equal(result.success,true);assert.equal(result.setupReady,false,'Actual action returns fresh voter access readiness');
 rpcFailure=true;result=await actionExports.updateEventDraftAction(null,payload);assert.ok(!result.success);rpcFailure=false;
 await assert.rejects(()=>actionExports.createEventAction(null,payload),/Redirect requested/);
 assert.equal(redirectPath,'/organizer/20000000-0000-4000-8000-000000000001/events/30000000-0000-4000-8000-000000000001?step=nominees','Creating from the guided form opens categories directly');
 console.log('PASS: guided details/categories/voting/review flow, failed-save gating, complete payloads, preserved Back navigation, repeated nominees, readiness checks, explicit publish confirmation and first-step creation.');
} finally {await act(async()=>root.unmount());dom.window.close();}
