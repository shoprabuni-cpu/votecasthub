"use client";
import { useState } from "react";
export function UssdAccessPayment({ eventId, quoteId }: { eventId: string; quoteId: string }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  async function pay() {
    setBusy(true);setError("");
    try {
      const response = await fetch("/api/payments/paystack/ussd", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ eventId, quoteId }) });
      const data = await response.json();if(!response.ok)throw new Error(data.error);
      const url = new URL(data.url);if(url.protocol!=="https:"||url.hostname!=="checkout.paystack.com")throw new Error("Invalid checkout link");
      window.location.assign(url.href);
    } catch(cause) {setError(cause instanceof Error?cause.message:"Payment unavailable");setBusy(false);}
  }
  return <div className="mt-4"><button type="button" onClick={pay} disabled={busy} className="min-h-11 rounded-xl bg-emerald-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700">{busy?"Opening checkout…":"Pay accepted USSD quote"}</button>{error&&<p role="alert" className="mt-2 text-sm text-red-800">{error}</p>}</div>;
}
