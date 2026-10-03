import Link from "next/link";
import { paymentAdmin } from "@/lib/payments/admin";
import { reconcileReference } from "@/lib/payments/reconcile";
import { allow } from "@/lib/payments/gateway";
import { PaymentStatusRefresh } from "@/components/payments/payment-status-refresh";
import { SiteHeader } from "@/components/site-header";
export const dynamic="force-dynamic";
export const metadata={title:"Payment status",robots:{index:false,follow:false},referrer:"no-referrer" as const};
export default async function PaymentComplete({searchParams}:{searchParams:Promise<{reference?:string}>}){
 const {reference}=await searchParams;let status="unknown";let refunded=0;
 const sms=reference?.startsWith("VCH-SMS-")??false;
 if(reference&&/^(VCH-VOTE-[a-f0-9]{32}|VCH-SMS-[A-Z0-9-]{12,64})$/.test(reference)){
  try{
   const db=paymentAdmin();const table=sms?"sms_credit_purchases":"payment_attempts";const column=sms?"reference":"provider_reference";
   const {data:known}=await db.from(table).select("status").eq(column,reference).maybeSingle();
   if(known){
    if(["pending","created"].includes(known.status)&&await allow(`verify:${reference}`,1,15)){try{await reconcileReference(reference);}catch{/* Webhook/cron can retry; never grant from the redirect alone. */}}
    const {data}=await db.from(table).select("status").eq(column,reference).maybeSingle();status=data?.status||"unknown";
    const {data:adjusted}=await db.from(sms?"sms_credit_purchases":"paid_vote_ledger").select("refunded_amount_minor").eq("reference",reference).maybeSingle();refunded=Number(adjusted?.refunded_amount_minor||0);
   }
  }catch{status="unknown";}
 }
 const pending=["pending","created"].includes(status);const success=["succeeded","paid"].includes(status);
 const title=refunded>0?"This payment has a refund or reversal.":success?(sms?"Your SMS credits are ready.":"Your votes are confirmed."):pending?"We are confirming your payment.":"Payment status is unavailable.";
 return <main className="public-page"><SiteHeader/><section className="empty-state"><p className="eyebrow">PAYSTACK CHECKOUT</p><h1>{title}</h1><p>{refunded>0?"Your remaining votes or credits have been adjusted to match the confirmed refund.":pending?"Please wait for payment confirmation. You do not need to pay again.":success?(sms?"Your credit balance has been updated.":"Your payment and votes have been recorded."):"If money was deducted, keep your Paystack receipt and contact support before retrying."}</p>{pending&&<PaymentStatusRefresh/>}<Link className="text-link" href={sms?"/organizer":"/events"}>{sms?"Return to workspace":"Browse events"} →</Link></section></main>;
}
