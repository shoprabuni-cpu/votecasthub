import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { paymentAdmin } from '@/lib/payments/admin';
import { initializeCheckout } from '@/lib/payments/checkout';
import { allow,siteUrl } from '@/lib/payments/gateway';
export const runtime='nodejs';
export async function POST(request:Request) {
 try {
  const parsed=z.object({eventId:z.uuid(),quoteId:z.uuid()}).safeParse(await request.json());if(!parsed.success)return Response.json({error:'Invalid quote'},{status:400});
  const db=await createClient();const {data:{user}}=await db.auth.getUser();if(!user?.email)return Response.json({error:'Sign in required'},{status:401});
  const {data:r}=await db.from('event_ussd_requests').select('organization_id,status,quote_id').eq('event_id',parsed.data.eventId).single();
  const {data:m}=await db.from('organization_members').select('role').eq('organization_id',r?.organization_id??'').eq('user_id',user.id).maybeSingle();
  if(!m||!['owner','admin'].includes(m.role)||r?.status!=='accepted'||r.quote_id!==parsed.data.quoteId)return Response.json({error:'Accepted quote and owner/admin access required'},{status:403});
  if(!await allow('ussd-access:'+user.id,10,600))return Response.json({error:'Try again later'},{status:429});
  const admin=paymentAdmin();const {data:p,error}=await admin.rpc('begin_ussd_access_checkout',{p_event_id:parsed.data.eventId,p_quote_id:parsed.data.quoteId,p_reference:'VCH-ACCESS-'+randomBytes(16).toString('hex')});if(error)throw error;
  if(p.status!=='pending')return Response.json({error:'Payment is already recorded. Refresh your event.'},{status:409});
  const {data:session}=await admin.from('checkout_sessions').select('authorization_url').eq('reference',p.reference).maybeSingle();
  if(session?.authorization_url)return Response.json({url:session.authorization_url});
  if(session)return Response.json({error:'Payment setup is being checked. Do not start another payment.'},{status:409});
  const {error:lock}=await admin.from('checkout_sessions').insert({request_key:p.id,fingerprint:p.quote_id,reference:p.reference});if(lock)return Response.json({error:'Payment setup is in progress. Try again shortly.'},{status:409});
  const url=await initializeCheckout(p.reference,{email:user.email,amount:p.amount_minor,currency:'GHS',callback_url:siteUrl()+'/payments/complete',metadata:{kind:'ussd_access'}});
  return Response.json({url});
 }catch{return Response.json({error:'Could not start payment. If money was deducted, contact support before retrying.'},{status:503});}
}
