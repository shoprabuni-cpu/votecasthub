import "server-only";
import { z } from "zod";
import { paystack } from "@/lib/payments/gateway";
import { paymentAdmin } from "@/lib/payments/admin";
import { reconcileReference } from "@/lib/payments/reconcile";

const charge = z.object({ reference: z.string(), status: z.string(), display_text: z.string().optional() });
export function momoProvider(network: string) {
  const key = network.toUpperCase().replace(/[^A-Z]/g, "");
  if(key === "MTN")return "mtn";
  if(["AIRTELTIGO","AIRTEL","TIGO","AT","ATMONEY"].includes(key))return "atl";
  if(["TELECEL","VODAFONE","VOD"].includes(key))return "vod";
  return null;
}
const response = (message: string, end = false) => new Response(`${end?"END":"CON"} ${message}`,{headers:{"content-type":"text/plain; charset=utf-8","cache-control":"no-store"}});

async function renderCharge(sessionId: string, reference: string, raw: unknown) {
  const result=charge.parse(raw);if(result.reference!==reference)throw new Error("Charge reference mismatch");
  const db=paymentAdmin();const {error}=await db.from("ussd_sessions").update({charge_status:result.status,charge_checked_at:new Date().toISOString()}).eq("session_id",sessionId);if(error)throw error;
  if(result.status==="success") {
    if(!await reconcileReference(reference))return response("Payment is being confirmed. Do not pay again.",true);
    return response("Payment confirmed. Your votes have been recorded.",true);
  }
  if(result.status==="send_otp")return response("Enter the payment OTP sent by your network. Never enter your MoMo PIN here.\n0. Exit");
  if(result.status==="pending")return response("Payment processing. Wait 10 seconds.\n1. Check payment\n0. Exit");
  if(result.status==="pay_offline")return response("Approve the Mobile Money prompt on your phone. Votes count after payment confirmation.",true);
  if(["failed","timeout"].includes(result.status)) {
    const {error:failed}=await db.from("payment_attempts").update({status:"failed"}).eq("provider_reference",reference).eq("provider","paystack").eq("status","pending");if(failed)throw failed;
    return response("Payment was not completed. If money was deducted, contact support before trying again.",true);
  }
  return response("This payment needs another verification method. Use the website or contact support. Do not pay again if charged.",true);
}

export async function startPaystackUssdCharge(sessionId:string,phone:string,network:string,email:string,attempt:{provider_reference:string;total_amount_minor:number;subaccount_code:string}) {
  const provider=momoProvider(network);
  if(!provider||!z.email().safeParse(email).success)throw new Error("Mobile Money configuration unavailable");
  const db=paymentAdmin();const {data:fresh,error}=await db.rpc("claim_ussd_charge",{p_reference:attempt.provider_reference});if(error)throw error;
  if(!fresh)return response("Payment is already being checked. Do not pay again.",true);
  const result=await paystack("/charge",{reference:attempt.provider_reference,email,amount:Number(attempt.total_amount_minor),currency:"GHS",mobile_money:{phone:`0${phone.slice(3)}`,provider},subaccount:attempt.subaccount_code,bearer:"account",transaction_charge:Math.floor(Number(attempt.total_amount_minor)/10),metadata:{kind:"ussd_paid_vote"}});
  return renderCharge(sessionId,attempt.provider_reference,result);
}

export async function continuePaystackUssdCharge(session:{session_id:string;reference:string;charge_status:string;charge_checked_at:string|null},input:string) {
  if(input==="0")return response("Payment can still complete on your phone. Do not start another charge if you approved it.",true);
  if(session.charge_status==="send_otp") {
    if(!/^\d{4,10}$/.test(input))return response("Enter the OTP from your network.\n0. Exit");
    return renderCharge(session.session_id,session.reference,await paystack("/charge/submit_otp",{reference:session.reference,otp:input}));
  }
  if(session.charge_checked_at&&Date.now()-Date.parse(session.charge_checked_at)<10000)return response("Still processing. Wait 10 seconds.\n1. Check payment\n0. Exit");
  return renderCharge(session.session_id,session.reference,await paystack(`/charge/${encodeURIComponent(session.reference)}`));
}
