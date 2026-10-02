import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
export const runtime = "nodejs";
export async function POST(request: Request) {
  const raw = await request.text(); const signature = request.headers.get("x-paystack-signature") ?? ""; const secret = process.env.PAYSTACK_SECRET_KEY; if(!secret || !signature) return new NextResponse("Unauthorized",{status:401});
  const expected=createHmac("sha512",secret).update(raw).digest("hex"); if(signature.length!==expected.length || !timingSafeEqual(Buffer.from(signature),Buffer.from(expected))) return new NextResponse("Unauthorized",{status:401});
  const event=JSON.parse(raw); if(event.event!=="charge.success") return NextResponse.json({received:true}); const reference=event.data?.reference; const transactionId=Number(event.data?.id); if(typeof reference!=="string" || !Number.isSafeInteger(transactionId)) return new NextResponse("Invalid event",{status:400});
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL; const key=process.env.SUPABASE_SECRET_KEY; if(!url || !key) return new NextResponse("Server misconfigured",{status:503});
  const response=await fetch(`${url}/rest/v1/rpc/fulfill_sms_credit_purchase`,{method:"POST",headers:{apikey:key,Authorization:`Bearer ${key}`,"Content-Type":"application/json"},body:JSON.stringify({p_reference:reference,p_transaction_id:transactionId})}); if(!response.ok) return new NextResponse("Fulfilment failed",{status:503}); return NextResponse.json({received:true});
}
