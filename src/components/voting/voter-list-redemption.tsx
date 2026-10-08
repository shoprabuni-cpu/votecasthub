"use client";

import Link from "next/link";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Icon } from "@/components/icon";

async function hash(v: string) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(v.trim().toLowerCase()));
  return Array.from(new Uint8Array(b))
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
}

export function VoterListRedemption({
  eventId,
  isAuthenticated = false,
  isVerified = false,
  nextPath = "",
}: {
  eventId: string;
  isAuthenticated?: boolean;
  isVerified?: boolean;
  nextPath?: string;
}) {
  const [value, setValue] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [busy, setBusy] = useState(false);

  async function redeem() {
    if (!value.trim()) return;
    setBusy(true);
    setMessage(null);
    try {
      const type = value.includes("@") ? "email" : "phone";
      const { error } = await createClient().rpc("redeem_event_voter_list_entry", {
        p_event_id: eventId,
        p_identifier_hash: await hash(value),
        p_identifier_type: type,
      });
      if (error) {
        setMessage(error.message || "Your identity is not on the approved voter list.");
        setIsSuccess(false);
      } else {
        setMessage("Approved voter identity confirmed! You can now vote below.");
        setIsSuccess(true);
        setTimeout(() => {
          window.location.reload();
        }, 1200);
      }
    } catch {
      setMessage("Could not confirm voter eligibility. Please try again.");
      setIsSuccess(false);
    } finally {
      setBusy(false);
    }
  }

  if (isVerified) {
    return (
      <div className="flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50/80 p-3 text-xs text-emerald-900">
        <Icon name="check" size={16} className="text-emerald-700 shrink-0" />
        <div>
          <span className="font-semibold">Voter eligibility confirmed.</span> Your identity is approved on the voter roster. Cast your ballot below.
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    const signInUrl = `/phone-sign-in?next=${encodeURIComponent(nextPath || "/events")}`;
    const emailSignInUrl = `/email-sign-in?next=${encodeURIComponent(nextPath || "/events")}`;
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 text-xs text-amber-950 space-y-2">
        <div className="flex items-center gap-2 font-semibold">
          <Icon name="lock" size={14} className="text-amber-800" />
          <span>Sign in required to verify voter roster eligibility</span>
        </div>
        <p className="text-[11px] text-amber-900/80 leading-relaxed">
          This event restricts voting to an approved voter list. Please sign in first so your approved ballot can be verified.
        </p>
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Link
            href={signInUrl}
            className="inline-flex items-center gap-1.5 rounded-lg bg-stone-900 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-stone-800 shadow-2xs"
          >
            <Icon name="phone" size={12} />
            <span>Sign in with Phone</span>
          </Link>
          <Link
            href={emailSignInUrl}
            className="inline-flex items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-[11px] font-semibold text-stone-700 hover:bg-stone-50 shadow-2xs"
          >
            <Icon name="mail" size={12} />
            <span>Sign in with Email</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-stone-200/90 bg-stone-50/50 p-4 sm:p-5 space-y-3">
      <div className="space-y-1">
        <label
          htmlFor={`voter-identity-${eventId}`}
          className="block text-xs font-semibold text-stone-900"
        >
          Verify Approved Voter Eligibility
        </label>
        <p className="text-[11px] text-stone-500">
          Enter the registered email address or phone number submitted to the organizer.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <input
          id={`voter-identity-${eventId}`}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="voter@example.com or 0241234567"
          disabled={busy || isSuccess}
          className="flex-1 rounded-xl border border-stone-300 bg-white px-3.5 py-2 text-xs text-stone-900 placeholder:text-stone-400 focus:border-emerald-600 focus:outline-none focus:ring-3 focus:ring-emerald-600/15"
        />
        <button
          type="button"
          disabled={busy || !value.trim() || isSuccess}
          onClick={redeem}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-stone-900 px-4 py-2 text-xs font-semibold text-white shadow-2xs hover:bg-stone-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {busy ? (
            <>
              <Icon name="refresh" size={13} className="animate-spin" />
              <span>Checking…</span>
            </>
          ) : (
            <span>Verify Eligibility</span>
          )}
        </button>
      </div>

      {message && (
        <p
          className={`text-xs font-medium ${
            isSuccess ? "text-emerald-700" : "text-red-600"
          }`}
          role="status"
        >
          {message}
        </p>
      )}
    </div>
  );
}
