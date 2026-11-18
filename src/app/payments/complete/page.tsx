import Link from "next/link";
import { paymentAdmin } from "@/lib/payments/admin";
import { reconcileReference } from "@/lib/payments/reconcile";
import { allow } from "@/lib/payments/gateway";
import { PaymentStatusRefresh } from "@/components/payments/payment-status-refresh";
import { SiteHeader } from "@/components/site-header";

export const dynamic = "force-dynamic";
export const metadata = { title: "Payment status", robots: { index: false, follow: false }, referrer: "no-referrer" as const };

export default async function PaymentComplete({ searchParams }: { searchParams: Promise<{ reference?: string }> }) {
  const { reference } = await searchParams;
  let status = "unknown";
  let refunded = 0;
  const access = reference?.startsWith("VCH-ACCESS-") ?? false;
  const sms = reference?.startsWith("VCH-SMS-") ?? false;
  const isTicket = reference?.startsWith("VCH-TIK-") ?? false;
  let ticketPaxCodes: string[] = [];
  let eventSlug: string | null = null;

  if (reference && /^(VCH-VOTE-[a-f0-9]{32}|VCH-SMS-[A-Z0-9-]{12,64}|VCH-ACCESS-[a-f0-9]{32}|VCH-TIK-[a-f0-9]{32})$/.test(reference)) {
    try {
      const db = paymentAdmin();
      if (isTicket) {
        const { data: knownTickets } = await db
          .from("event_tickets")
          .select("status, pax_code, event_id")
          .eq("order_reference", reference);

        if (knownTickets && knownTickets.length > 0) {
          if (knownTickets.some(t => t.status === "pending") && await allow(`verify:${reference}`, 1, 15)) {
            try { await reconcileReference(reference); } catch {}
          }
          const { data: updated } = await db
            .from("event_tickets")
            .select("status, pax_code, event_id")
            .eq("order_reference", reference);

          const allValid = updated && updated.length > 0 && updated.every(t => t.status === "valid");
          status = allValid ? "succeeded" : updated?.[0]?.status || "unknown";
          ticketPaxCodes = (updated ?? []).map(t => t.pax_code);
          if (updated?.[0]?.event_id) {
            const { data: ev } = await db.from("events").select("slug").eq("id", updated[0].event_id).maybeSingle();
            eventSlug = ev?.slug || null;
          }
        }
      } else {
        const table = access ? "ussd_access_payments" : sms ? "sms_credit_purchases" : "payment_attempts";
        const column = (sms || access) ? "reference" : "provider_reference";
        const { data: known } = await db.from(table).select("status").eq(column, reference).maybeSingle();
        if (known) {
          if (["pending", "created"].includes(known.status) && await allow(`verify:${reference}`, 1, 15)) {
            try { await reconcileReference(reference); } catch {}
          }
          const { data } = await db.from(table).select("status").eq(column, reference).maybeSingle();
          status = data?.status || "unknown";
          const { data: adjusted } = await db.from(access ? "ussd_access_payments" : sms ? "sms_credit_purchases" : "paid_vote_ledger").select("refunded_amount_minor").eq("reference", reference).maybeSingle();
          refunded = Number(adjusted?.refunded_amount_minor || 0);
        }
      }
    } catch {
      status = "unknown";
    }
  }

  const pending = ["pending", "created"].includes(status);
  const success = ["succeeded", "paid"].includes(status);
  const ticketCodesText = ticketPaxCodes.length > 1
    ? `${ticketPaxCodes.length} Tickets Confirmed! Codes: ${ticketPaxCodes.map(c => '#' + c).join(", ")}`
    : `Ticket Confirmed! CODE PAX: #${ticketPaxCodes[0] || ""}`;

  const title = refunded > 0
    ? "This payment has a refund or reversal."
    : success
    ? (isTicket ? ticketCodesText : access ? "Your USSD access payment is confirmed." : sms ? "Your SMS credits are ready." : "Your votes are confirmed.")
    : pending
    ? "We are confirming your payment."
    : "Payment status is unavailable.";

  return (
    <main className="min-h-screen bg-[var(--paper)] text-[var(--ink)]">
      <SiteHeader />
      <section className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-4 py-16 text-center sm:px-6">
        <p className="flex items-center gap-2 text-xs font-bold tracking-widest text-emerald-800 uppercase dark:text-emerald-400">PAYSTACK CHECKOUT</p>
        <h1 className="mt-4 mb-3 font-serif text-3xl sm:text-4xl font-medium tracking-tight text-stone-900 dark:text-white">{title}</h1>
        <p className="max-w-md text-sm leading-relaxed text-stone-600 dark:text-stone-300">
          {refunded > 0
            ? "Your remaining votes or credits have been adjusted to match the confirmed refund."
            : pending
            ? "Please wait for payment confirmation. You do not need to pay again."
            : success
            ? (isTicket
                ? `Your ${ticketPaxCodes.length > 1 ? `${ticketPaxCodes.length} digital passes have` : "ticket pass has"} been issued. Each attendee has a unique verification code. SMS confirmation has also been dispatched to your phone.`
                : access
                ? "Provider activation is still required before voters can dial a code."
                : sms
                ? "Your credit balance has been updated."
                : "Your payment and votes have been recorded.")
            : "If money was deducted, keep your Paystack receipt and contact support before retrying."}
        </p>
        {pending && <div className="mt-6"><PaymentStatusRefresh /></div>}
        <Link
          className="mt-8 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-900 px-6 py-3 text-sm font-semibold text-white shadow-xs hover:bg-emerald-800 transition dark:bg-emerald-600 dark:hover:bg-emerald-500"
          href={isTicket ? `/tickets?q=${reference}` : (sms || access) ? "/organizer" : "/events"}
        >
          {isTicket ? "View & Save All Ticket Passes →" : (sms || access) ? "Return to workspace" : "Browse events →"}
        </Link>
      </section>
    </main>
  );
}
