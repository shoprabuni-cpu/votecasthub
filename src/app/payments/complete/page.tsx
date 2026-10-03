import Link from "next/link";
import { paymentAdmin } from "@/lib/payments/admin";
import { PaymentStatusRefresh } from "@/components/payments/payment-status-refresh";
import { SiteHeader } from "@/components/site-header";
export const dynamic="force-dynamic";
export const metadata={title:"Payment status",robots:{index:false,follow:false},referrer:"no-referrer" as const};
export default async function PaymentComplete({searchParams}:{searchParams:Promise<{reference?:string}>}){
  const {reference}=await searchParams;
  let status="unknown";
  if(reference&&/^VCH-VOTE-[a-f0-9]{32}$/.test(reference)){
    try{const {data}=await paymentAdmin().from("payment_attempts").select("status").eq("provider","paystack").eq("provider_reference",reference).maybeSingle();status=data?.status??"unknown";}catch{status="unknown";}
  }
  const pending=["pending","created"].includes(status);
  const title=status==="succeeded"?"Your votes are confirmed.":pending?"We are confirming your payment.":["refunded","reversed"].includes(status)?"This payment has been reversed.":["failed","cancelled","expired"].includes(status)?"Payment was not completed.":"Payment status is unavailable.";
  return <main className="public-page"><SiteHeader/><section className="empty-state"><p className="eyebrow">PAYSTACK CHECKOUT</p><h1>{title}</h1><p>{pending?"Please wait for payment confirmation. You do not need to pay again.":status==="succeeded"?"Your payment has been recorded and your votes have been added.":"If money was deducted, keep your Paystack receipt and contact support before retrying."}</p>{pending&&<PaymentStatusRefresh/>}<Link className="text-link" href="/events">Browse events →</Link></section></main>;
}
