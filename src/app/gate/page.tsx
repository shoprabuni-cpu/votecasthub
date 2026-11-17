"use client";

import { useState } from "react";
import Link from "next/link";
import { gateCheckInAction } from "@/lib/tickets/actions";
import type { GateCheckInResponse } from "@/lib/tickets/types";
import { SiteHeader } from "@/components/site-header";
import { Icon } from "@/components/icon";

export default function GateScannerPage() {
  const [paxInput, setPaxInput] = useState("");
  const [usherName, setUsherName] = useState("Gate Usher 1");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GateCheckInResponse | null>(null);

  async function handleVerify(codeToVerify?: string) {
    const code = codeToVerify ?? paxInput;
    if (!code.trim()) return;

    setLoading(true);
    setResult(null);

    try {
      const res = await gateCheckInAction(code.trim(), usherName);
      setResult(res);
      if (res.status === "success") {
        setPaxInput("");
      }
    } catch (err) {
      setResult({
        status: "invalid",
        message: err instanceof Error ? err.message : "Validation error.",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-stone-50 text-stone-900 dark:bg-black dark:text-stone-100">
      <SiteHeader />

      <div className="mx-auto max-w-lg px-4 py-8 sm:px-6">
        <div className="text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">
            <span className="size-2 rounded-full bg-emerald-600 animate-pulse" />
            LIVE GATE SCANNER
          </span>
          <h1 className="mt-3 text-2xl font-bold font-serif sm:text-3xl text-stone-900 dark:text-white">
            Gate Entry Verification
          </h1>
          <p className="mt-1 text-xs text-stone-600 dark:text-stone-400">
            Scan attendee QR code or type their <strong>CODE PAX</strong> (e.g. PAX-1024).
          </p>
        </div>

        {/* Gate Usher Config */}
        <div className="mt-6 flex items-center justify-between rounded-xl border border-stone-200 bg-white p-3 text-xs dark:border-[#1c2721] dark:bg-[#070a08]">
          <span className="text-stone-500 dark:text-stone-400 font-semibold">Active Gate Usher:</span>
          <input
            type="text"
            value={usherName}
            onChange={(e) => setUsherName(e.target.value)}
            className="w-36 rounded-lg border border-stone-200 bg-stone-50 px-2 py-1 text-xs text-right font-bold text-stone-900 dark:border-[#1c2721] dark:bg-[#0a0d0b] dark:text-white"
          />
        </div>

        {/* Verification Input & Action */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleVerify();
          }}
          className="mt-4 rounded-3xl border border-stone-200 bg-white p-6 shadow-md dark:border-[#1c2721] dark:bg-[#070a08]"
        >
          <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 dark:text-stone-300">
            Enter CODE PAX or Scan QR
          </label>

          <div className="mt-2 flex gap-2">
            <input
              type="text"
              autoFocus
              required
              placeholder="e.g. PAX-1024"
              value={paxInput}
              onChange={(e) => setPaxInput(e.target.value.toUpperCase())}
              className="min-h-14 flex-1 rounded-2xl border border-stone-200 bg-stone-50 px-4 font-mono text-lg font-black uppercase text-stone-900 focus:border-emerald-600 focus:bg-white focus:outline-hidden focus:ring-3 focus:ring-emerald-600/20 dark:border-[#1c2721] dark:bg-[#0a0d0b] dark:text-white"
            />
            <button
              type="submit"
              disabled={loading}
              className="inline-flex min-h-14 items-center justify-center rounded-2xl bg-emerald-900 px-6 font-bold text-white shadow-xs hover:bg-emerald-800 disabled:opacity-50 transition-all dark:bg-emerald-600 dark:hover:bg-emerald-500 cursor-pointer"
            >
              {loading ? "Checking..." : "Verify"}
            </button>
          </div>

          <p className="mt-2 text-[11px] text-stone-500 dark:text-stone-400">
            Works with any barcode/QR handheld gun or smartphone camera paste.
          </p>
        </form>

        {/* Validation Result Banner */}
        {result && (
          <div
            className={`mt-6 rounded-3xl border p-6 text-center shadow-lg transition-all ${
              result.status === "success"
                ? "border-emerald-400 bg-emerald-50 text-emerald-950 dark:border-emerald-600 dark:bg-[#0a2315] dark:text-emerald-100"
                : result.status === "already_used"
                ? "border-amber-400 bg-amber-50 text-amber-950 dark:border-amber-600 dark:bg-[#281a05] dark:text-amber-100"
                : "border-red-400 bg-red-50 text-red-950 dark:border-red-600 dark:bg-[#280a0a] dark:text-red-100"
            }`}
          >
            {result.status === "success" && (
              <div>
                <div className="mx-auto mb-2 flex size-14 items-center justify-center rounded-full bg-emerald-600 text-white text-2xl font-black">
                  ✓
                </div>
                <h2 className="text-xl font-black">VALID TICKET — ENTRY GRANTED</h2>
                <div className="mt-3 rounded-2xl bg-white/80 p-4 text-xs font-semibold dark:bg-black/40 text-stone-800 dark:text-stone-200 space-y-1">
                  <p className="text-base font-bold text-emerald-900 dark:text-emerald-300">
                    {result.customer_name}
                  </p>
                  <p>Tier: <strong>{result.tier_name}</strong> ({result.quantity} Person)</p>
                  <p>Code: <strong className="font-mono">{result.pax_code}</strong></p>
                  <p>Event: {result.event_name}</p>
                </div>
              </div>
            )}

            {result.status === "already_used" && (
              <div>
                <div className="mx-auto mb-2 flex size-14 items-center justify-center rounded-full bg-amber-600 text-white text-2xl font-black">
                  ⚠️
                </div>
                <h2 className="text-xl font-black">ALREADY SCANNED!</h2>
                <p className="mt-1 text-xs">This ticket was already checked in at the door.</p>
                <div className="mt-3 rounded-2xl bg-white/80 p-4 text-xs font-semibold dark:bg-black/40 text-stone-800 dark:text-stone-200 space-y-1">
                  <p className="font-bold">{result.customer_name} ({result.tier_name})</p>
                  <p>Scanned By: {result.checked_in_by}</p>
                  <p>Code: <strong className="font-mono">{result.pax_code}</strong></p>
                </div>
              </div>
            )}

            {result.status === "invalid" && (
              <div>
                <div className="mx-auto mb-2 flex size-14 items-center justify-center rounded-full bg-red-600 text-white text-2xl font-black">
                  ✕
                </div>
                <h2 className="text-xl font-black">INVALID TICKET</h2>
                <p className="mt-1 text-xs">{result.message}</p>
              </div>
            )}
          </div>
        )}

        <div className="mt-8 text-center">
          <Link
            href="/"
            className="text-xs font-semibold text-emerald-800 underline dark:text-emerald-400"
          >
            ← Back to VoteCastHub GH Home
          </Link>
        </div>
      </div>
    </main>
  );
}
