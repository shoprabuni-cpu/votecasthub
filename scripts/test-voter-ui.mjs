import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import ts from 'typescript';
import { JSDOM } from 'jsdom';
const require=createRequire(import.meta.url);
const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost'});
globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.FormData=dom.window.FormData;globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const React=require('react');const {act}=React;const {createRoot}=require('react-dom/client');
const cache=new Map(),calls=[];
let failOtp=false;
const mocks={
 '@/components/auth/auth-captcha':{AuthCaptcha:()=>null},
 '@/lib/auth/voter-verification':{verifyEventVoterAction:async(_,data)=>{calls.push(Object.fromEntries(data));return data.get('otp')?failOtp?{message:'Invalid code'}:{message:'Verified',success:true}:{message:'Code sent',success:true,codeSent:true,email:'voter@example.test',resendAt:Date.now()-1000};}},
};
function load(file){file=path.resolve(file);if(cache.has(file))return cache.get(file).exports;const compiled={exports:{}};cache.set(file,compiled);const source=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;new Function('require','module','exports',source)(name=>mocks[name]??require(name),compiled,compiled.exports);return compiled.exports;}
const {EventVoterVerification}=load('src/components/voting/event-voter-verification.tsx');const root=createRoot(document.getElementById('root'));
const base={eventId:'10000000-0000-4000-8000-000000000001',isVerified:false,available:true};
const render=async(props)=>act(async()=>root.render(React.createElement(EventVoterVerification,{...base,key:JSON.stringify(props),...props})));
try{
 for(const method of ['phone','email','invite_code']){await render({method});assert.equal(document.querySelectorAll('form').length,1);assert.equal(document.querySelectorAll('a[href*="sign-in"]').length,0);assert.equal(document.querySelector('[name=type]').value,method);assert.equal(document.querySelectorAll('select').length,0);}
 await render({method:'voter_list',inputTypes:['identifier']});assert.equal(document.querySelectorAll('select').length,0);assert.ok(document.querySelector('[name=claimCode]'));assert.equal(document.querySelector('[name=type]').value,'identifier');
 await render({method:'voter_list',inputTypes:['email']});assert.equal(document.querySelector('[name=identifier]').type,'email');assert.equal(document.querySelector('[name=claimCode]'),null);
 await render({method:'voter_list',inputTypes:['phone','email']});assert.equal(document.querySelector('select').options.length,2);
 await render({method:'voter_list',inputTypes:[]});assert.equal(document.querySelector('form'),null);assert.match(document.body.textContent,/temporarily unavailable/);
 await render({method:'phone',available:false});assert.equal(document.querySelector('form'),null);
 await render({method:'voter_list',hasRedeemed:true});assert.match(document.body.textContent,/No votes remain/);
 await render({method:'email',isVerified:true});assert.match(document.body.textContent,/verified/);assert.equal(document.querySelector('form'),null);
 await render({method:'email'});
 const input=document.querySelector('[name=identifier]');await act(async()=>{Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype,'value').set.call(input,'voter@example.test');input.dispatchEvent(new dom.window.Event('input',{bubbles:true}));});
 await act(async()=>document.querySelector('form').requestSubmit());
 assert.equal(calls.length,1);assert.ok(document.querySelector('[name=otp]'));assert.equal(document.querySelector('[name=identifier]').readOnly,true);
 document.querySelector('[name=otp]').value='123456';failOtp=true;await act(async()=>document.querySelector('form').requestSubmit());assert.match(document.querySelector('[role=status]').textContent,/Invalid code/);assert.ok(document.querySelector('[name=otp]'));
 failOtp=false;document.querySelector('[name=otp]').value='654321';await act(async()=>document.querySelector('form').requestSubmit());assert.match(document.querySelector('[role=status]').textContent,/Verified/);
 assert.equal(calls.at(-1).identifier,'voter@example.test');assert.equal(calls.at(-1).otp,'654321');
 console.log('PASS: Event-page React forms: each method, roster-specific inputs, no sign-in links, closed/exhausted states, inline OTP request/retry/success and retained contact.');
}finally{await act(async()=>root.unmount());dom.window.close();}
