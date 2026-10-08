import { randomUUID } from "node:crypto";
import { z } from "zod";
import { paymentAdmin } from "@/lib/payments/admin";
import { allow,opaque,siteUrl } from "@/lib/payments/gateway";
import { reserveCheckout,initializeCheckout } from "@/lib/payments/checkout";
export const runtime="nodejs";
const schema=z.object({requestKey:z.string().uuid(),eventId:z.string().uuid(),categoryId:z.string().uuid(),nomineeId:z.string().uuid(),quantity:z.number().int().min(1).max(10000),email:z.email().max(254).transform(s=>s.trim().toLowerCase())});
export async function POST(request:Request){
 try{
  const parsed=schema.safeParse(await request.json());if(!parsed.success)return Response.json({error:"Enter a valid email and vote quantity."},{status:400});
  const p=parsed.data;const db=paymentAdmin();
  const ip=request.headers.get("x-vercel-forwarded-for")||request.headers.get("x-forwarded-for")||"unknown";
  if(!await allow(`checkout-ip:${opaque(ip)}`,20,600))return Response.json({error:"Too many checkout requests. Try again shortly."},{status:429});
  if(!await allow(`checkout:${opaque(p.email)}`,10,600))return Response.json({error:"Too many checkout requests. Please wait before trying again."},{status:429});
  const {data:event,error}=await db.from("events").select("id,organization_id,unit_price_minor,currency,voting_mode,status,starts_at,ends_at").eq("id",p.eventId).maybeSingle();if(error)throw error;
  if(!event||event.voting_mode!=="paid"||event.status!=="published"||Date.now()<Date.parse(event.starts_at)||Date.now()>=Date.parse(event.ends_at))return Response.json({error:"Paid voting is not open."},{status:409});
  const {data:organization,error:orgError}=await db.from("organizations").select("moderation_status,archived_at").eq("id",event.organization_id).maybeSingle();
  if(orgError||!organization||organization.moderation_status!=="active"||organization.archived_at)return Response.json({error:"Voting is unavailable for this organization."},{status:409});
  const [{data:category},{data:nominee},{data:account}]=await Promise.all([
   db.from("categories").select("id").eq("id",p.categoryId).eq("event_id",event.id).eq("is_active",true).maybeSingle(),
   db.from("nominees").select("id").eq("id",p.nomineeId).eq("category_id",p.categoryId).eq("is_active",true).maybeSingle(),
   db.from("organization_paystack_accounts").select("subaccount_code").eq("organization_id",event.organization_id).eq("status","active").eq("paystack_verified",true).eq("percentage_charge",10).maybeSingle()
  ]);
  if(!category||!nominee||!account)return Response.json({error:"Voting or the organizer payment account is unavailable."},{status:409});
  const {data:operation,error:operationError}=await db.from("payment_account_operations").select("organization_id").eq("organization_id",event.organization_id).maybeSingle();
  if(operationError||operation)return Response.json({error:"The organizer payment account is being updated. Please try again shortly."},{status:409});
  const total=Number(event.unit_price_minor)*p.quantity;
  if(!Number.isSafeInteger(total)||total<100||total>100000000||event.currency!=="GHS")return Response.json({error:"Checkout total must be between GH₵1 and GH₵1,000,000."},{status:400});
  const origin=siteUrl();
  const session=await reserveCheckout(p.requestKey,{...p,price:event.unit_price_minor},`VCH-VOTE-${randomUUID().replaceAll("-","")}`);
  if(!session.fresh){
   const {data:attempt,error:attemptError}=await db.from("payment_attempts").select("subaccount_code,status").eq("provider_reference",session.reference).maybeSingle();
   if(attemptError||!attempt||attempt.subaccount_code!==account.subaccount_code||attempt.status!=="pending")return Response.json({error:"This payment is no longer available for checkout. Check its status before starting a new payment.",reference:session.reference},{status:409});
   return session.url?Response.json({authorization_url:session.url,reference:session.reference}):Response.json({error:"This checkout is being confirmed. Check payment status before starting another.",reference:session.reference},{status:409});
  }
  const {error:insert}=await db.from("payment_attempts").insert({idempotency_key:p.requestKey,event_id:event.id,organization_id:event.organization_id,category_id:p.categoryId,nominee_id:p.nomineeId,quantity:p.quantity,unit_price_minor:event.unit_price_minor,total_amount_minor:total,currency:"GHS",provider:"paystack",provider_reference:session.reference,status:"pending",subaccount_code:account.subaccount_code});if(insert)throw insert;
  const url=await initializeCheckout(session.reference,{email:p.email,amount:total,currency:"GHS",subaccount:account.subaccount_code,bearer:"account",transaction_charge:Math.floor(total/10),callback_url:`${origin}/payments/complete`,metadata:{kind:"paid_vote"}});
  return Response.json({authorization_url:url,reference:session.reference});
 }catch{console.error("paid_checkout_failed");return Response.json({error:"Checkout could not be opened. Retry with the same details; do not pay again if already charged."},{status:503});}
}

