"use client";
import { useActionState } from "react";
import { requestUssdAction } from "@/lib/ussd/actions";
import { UssdQuoteDetails, type UssdQuote } from "./ussd-quote-form";
import { UssdAccessPayment } from "./ussd-access-payment";
import { Icon } from "@/components/icon";

export function UssdRequest({ eventId, requested, canRequest, unavailable, quote, canAccept = false }: { eventId: string; requested: boolean; canRequest: boolean; unavailable: boolean; quote?: UssdQuote | null; canAccept?: boolean }) {
  const [state, action, pending] = useActionState(requestUssdAction, null);
  return <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-xs sm:p-6">
    <div className="flex items-start gap-3"><span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-800"><Icon name="phone" /></span><div><h2 className="text-lg font-semibold">Also allow voting by dialing a code</h2><p className="mt-1 text-sm leading-6 text-stone-600">Optional USSD access works without internet. Additional charges apply and will be quoted before activation. SMS credits are separate.</p></div></div>
    <p className="mt-4 inline-flex rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold text-stone-700">{unavailable ? "Status unavailable" : quote?.payment_status === "refunded" ? "Payment refunded — contact support" : quote?.enabled ? "USSD enabled — follows activation dates" : quote?.access_paid ? "Payment confirmed — awaiting activation" : quote?.status === "accepted" ? "Quote accepted — awaiting payment" : quote?.status === "quoted" ? "Quote ready" : requested ? "Activation requested" : "Not enabled"}</p>
    <p className="mt-3 text-sm text-stone-600">{unavailable ? "Refresh to check USSD request status." : quote?.payment_status === "refunded" ? "Your access payment has a refund. Contact platform support before arranging new access." : quote?.enabled ? "Dialing instructions appear on your voter page during the active voting period." : quote?.access_paid ? "Your payment is confirmed. Platform activation is still required." : quote?.status === "accepted" ? "Your quote is accepted. Pay the quote below; provider activation is still required." : quote?.status === "quoted" ? "Review your price and service terms below. An owner or admin can accept the quote." : requested ? "Your request is awaiting a quote and provider setup. No dialing code is active yet." : "Request a quote for this event. Website voting remains available with your existing settings."}</p>
    {quote && <UssdQuoteDetails eventId={eventId} quote={quote} canAccept={canAccept} />}
    {quote?.status === "accepted" && quote.quote_id && !quote.access_paid && quote.payment_status !== "refunded" && canAccept && <UssdAccessPayment eventId={eventId} quoteId={quote.quote_id}/>}
    {canRequest && !unavailable && quote?.status !== "accepted" && <form action={action} className="mt-4"><input type="hidden" name="eventId" value={eventId} /><input type="hidden" name="requested" value={requested ? "no" : "yes"} /><button disabled={pending} className="min-h-11 cursor-pointer rounded-xl border border-emerald-900 bg-emerald-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-wait disabled:opacity-50">{pending ? "Saving…" : requested ? "Cancel USSD request" : "Request USSD activation"}</button></form>}
    {state?.message && <p role={state.success ? "status" : "alert"} className={`mt-3 text-sm ${state.success ? "text-emerald-800" : "text-red-800"}`}>{state.message}</p>}
  </section>;
}
