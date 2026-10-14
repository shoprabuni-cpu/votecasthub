import { paymentAdmin } from "@/lib/payments/admin";
import { ussdLiveReadiness } from "@/lib/ussd/live-readiness";

export async function UssdReadinessPanel() {
  const readiness = ussdLiveReadiness();
  let schemaReady = false;
  try {
    const db = paymentAdmin();
    const checks = await Promise.allSettled([
      db.from("event_ussd_requests").select("event_code,quote_id,access_paid,enabled,active_from,active_until").limit(0),
      db.from("ussd_access_payments").select("reference,status,provider_transaction_id").limit(0),
      db.from("ussd_sessions").select("native_lease,charge_status,payment_email").limit(0),
    ]);
    schemaReady = checks.every(check => check.status === "fulfilled" && !check.value.error);
  } catch { /* Missing credentials are represented in the checklist. */ }
  const prepared = readiness.prepared && schemaReady;
  return <section aria-labelledby="ussd-readiness-title" className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h2 id="ussd-readiness-title" className="text-lg font-semibold text-stone-900">Live service readiness</h2>
        <p className="mt-1 text-sm text-stone-600">{!readiness.live ? "You are viewing a test or local deployment. Open Production to check its settings." : prepared ? "Platform settings are ready. Complete the subscription and provider checks before launch." : "Complete the platform settings below before purchasing the extension."}</p></div>
      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${readiness.enabled ? "bg-amber-100 text-amber-900" : "bg-stone-100 text-stone-700"}`}>{readiness.enabled ? "Gateway enabled" : "Gateway off"}</span>
    </div>
    {readiness.live && <ul className="mt-4 grid gap-2 sm:grid-cols-2">
      {[...readiness.checks, { label: "USSD database columns accessible", ready: schemaReady, purchase: false }].map(check => <li key={check.label} className="flex items-center justify-between gap-3 rounded-xl bg-stone-50 px-3 py-2 text-sm"><span className="text-stone-700">{check.label}</span><span className={`shrink-0 text-xs font-semibold ${check.ready ? "text-emerald-800" : "text-amber-800"}`}>{check.ready ? "Ready" : check.purchase ? "After purchase" : "Needs setup"}</span></li>)}
    </ul>}
    <p className="mt-4 text-sm leading-6 text-stone-600">Before activation, confirm the Paystack webhook can reach the live site, verify the organizer’s live payout account, and test free and paid voting on a real handset. This checklist checks configuration and database access; it does not confirm provider delivery or settlement.</p>
  </section>;
}
