import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import ts from 'typescript';
import { JSDOM, VirtualConsole } from 'jsdom';
const require=createRequire(import.meta.url);
let chromium;
if(process.argv.includes('--browser'))try { ({chromium}=require('playwright')); } catch {
 const bundled=process.env.CODEX_RUNTIME_NODE_MODULES || path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules');
 ({chromium}=createRequire(path.join(bundled,'package.json'))('playwright'));
}
const baseline=process.argv.includes('--baseline');
const modules=new Map();
const forms={signIn:'sign-in-form',signUp:'sign-up-form',forgot:'forgot-password-form',confirmation:'resend-confirmation-form',email:'email-otp-form',phone:'phone-sign-in-form'};
const mocks={
 'next/script':`const React=require('react');exports.__esModule=true;exports.default=function Script({onReady}){React.useEffect(()=>{onReady()},[]);return null;}`,
 'next/link':`const React=require('react');exports.__esModule=true;exports.default=function Link(props){return React.createElement('a',props,props.children);}`,
 '@/lib/auth/actions':`const names=['signInAction','signUpAction','requestPasswordResetAction','resendConfirmationAction','requestVoterEmailCodeAction','verifyVoterEmailCodeAction','requestVoterPhoneCodeAction','verifyVoterPhoneCodeAction'];for(const name of names)exports[name]=async(_,data)=>{window.actionCalls.push({name,token:data.get('cf-turnstile-response'),fields:Object.fromEntries(data)});if(name==='requestVoterPhoneCodeAction')return {message:'Code requested',codeSent:true,phone:'+233241234567',resendAt:Date.now()-1000};if(name==='requestVoterEmailCodeAction')return {message:'Code requested',codeSent:true,email:'test@example.test'};return {message:'Test response: request completed'};};`,
};
const resolve=(name,parent)=>mocks[name]?name:name.startsWith('@/')?path.resolve('src',name.slice(2))+'.tsx':require.resolve(name,{paths:[path.dirname(parent)]});
async function add(id,sitekey){
 if(modules.has(id))return;
 modules.set(id,'');
 let code=mocks[id] || await fs.readFile(id,'utf8');
 if(baseline&&id.endsWith('auth-captcha.tsx'))code=execFileSync('git',['show','HEAD:src/components/auth/auth-captcha.tsx'],{encoding:'utf8'});
 if(id.endsWith('.tsx'))code=ts.transpileModule(code,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
 code=code.replaceAll('process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY',JSON.stringify(sitekey));
 const deps=[...code.matchAll(/require\(["']([^"']+)["']\)/g)].map(m=>m[1]);
 for(const name of new Set(deps)){
  const target=resolve(name,id);
  await add(target,sitekey);
  code=code.replaceAll(`require("${name}")`,`require(${JSON.stringify(target)})`).replaceAll(`require('${name}')`,`require(${JSON.stringify(target)})`);
 }
 modules.set(id,code);
}
async function bundle(sitekey){
 modules.clear();
 const entry=path.resolve('src/components/auth/auth-captcha.tsx');
 await add(require.resolve('react-dom/client'),sitekey);
 await add(require.resolve('react'),sitekey);
 for(const file of Object.values(forms))await add(path.resolve(`src/components/auth/${file}.tsx`),sitekey);
 const sources=[...modules].map(([id,code])=>`${JSON.stringify(id)}:function(require,module,exports){\n${code}\n}`).join(',\n');
 const exports={signIn:'SignInForm',signUp:'SignUpForm',forgot:'ForgotPasswordForm',confirmation:'ResendConfirmationForm',email:'EmailOtpForm',phone:'PhoneSignInForm'};
 return `const process={env:{NODE_ENV:'development'}};const modules={${sources}};const cache={};function require(id){if(cache[id])return cache[id].exports;const module=cache[id]={exports:{}};modules[id](require,module,module.exports);return module.exports;}
 window.actionCalls=[];window.widgets=new Map();window.resetCount=0;window.turnstile={render(el,options){const id='widget-'+Math.random();window.widgets.set(id,options);return id;},remove(id){window.widgets.delete(id)},reset(id){window.resetCount++}};
 window.solve=(token)=>{for(const options of window.widgets.values())options.callback(token)};
 window.expire=()=>{for(const options of window.widgets.values())options['expired-callback']()};
 window.fail=()=>{for(const options of window.widgets.values())options['error-callback']()};
 window.timeout=()=>{for(const options of window.widgets.values())options['timeout-callback']()};
 const React=require(${JSON.stringify(require.resolve('react'))});const ReactDOM=require(${JSON.stringify(require.resolve('react-dom/client'))});
 const key=new URL(location.href).searchParams.get('form')||'signIn';const files=${JSON.stringify(forms)},exportsMap=${JSON.stringify(exports)};
 const components=${JSON.stringify(Object.fromEntries(Object.entries(forms).map(([key,file])=>[key,path.resolve('src/components/auth/'+file+'.tsx')])))};
 const Form=require(components[key])[exportsMap[key]];ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(Form,{nextPath:'/events/test-event'}));`;
}
const bundles={enabled:await bundle('test-site-key'),disabled:await bundle(undefined)}; console.log('React fixtures compiled.');
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost');
 if(url.pathname==='/app.js'){res.setHeader('Content-Type','application/javascript');res.end(bundles[url.searchParams.get('mode')||'enabled']);}
 else {res.setHeader('Content-Type','text/html');res.end(`<html><body><div id="root"></div><script src="/app.js?mode=${url.searchParams.get('mode')||'enabled'}"></script></body></html>`);}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
async function runDomTests(){
 const errors=[];
 const origin=`http://127.0.0.1:${server.address().port}`;
 let dom;
 async function wait(check){
  const end=Date.now()+5000;
  while(!check()){if(Date.now()>end)throw new Error('DOM condition timed out');await new Promise(resolve=>setTimeout(resolve,10));}
 }
 async function open(form,mode='enabled'){
  dom?.window.close();
  const console=new VirtualConsole();console.on('jsdomError',error=>errors.push(error.message));console.on('error',message=>errors.push(String(message)));
  dom=new JSDOM('<html><body><div id="root"></div></body></html>',{url:`${origin}/?form=${form}&mode=${mode}`,runScripts:'outside-only',virtualConsole:console});
  dom.window.eval(bundles[mode]);
  await wait(()=>dom.window.document.querySelector('button.auth-submit')&&(mode==='disabled'||dom.window.widgets.size===1));
 }
 const button=()=>dom.window.document.querySelector('button.auth-submit');
 const response=()=>dom.window.document.querySelector('input[name="cf-turnstile-response"]');
 const fill=(form)=>{
  const doc=dom.window.document;
  if(form==='phone'){doc.querySelector('input[name=phone]').value='0241234567';return;}
  doc.querySelector('input[name=email]').value='test@example.test';
  if(form==='signIn'||form==='signUp')doc.querySelector('input[name=password]').value='Strong-test-password-123';
  if(form==='signUp'){doc.querySelector('input[name=displayName]').value='Test Organizer';doc.querySelector('input[name=acceptTerms]').checked=true;}
 };
 const namedButton=text=>[...dom.window.document.querySelectorAll('button')].find(button=>button.textContent===text);
 try{
  if(baseline){
   await open('signIn');dom.window.solve('baseline-token');await wait(()=>!button().disabled);
   assert.equal(response().value,'');
   console.log('REPRODUCED: completing Turnstile enables Sign in but React rerender erases the hidden token.');
   return;
  }
  for(const form of Object.keys(forms)){
   await open(form);fill(form);assert.equal(button().disabled,true);
   dom.window.solve(`${form}-token`);await wait(()=>!button().disabled);
   assert.equal(response().value,`${form}-token`);
   button().click();await wait(()=>dom.window.actionCalls.length===1);
   assert.equal(dom.window.actionCalls[0].token,`${form}-token`);
   if(form!=='phone'&&form!=='email'){
    await wait(()=>response().value===''&&button().disabled);
    fill(form);dom.window.solve('retry-token');await wait(()=>!button().disabled);
    button().click();await wait(()=>dom.window.actionCalls.length===2);
    assert.equal(dom.window.actionCalls[1].token,'retry-token');
   }
   if(form==='phone'){
    await wait(()=>namedButton('Request a new code'));namedButton('Request a new code').click();await wait(()=>dom.window.widgets.size===1);
    dom.window.solve('resend-token');await wait(()=>!namedButton('Send new code').disabled);
    namedButton('Send new code').click();await wait(()=>dom.window.actionCalls.length===2);assert.equal(dom.window.actionCalls[1].token,'resend-token');
    await wait(()=>response().value==='');
    dom.window.document.querySelector('input[name=token]').value='123456';
    await wait(()=>!namedButton('Verify and continue').disabled);namedButton('Verify and continue').click();await wait(()=>dom.window.actionCalls.length===3);
    assert.equal(dom.window.actionCalls[2].name,'verifyVoterPhoneCodeAction');
   }
   if(form==='email'){
    await wait(()=>dom.window.document.querySelector('input[name=token]'));
    dom.window.document.querySelector('input[name=token]').value='123456';namedButton('Verify and continue').click();await wait(()=>dom.window.actionCalls.length===2);
    assert.equal(dom.window.actionCalls[1].name,'verifyVoterEmailCodeAction');
   }
  }
  await open('signIn');fill('signIn');
  dom.window.document.querySelector('form').requestSubmit();await wait(()=>dom.window.document.querySelector('[role=alert]'));
  assert.equal(dom.window.actionCalls.length,0);
  for(const callback of ['expire','fail','timeout']){
   dom.window.solve('fresh-token');await wait(()=>!button().disabled);dom.window[callback]();await wait(()=>button().disabled);assert.equal(response().value,'');
  }
  for(const form of Object.keys(forms)){await open(form,'disabled');assert.equal(button().disabled,false);}
  assert.deepEqual(errors,[]);
  console.log('PASS: real React DOM tests for all six auth forms, tokens surviving rerenders, submissions, failed-action retries, phone resend, OTP confirmation, expiry/error/timeout clearing, unverified submission guard and no-site-key readiness.');
 }finally{dom?.window.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
}
if(!process.argv.includes('--browser')){
 await runDomTests();
}else{
let browser;
try {
 browser=await chromium.launch({headless:true,timeout:15000,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE}:{})});
 console.log('Chromium launched.'); const page=await browser.newPage(); console.log('Browser page ready.');
 page.setDefaultTimeout(10000); const errors=[];page.on('pageerror',error=>{errors.push(error.message);console.error(error.message);});
 const origin=`http://127.0.0.1:${server.address().port}`;
 async function open(form,mode='enabled'){
  await page.goto(`${origin}/?form=${form}&mode=${mode}`);
  if(mode==='enabled')await page.waitForFunction(()=>window.widgets.size===1);
  else await page.locator('button[type=submit],button.auth-submit').first().waitFor();
 }
 async function fill(form){
  if(form==='phone'){await page.locator('input[name=phone]').fill('0241234567');return;}
  await page.locator('input[name=email]').fill('test@example.test');
  if(form==='signIn'||form==='signUp')await page.locator('input[name=password]').fill('Strong-test-password-123');
  if(form==='signUp'){await page.locator('input[name=displayName]').fill('Test Organizer');await page.locator('input[name=acceptTerms]').check();}
 }
 if(baseline){
  await open('signIn');await page.evaluate(()=>window.solve('baseline-token'));
  await page.waitForFunction(()=>!document.querySelector('button[type=submit]').disabled);
  assert.equal(await page.locator('input[name="cf-turnstile-response"]').inputValue(),'');
  console.log('REPRODUCED: completing Turnstile enables Sign in but React rerender erases the hidden token.');
 }else{
  for(const form of Object.keys(forms)){
   await open(form);await fill(form);
   assert.equal(await page.locator('button.auth-submit').first().isDisabled(),true);
   await page.evaluate(token=>window.solve(token),`${form}-token`);
   await page.waitForFunction(()=>!document.querySelector('button.auth-submit').disabled);
   assert.equal(await page.locator('input[name="cf-turnstile-response"]').inputValue(),`${form}-token`);
   await page.locator('button.auth-submit').first().click();
   await page.waitForFunction(()=>window.actionCalls.length===1);
   assert.equal(await page.evaluate(()=>window.actionCalls[0].token),`${form}-token`);
   if(form!=='phone'&&form!=='email'){
    await page.waitForFunction(()=>document.querySelector('input[name="cf-turnstile-response"]').value==='');
    assert.equal(await page.locator('button.auth-submit').isDisabled(),true);
    await fill(form);await page.evaluate(()=>window.solve('retry-token'));
    await page.locator('button.auth-submit').click();await page.waitForFunction(()=>window.actionCalls.length===2);
    assert.equal(await page.evaluate(()=>window.actionCalls[1].token),'retry-token');
   }
   if(form==='phone'){
    await page.getByRole('button',{name:'Request a new code',exact:true}).click();
    await page.waitForFunction(()=>window.widgets.size===1);
    await page.evaluate(()=>window.solve('resend-token'));
    await page.getByRole('button',{name:'Send new code',exact:true}).click();
    await page.waitForFunction(()=>window.actionCalls.length===2);
    assert.equal(await page.evaluate(()=>window.actionCalls[1].token),'resend-token');
    await page.waitForFunction(()=>document.querySelector('input[name="cf-turnstile-response"]').value==='');
    await page.locator('input[name=token]').fill('123456');
    await page.getByRole('button',{name:'Verify and continue',exact:true}).click();
    await page.waitForFunction(()=>window.actionCalls.length===3);
    assert.equal(await page.evaluate(()=>window.actionCalls[2].name),'verifyVoterPhoneCodeAction');
   }
   if(form==='email'){
    await page.locator('input[name=token]').fill('123456');await page.getByRole('button',{name:'Verify and continue',exact:true}).click();
    await page.waitForFunction(()=>window.actionCalls.length===2);
    assert.equal(await page.evaluate(()=>window.actionCalls[1].name),'verifyVoterEmailCodeAction');
   }
  }
  await open('signIn');await fill('signIn');
  // An Enter/requestSubmit attempt without verification must never dispatch the action.
  await page.evaluate(()=>document.querySelector('form').requestSubmit());
  await page.getByRole('alert').waitFor();assert.equal(await page.evaluate(()=>window.actionCalls.length),0);
  for(const callback of ['expire','fail','timeout']){
   await page.evaluate(()=>window.solve('fresh-token'));
   await page.waitForFunction(()=>!document.querySelector('button.auth-submit').disabled);
   await page.evaluate(callback=>window[callback](),callback);
   await page.waitForFunction(()=>document.querySelector('button.auth-submit').disabled);
   assert.equal(await page.locator('input[name="cf-turnstile-response"]').inputValue(),'');
  }
  for(const form of Object.keys(forms)){
   await open(form,'disabled');assert.equal(await page.locator('button.auth-submit').first().isDisabled(),false);
  }
  assert.deepEqual(errors,[]);
  console.log('PASS: real React browser tests for all six auth forms, controlled token submission, failed-action retries, phone resend, OTP confirmation, expiry/error/timeout clearing, unverified submission guard and no-site-key readiness.');
 }
}finally{if(browser)await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
}




