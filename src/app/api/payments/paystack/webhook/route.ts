import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
export const runtime = "nodejs";
export async function POST(request: Request) {
  const raw = await request.text(); const signature = request.headers.get("x-paystack-signature") ?? ""; const secret = process.env.PAYSTACK_SECRET_KEY; if(!secret || !signature) return new NextResponse("Unauthorized",{status:401});
  const expected=createHmac("sha512",secret).update(raw).digest("hex"); if(signature.length!==expected.length || !timingSafeEqual(Buffer.from(signature),Buffer.from(expected))) return new NextResponse("Unauthorized",{status:401});
  const event=JSON.parse(raw); const reference=event.data?.reference; if(typeof reference!=="string") return NextResponse.json({received:true}); const transactionId=Number(event.data?.id||0);
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL; const key=process.env.SUPABASE_SECRET_KEY; if(!url || !key) return new NextResponse("Server misconfigured",{status:503});
  const kind=event.data?.metadata?.kind;
  const response=event.event==="charge.success" ? kind==="paid_vote" ? await fetch(`${url}/rest/v1/rpc/confirm_paid_vote`,{method:"POST",headers:{apikey:key,Authorization:`Bearer ${key}`,"Content-Type":"application/json"},body:JSON.stringify({p_reference:reference,p_transaction_id:transactionId,p_paid_amount_minor:Number(event.data.amount),p_provider_fee_minor:Number(event.data.fees||0)})}) : await fetch(`${url}/rest/v1/rpc/fulfill_sms_credit_purchase`,{method:"POST",headers:{apikey:key,Authorization:`Bearer ${key}`,"Content-Type":"application/json"},body:JSON.stringify({p_reference:reference,p_transaction_id:transactionId})}) : ["refund.processed","charge.refunded","charge.reversed"].includes(event.event) ? await fetch(`${url}/rest/v1/rpc/reverse_paid_vote`,{method:"POST",headers:{apikey:key,Authorization:`Bearer ${key}`,"Content-Type":"application/json"},body:JSON.stringify({p_reference:reference,p_status:event.event.includes("refund")?"refunded":"reversed"})}) : null;
  if(!response) return NextResponse.json({received:true}); if(!response.ok) return new NextResponse("Fulfilment failed",{status:503}); return NextResponse.json({received:true});
}
