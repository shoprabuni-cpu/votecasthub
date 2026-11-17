"use client";
import { useActionState } from "react";
import { requestUssdAction } from "@/lib/ussd/actions";
import Link from "next/link";
import { UssdQuoteDetails, type UssdQuote } from "./ussd-quote-form";
import { UssdAccessPayment } from "./ussd-access-payment";
import { Icon } from "@/components/icon";

export function UssdRequest({ eventId, requested, canRequest, unavailable, quote, canAccept = false }: { eventId: string; requested: boolean; canRequest: boolean; unavailable: boolean; quote?: UssdQuote | null; canAccept?: boolean }) {
  const [state, action, pending] = useActionState(requestUssdAction, null);
  return (
    <section className="rounded-2xl border border-stone-200/90 bg-white p-5 shadow-xs transition-colors dark:border-[#1c2721] dark:bg-[#0c120e] sm:p-6">
      <div className="flex items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-800 dark:border dark:border-emerald-800/40 dark:bg-emerald-950 dark:text-emerald-300">
          <Icon name="phone" />
        </span>
        <div>
          <h2 className="text-base sm:text-lg font-serif font-bold text-stone-900 dark:text-stone-100">
            Also allow voting by dialing a code (USSD)
          </h2>
          <p className="mt-1 text-xs sm:text-sm leading-6 text-stone-600 dark:text-stone-400">
            Optional USSD access works without internet (*920#). Additional telco charges apply and will be quoted before activation. SMS credits are separate.
          </p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="inline-flex rounded-full bg-stone-100 px-3 py-1 font-mono text-[11px] font-bold text-stone-700 dark:border dark:border-[#1c2721] dark:bg-[#141b16] dark:text-stone-300">
          {unavailable ? "Status unavailable" : quote?.payment_status === "refunded" ? "Payment refunded — contact support" : quote?.enabled ? "USSD enabled — follows activation dates" : quote?.access_paid ? "Payment confirmed — awaiting activation" : quote?.status === "accepted" ? "Quote accepted — awaiting payment" : quote?.status === "quoted" ? "Quote ready" : requested ? "Activation requested" : "Not enabled"}
        </span>
      </div>
      <p className="mt-3 text-xs sm:text-sm text-stone-600 dark:text-stone-400 leading-relaxed">
        {unavailable ? "Refresh to check USSD request status." : quote?.payment_status === "refunded" ? "Your access payment has a refund. Contact platform support before arranging new access." : quote?.enabled ? "Dialing instructions appear on your voter page during the active voting period." : quote?.access_paid ? "Your payment is confirmed. Platform activation is still required." : quote?.status === "accepted" ? "Your quote is accepted. Pay the quote below; provider activation is still required." : quote?.status === "quoted" ? "Review your price and service terms below. An owner or admin can accept the quote." : requested ? "Your request is awaiting a quote and provider setup. No dialing code is active yet." : "Request a quote for this event. Website voting remains available with your existing settings."}
      </p>
      {quote && <UssdQuoteDetails eventId={eventId} quote={quote} canAccept={canAccept} />}
      {quote?.status === "accepted" && quote.quote_id && !quote.access_paid && quote.payment_status !== "refunded" && canAccept && <UssdAccessPayment eventId={eventId} quoteId={quote.quote_id}/>}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Link href="/guides/vote-without-internet-ussd" className="inline-flex min-h-10 items-center rounded-xl border border-stone-300 bg-white px-3.5 text-xs font-semibold text-emerald-900 hover:bg-stone-50 dark:border-[#223028] dark:bg-[#141b16] dark:text-emerald-300 dark:hover:bg-[#1c2721]">
          Understand USSD access and costs →
        </Link>
      </div>
      {canRequest && !unavailable && quote?.status !== "accepted" && (
        <form action={action} className="mt-4">
          <input type="hidden" name="eventId" value={eventId} />
          <input type="hidden" name="requested" value={requested ? "no" : "yes"} />
          <button disabled={pending} className="min-h-10 cursor-pointer rounded-xl border border-emerald-900 bg-emerald-900 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-800 transition-all active:scale-95 disabled:cursor-wait disabled:opacity-50 dark:border-emerald-700 dark:bg-emerald-800 dark:hover:bg-emerald-700">
            {pending ? "Saving…" : requested ? "Cancel USSD request" : "Request USSD quote"}
          </button>
        </form>
      )}
      {state?.message && <p role={state.success ? "status" : "alert"} className={`mt-3 text-xs sm:text-sm font-semibold ${state.success ? "text-emerald-800 dark:text-emerald-400" : "text-red-800 dark:text-red-400"}`}>{state.message}</p>}
    </section>
  );
}
