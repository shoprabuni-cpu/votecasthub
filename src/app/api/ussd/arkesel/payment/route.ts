import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { paymentAdmin } from "@/lib/payments/admin";
import { allow } from "@/lib/payments/gateway";
export const runtime="nodejs";
export async function POST(request:Request){
 const secret=process.env.ARKESEL_USSD_SHARED_SECRET;const signature=request.headers.get("x-arkesel-ussd-signature")||"";const raw=await request.text();
 if(!secret||!signature){return new Response("Unauthorized",{status:401});}const expected=createHmac("sha256",secret).update(raw).digest("hex");if(signature.length!==expected.length||!timingSafeEqual(Buffer.from(signature),Buffer.from(expected)))return new Response("Unauthorized",{status:401});
 const parsed=z.object({reference:z.string().regex(/^VCH-USSD-[A-Za-z0-9]+$/),status:z.enum(["success","failed","reversed"]),transactionId:z.coerce.number().int().positive(),amount:z.coerce.number().int().positive()}).safeParse(JSON.parse(raw));if(!parsed.success)return new Response("Bad request",{status:400});
 if(!await allow(`ussd-payment:${parsed.data.reference}`,3,3600))return new Response("Too many callbacks",{status:429});
 const db=paymentAdmin();if(parsed.data.status==="success"){const {error}=await db.rpc("confirm_ussd_paid_vote",{p_reference:parsed.data.reference,p_transaction_id:parsed.data.transactionId,p_paid_amount_minor:parsed.data.amount});if(error)return new Response("Retry",{status:503});}else if(parsed.data.status==="reversed"){const {error}=await db.rpc("apply_payment_adjustment",{p_reference:parsed.data.reference,p_provider_key:`ussd:${parsed.data.transactionId}`,p_amount_minor:parsed.data.amount,p_kind:"reversal"});if(error)return new Response("Retry",{status:503});}
 return Response.json({received:true});
}
