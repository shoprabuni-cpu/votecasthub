import "server-only";
import { createHmac } from "node:crypto";
import { z } from "zod";
import { paymentAdmin } from "@/lib/payments/admin";
import { allow } from "@/lib/payments/gateway";
import { authenticUssd, ussdConfiguration, ussdSimulatorMode, ussdSimulatorEventAllowed, ussdPaymentReady, adapterRequest } from "./provider";
import { startPaystackUssdCharge, continuePaystackUssdCharge, momoProvider } from "./paystack-charge";
import { menuSelection } from "./menu";
const input=z.object({sessionId:z.string().regex(/^[A-Za-z0-9_-]{1,128}$/),serviceCode:z.string(),phoneNumber:z.string().regex(/^\+?233\d{9}$/),text:z.string().max(1000).default(""),email:z.email().max(254).optional(),chargeInput:z.string().regex(/^\d{1,10}$/).optional()});
const output=(text:string,end=false,status=200)=>new Response((end?'END ':'CON ')+text,{status,headers:{'content-type':'text/plain; charset=utf-8','cache-control':'no-store'}});
export async function handleArkeselUssd(request:Request) {
 const config=ussdConfiguration();if(!config.success)return output('Service unavailable',true,503);
 const raw=await request.text();if(raw.length>4096)return output('Invalid request',true,413);
 if(!authenticUssd(request,raw,config.data.ARKESEL_USSD_SHARED_SECRET))return output('Unauthorized',true,401);
 const parsed=input.safeParse(Object.fromEntries(new URLSearchParams(raw)));if(!parsed.success)return output('Invalid request',true,400);
 const p=parsed.data;if(p.serviceCode!==config.data.ARKESEL_USSD_SERVICE_CODE)return output('Invalid service code',true,403);
 const phone=p.phoneNumber.replace(/^\+/,''),hash=createHmac('sha256',config.data.ARKESEL_USSD_SHARED_SECRET).update('ussd:'+phone).digest('hex');
 if(!await allow('ussd:'+hash,60,600))return output('Too many requests. Try later.',true,429);
 try {
  const db=paymentAdmin();
  const existing=await db.from('ussd_sessions').select('*').eq('session_id',p.sessionId).maybeSingle();if(existing.error)throw existing.error;let s=existing.data;
  if(!s){const created=await db.from('ussd_sessions').insert({session_id:p.sessionId,phone_hash:hash}).select('*').single();if(created.error){const retry=await db.from('ussd_sessions').select('*').eq('session_id',p.sessionId).single();if(retry.error)throw retry.error;s=retry.data;}else s=created.data;}
  if(s.phone_hash!==hash)return output('Session unavailable',true,403);
  if(Date.parse(s.expires_at)<=Date.now())return output('Session expired. Dial again.',true);
  if(s.final_response)return output(s.final_response,true);
  if(s.reference && s.charge_status && p.chargeInput && config.data.USSD_PAYMENT_PROVIDER==='paystack')return await continuePaystackUssdCharge(s,p.chargeInput);
  const tokens=p.text===''?[]:p.text.split('*');if(tokens.some(t=>!/^\d+$/.test(t)))return output('Use the numbered options. Dial again.',true);
  if(!tokens.length)return output('VotecastHub GH\n1. Vote\n2. Exit');
  if(tokens[0]==='2'||tokens.at(-1)==='0')return output('Thank you for using VotecastHub.',true);
  if(tokens[0]!=='1')return output('Invalid selection. Dial again.',true);
  if(tokens.length===1)return output('Enter your numeric event code:');
  const {data:r,error:re}=await db.from('event_ussd_requests').select('event_id,event_code,dial_code').eq('event_code',tokens[1]).maybeSingle();if(re)throw re;
  if(r && ussdSimulatorMode() && !ussdSimulatorEventAllowed(r.event_id))return output('Simulator test event not configured. Ask the admin to allowlist its event ID.',true);
  if(!r||r.dial_code!==p.serviceCode)return output('Event code unavailable.',true);
  const {data:active,error:ae}=await db.rpc('get_public_ussd',{p_event_id:r.event_id});if(ae)throw ae;if(!active?.length)return output('This event is not open on USSD.',true);
  const {data:e,error:ee}=await db.from('events').select('id,name,voting_mode,verification_method,unit_price_minor,free_vote_limit_per_phone').eq('id',r.event_id).single();if(ee)throw ee;
  if(e.voting_mode==='paid' && config.data.USSD_PAYMENT_PROVIDER==='paystack' && !momoProvider(s.native_network??''))return output('Your Mobile Money network is not supported. Please use the website.',true);
  if(e.voting_mode==='paid' && !ussdPaymentReady())return output('Paid phone voting is unavailable. Please use the website.',true);
  if(e.voting_mode==='free' && e.verification_method!=='phone')return output('Use the website for this event verification.',true);
  if(e.voting_mode==='paid'&&config.data.USSD_PAYMENT_PROVIDER==='paystack'&&!s.payment_email){
   const {data:knownEmail,error:lookup}=await db.rpc('find_ussd_receipt_email',{p_phone:phone});if(lookup)throw lookup;
   const email=p.email??knownEmail;
   if(!email){const {error:waiting}=await db.from('ussd_sessions').update({awaiting_email:true}).eq('session_id',p.sessionId);if(waiting)throw waiting;return output('Enter your email for the payment receipt.\n0. Exit');}
   const {error:saveEmail}=await db.from('ussd_sessions').update({payment_email:email,awaiting_email:false}).eq('session_id',p.sessionId);if(saveEmail)throw saveEmail;s.payment_email=email;
  }
  const {error:sessionEvent}=await db.from('ussd_sessions').update({event_id:e.id}).eq('session_id',p.sessionId);if(sessionEvent)throw sessionEvent;
  const {data:categories,error:ce}=await db.from('categories').select('id,name').eq('event_id',e.id).eq('is_active',true).order('display_order').order('id');if(ce)throw ce;if(!categories?.length)return output('No categories available.',true);
  const category=menuSelection(categories,tokens,2);if(category.error)return output('Invalid category. Dial again.',true);if(category.prompt)return output('Choose category:\n'+category.prompt);
  const {data:nominees,error:ne}=await db.from('nominees').select('id,name').eq('category_id',category.item!.id).eq('is_active',true).order('display_order').order('id');if(ne)throw ne;if(!nominees?.length)return output('No nominees available.',true);
  const nominee=menuSelection(nominees,tokens,category.cursor);if(nominee.error)return output('Invalid nominee. Dial again.',true);if(nominee.prompt)return output('Choose nominee:\n'+nominee.prompt);
  if(tokens.length===nominee.cursor)return output(e.voting_mode==='free'?'Enter votes (1-'+Math.min(100,e.free_vote_limit_per_phone??1)+'). Existing limits apply.':'Enter votes (1-10000). GH₵'+(e.unit_price_minor/100).toFixed(2)+' per vote.');
  const quantity=Number(tokens[nominee.cursor]),max=e.voting_mode==='free'?Math.min(100,e.free_vote_limit_per_phone??1):10000;
  if(!Number.isSafeInteger(quantity)||quantity<1||quantity>max)return output('Invalid quantity. Dial again.',true);
  const confirmCode=config.data.USSD_SESSION_PROTOCOL==='arkesel-json'?String(100000+createHmac('sha256',config.data.ARKESEL_USSD_SHARED_SECRET).update('confirm:'+s.vote_request).digest().readUInt32BE(0)%900000):'1';
  if(tokens.length===nominee.cursor+1)return output(nominee.item!.name.slice(0,30)+'\n'+quantity+' vote(s)'+(e.voting_mode==='paid'?' = GH₵'+(e.unit_price_minor*quantity/100).toFixed(2):' (free)')+'\n'+active[0].network_notice.slice(0,65)+(confirmCode==='1'?'\n1. Confirm\n2. Cancel':'\nEnter '+confirmCode+' to confirm\n0. Exit'));
  if(tokens.length!==nominee.cursor+2||tokens.at(-1)!==confirmCode)return config.data.USSD_SESSION_PROTOCOL==='arkesel-json'?output('Enter '+confirmCode+' to confirm.\n0. Exit',false,422):output('Vote cancelled.',true);
  if(e.voting_mode==='paid') {
   const {data:attempt,error:reserve}=await db.rpc(config.data.USSD_PAYMENT_PROVIDER==='paystack'?'reserve_paystack_ussd_payment':'reserve_ussd_payment',{p_session:p.sessionId,p_phone_hash:hash,p_event:e.id,p_category:category.item!.id,p_nominee:nominee.item!.id,p_quantity:quantity});if(reserve)throw reserve;
   if(config.data.USSD_PAYMENT_PROVIDER==='paystack') {
    try {return await startPaystackUssdCharge(p.sessionId,phone,s.native_network,s.payment_email,attempt);}catch{return output('Payment is being checked. Do not pay again. Contact support with event code '+r.event_code+'.',true);}
   }
   if(!s.reference) {
    try {const initiated=await adapterRequest('/payments',{reference:attempt.provider_reference,phoneNumber:phone,amount:Number(attempt.total_amount_minor),currency:'GHS'});if(initiated.reference!==attempt.provider_reference||initiated.accepted!==true)throw new Error('Payment not accepted');}catch{return output('Payment is being checked. Do not pay again. Contact support with event code '+r.event_code+'.',true);}
   }
   const message='Approve the Mobile Money prompt. Votes count only after confirmed payment.';
   await db.from('ussd_sessions').update({final_response:message}).eq('session_id',p.sessionId);return output(message,true);
  }
  const found=await db.rpc('find_ussd_voter',{p_phone:phone});if(found.error)throw found.error;let user=found.data;
  if(!user){const created=await db.auth.admin.createUser({phone,phone_confirm:true});if(created.error){const retry=await db.rpc('find_ussd_voter',{p_phone:phone});if(!retry.data)throw created.error;user=retry.data;}else user=created.data.user.id;}
  const {error:vote}=await db.rpc('cast_verified_ussd_vote',{p_user:user,p_event:e.id,p_category:category.item!.id,p_nominee:nominee.item!.id,p_quantity:quantity,p_request:s.vote_request});
  if(vote)return output(vote.message.includes('limit')?'You have reached your voting limit.':vote.message.includes('open')?'Voting has closed.':'Vote could not be recorded. Use the website or contact support.',true);
  const message=quantity+' vote(s) recorded for '+nominee.item!.name.slice(0,40)+'.';await db.from('ussd_sessions').update({mode:'complete',nominee_id:nominee.item!.id,category_id:category.item!.id,quantity,final_response:message}).eq('session_id',p.sessionId);return output(message,true);
 } catch (error) {console.error('[USSD] Voting menu failed',{code:typeof error==='object'&&error!==null&&'code' in error&&typeof error.code==='string'&&/^[A-Za-z0-9_-]{1,40}$/.test(error.code)?error.code:'unavailable'});return output('Service temporarily unavailable. Do not retry a payment already approved.',true,503);}
}
