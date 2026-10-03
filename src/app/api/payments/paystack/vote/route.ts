import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { paystackSecret } from "@/lib/payments/paystack";
import { paymentAdmin } from "@/lib/payments/admin";
export const runtime="nodejs";
export async function POST(request:Request){
 try {
  const body=await request.json().catch(()=>null); const eventId=body?.eventId, categoryId=body?.categoryId, nomineeId=body?.nomineeId, quantity=Number(body?.quantity), email=String(body?.email||"").trim();
  if(!eventId||!categoryId||!nomineeId||!Number.isInteger(quantity)||quantity<1||quantity>10000||!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return NextResponse.json({error:"Enter a valid email and vote quantity."},{status:400});
  const supabase=await createClient(); const {data:event}=await paymentAdmin().from("events").select("id,organization_id,unit_price_minor,currency,voting_mode,status,starts_at,ends_at").eq("id",eventId).maybeSingle();
  if(!event||event.voting_mode!=="paid"||event.status!=="published"||Date.now()<new Date(event.starts_at).getTime()||Date.now()>=new Date(event.ends_at).getTime()) return NextResponse.json({error:"Paid voting is not open."},{status:409});
  const {data:category}=await supabase.from("categories").select("id").eq("id",categoryId).eq("event_id",eventId).eq("is_active",true).maybeSingle(); if(!category) return NextResponse.json({error:"Category not found."},{status:404});
  const {data:nominee}=await supabase.from("nominees").select("id,category_id").eq("id",nomineeId).eq("category_id",categoryId).eq("is_active",true).maybeSingle(); if(!nominee) return NextResponse.json({error:"Nominee not found."},{status:404});
  const {data:account}=await paymentAdmin().from("organization_paystack_accounts").select("subaccount_code,status,paystack_verified").eq("organization_id",event.organization_id).eq("status","active").eq("paystack_verified",true).maybeSingle(); if(!account) return NextResponse.json({error:"Organizer payment account is not ready."},{status:409});
  const total=Number(event.unit_price_minor)*quantity; if(!Number.isSafeInteger(total)||total<=0) return NextResponse.json({error:"Invalid vote price."},{status:500});
  const reference=`VCH-VOTE-${randomUUID().replaceAll("-","")}`; const url=process.env.NEXT_PUBLIC_SUPABASE_URL, key=process.env.SUPABASE_SECRET_KEY; if(!url||!key) return NextResponse.json({error:"Payments are not configured."},{status:503});
  const attempt={idempotency_key:randomUUID(),event_id:eventId,organization_id:event.organization_id,category_id:categoryId,nominee_id:nomineeId,quantity,unit_price_minor:event.unit_price_minor,total_amount_minor:total,currency:event.currency||"GHS",provider:"paystack",provider_reference:reference,status:"pending"};
  const ins=await fetch(`${url}/rest/v1/payment_attempts`,{method:"POST",headers:{apikey:key,Authorization:`Bearer ${key}`,"content-type":"application/json",Prefer:"return=minimal"},body:JSON.stringify(attempt)}); if(!ins.ok) return NextResponse.json({error:"Could not create payment."},{status:503});
  const ps=await fetch("https://api.paystack.co/transaction/initialize",{method:"POST",headers:{Authorization:`Bearer ${paystackSecret()}`,"content-type":"application/json"},body:JSON.stringify({email,amount:total,currency:event.currency||"GHS",reference,subaccount:account.subaccount_code,bearer:"account",transaction_charge:Math.floor(total/10),callback_url:`${process.env.NEXT_PUBLIC_SITE_URL||""}/payments/complete`,metadata:{kind:"paid_vote",event_id:eventId,category_id:categoryId,nominee_id:nomineeId,quantity,organization_id:event.organization_id}})}); const data=await ps.json().catch(()=>null); if(!ps.ok||!data?.status) return NextResponse.json({error:data?.message||"Paystack initialization failed."},{status:502}); return NextResponse.json({authorization_url:data.data.authorization_url,reference});
 } catch { return NextResponse.json({error:"Payment service unavailable. Please try again shortly."},{status:503}); }
}
