"use client";

import { useRef, useState } from "react";

export function PaidVoteForm({
  eventId,
  categoryId,
  nomineeId,
  nomineeName,
  unitPriceMinor,
  defaultEmail,
}: {
  eventId: string;
  categoryId: string;
  nomineeId: string;
  nomineeName: string;
  unitPriceMinor: number;
  defaultEmail?: string | null;
}) {
  const attempt = useRef<{ details: string; key: string } | null>(null);

  // Telco Mobile Money (MTN, Telecel, AT) and Paystack require a minimum checkout of GH₵ 1.00 (100 pesewas)
  const minQuantity = Math.max(1, Math.ceil(100 / Math.max(1, unitPriceMinor)));
  const [quantity, setQuantity] = useState(minQuantity);
  const [email, setEmail] = useState(defaultEmail ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const totalMinor = unitPriceMinor * quantity;
  const totalGhs = (totalMinor / 100).toFixed(2);
  const isBelowMin = totalMinor < 100;

  // Preset quick packages
  const packages = [
    minQuantity,
    minQuantity === 1 ? 5 : minQuantity * 2,
    minQuantity === 1 ? 10 : minQuantity * 5,
    minQuantity === 1 ? 25 : minQuantity * 10,
  ];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (isBelowMin) {
      setError(
        `Minimum Mobile Money checkout is GH₵ 1.00. Please select at least ${minQuantity} votes.`
      );
      return;
    }

    setBusy(true);
    setError("");

    try {
      const details = JSON.stringify({ eventId, categoryId, nomineeId, quantity, email });
      if (attempt.current?.details !== details) {
        attempt.current = { details, key: crypto.randomUUID() };
      }

      const r = await fetch("/api/payments/paystack/vote", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          eventId,
          categoryId,
          nomineeId,
          quantity,
          email,
          requestKey: attempt.current.key,
        }),
      });

      const d = await r.json();
      if (!r.ok) {
        throw new Error(d.error || "Unable to start payment");
      }
      window.location.assign(d.authorization_url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to start payment");
      setBusy(false);
    }
  }

  return (
    <form className="space-y-3 text-left" onSubmit={submit}>
      <div>
        <div className="flex items-center justify-between mb-1">
          <label htmlFor={`qty-${nomineeId}`} className="text-xs font-semibold text-stone-700">
            Number of Votes
          </label>
          <span className="text-[11px] font-mono font-medium text-emerald-800">
            GH₵ {(unitPriceMinor / 100).toFixed(2)} / vote
          </span>
        </div>

        <div className="flex items-center gap-2">
          <input
            id={`qty-${nomineeId}`}
            type="number"
            min={minQuantity}
            max={100000}
            value={quantity}
            onChange={(e) => {
              const val = Number.parseInt(e.target.value, 10);
              setQuantity(Number.isNaN(val) ? minQuantity : val);
              setError("");
            }}
            className="w-full min-h-10 rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm font-semibold text-stone-900 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
          />
        </div>

        {/* Quick select chips */}
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] text-stone-600 mr-0.5">Quick select:</span>
          {packages.map((pkg) => (
            <button
              key={pkg}
              type="button"
              onClick={() => {
                setQuantity(pkg);
                setError("");
              }}
              className={`rounded-lg px-2 py-1 text-xs font-medium transition-all cursor-pointer ${
                quantity === pkg
                  ? "bg-emerald-800 text-white shadow-xs"
                  : "bg-stone-100 text-stone-700 hover:bg-stone-200"
              }`}
            >
              {pkg} {pkg === 1 ? "vote" : "votes"}
            </button>
          ))}
        </div>

        {unitPriceMinor < 100 && (
          <div className="mt-2 rounded-lg bg-amber-50/90 border border-amber-200/90 p-2.5 text-[11px] text-amber-900 leading-tight">
            ℹ️ <strong>Mobile Money Notice:</strong> Telcos & Paystack require a minimum checkout of{" "}
            <strong>GH₵ 1.00</strong>. Minimum purchase is <strong>{minQuantity} votes</strong> (GH₵{" "}
            {((minQuantity * unitPriceMinor) / 100).toFixed(2)}).
          </div>
        )}
      </div>

      <div>
        <label htmlFor={`email-${nomineeId}`} className="block text-xs font-semibold text-stone-700 mb-1">
          Email for receipt
        </label>
        <input
          id={`email-${nomineeId}`}
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="voter@example.com"
          className="w-full min-h-10 rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
        />
      </div>

      <button
        type="submit"
        disabled={busy || isBelowMin}
        className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-900 bg-emerald-900 px-4 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-emerald-800 min-h-10 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
      >
        {busy ? "Opening Paystack…" : `Pay GH₵ ${totalGhs} for ${quantity} ${quantity === 1 ? "Vote" : "Votes"}`}
      </button>

      {error && (
        <p className="rounded-lg bg-red-50 border border-red-200 p-2 text-xs text-red-700 font-medium" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
