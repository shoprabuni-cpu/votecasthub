"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Icon } from "@/components/icon";


export function VoterListRedemption({
  eventId,
  isAuthenticated = false,
  isVerified = false,
  nextPath = "",
  hasRedeemed = false,
}: {
  eventId: string;
  isAuthenticated?: boolean;
  isVerified?: boolean;
  nextPath?: string;
  hasRedeemed?: boolean;
}) {
  const router = useRouter();
  const [claimCode, setClaimCode] = useState("");
  const [identifierType, setIdentifierType] = useState("identifier");
  const [value, setValue] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [busy, setBusy] = useState(false);

  async function redeem() {
    if (!value.trim()) return;
    setBusy(true);
    setMessage(null);
    try {
      const { data, error } = await createClient().rpc("verify_event_voter_identifier", {
        p_event_id: eventId,
        p_identifier: value.trim(),
        p_identifier_type: identifierType,
        p_claim_code: identifierType === "identifier" ? claimCode.trim().toUpperCase() : null,
      });
      if (error || data?.error || data?.success !== true) {
        setMessage(error?.message || data?.error || "Your identity is not on the approved voter list.");
        setIsSuccess(false);
      } else {
        setMessage("Approved voter identity confirmed! You can now vote below.");
        setIsSuccess(true);
        router.refresh();
      }
    } catch {
      setMessage("Could not confirm voter eligibility. Please try again.");
      setIsSuccess(false);
    } finally {
      setBusy(false);
    }
  }

  if (isVerified || hasRedeemed) {
    return (
      <div className="flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50/80 p-3 text-xs text-emerald-900">
        <Icon name="check" size={16} className="text-emerald-700 shrink-0" />
        <div>
          <span className="font-semibold">Voter eligibility confirmed.</span> {isVerified ? "Your identity is approved on the voter roster. Cast your ballot below." : "Your approved voter allowance has been used. No votes remain."}
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
          Select the identifier type and enter the email, phone, index number, student ID, or other identifier supplied to the organizer.
        </p>
      </div>

      <label className="block text-xs font-semibold text-stone-700" htmlFor={`voter-type-${eventId}`}>Identifier type</label>
      <select id={`voter-type-${eventId}`} value={identifierType} disabled={busy || isSuccess} onChange={(e) => setIdentifierType(e.target.value)} className="rounded-lg border border-stone-300 bg-white p-2 text-xs">
        <option value="identifier">Index number / student ID / other identifier</option>
        <option value="email">Email address</option>
        <option value="phone">Ghana phone number</option>
      </select>
      <p className="text-xs text-stone-500">Email and phone entries require a matching verified account. Index numbers and other IDs also require the private claim code supplied by the organizer. They are linked to your verified account on first use.</p>
      {identifierType === "identifier" && (
        <div className="space-y-1">
          <label htmlFor={`voter-claim-${eventId}`} className="block text-xs font-semibold text-stone-700">Private claim code</label>
          <input id={`voter-claim-${eventId}`} value={claimCode} onChange={(e) => setClaimCode(e.target.value)} autoComplete="off" maxLength={32} disabled={busy || isSuccess} placeholder="Code provided by your organizer" className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 font-mono text-xs" />
        </div>
      )}
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          id={`voter-identity-${eventId}`}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="00123456, STU/2026/001, email, or phone"
          maxLength={320}
          disabled={busy || isSuccess}
          className="flex-1 rounded-xl border border-stone-300 bg-white px-3.5 py-2 text-xs text-stone-900 placeholder:text-stone-400 focus:border-emerald-600 focus:outline-none focus:ring-3 focus:ring-emerald-600/15"
        />
        <button
          type="button"
          disabled={busy || !value.trim() || isSuccess || (identifierType === "identifier" && !claimCode.trim())}
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
