"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Icon } from "@/components/icon";

async function digest(value: string) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(b))
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
}

export function AccessCodeEntry({
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
  const router = useRouter();
  const [code, setCode] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [busy, setBusy] = useState(false);

  async function redeem() {
    if (!code.trim()) return;
    setBusy(true);
    setMessage(null);
    try {
      const { data, error } = await createClient().rpc("verify_event_access_code", {
        p_event_id: eventId,
        p_code_hash: await digest(code.trim().toUpperCase()),
      });
      if (error || data?.error || data?.success !== true) {
        setMessage(error?.message || data?.error || "Invalid or expired access code.");
        setIsSuccess(false);
      } else {
        setMessage("Access code accepted! You can now cast your vote below.");
        setIsSuccess(true);
        router.refresh();
      }
    } catch {
      setMessage("Could not verify access code right now. Please try again.");
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
          <span className="font-semibold">Access code active.</span> You are verified to cast your ballot below.
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
          <span>Sign in required to redeem access code</span>
        </div>
        <p className="text-[11px] text-amber-900/80 leading-relaxed">
          This event requires a private access code. Sign in first so your voter pass can be linked to your session.
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
          htmlFor={`access-code-${eventId}`}
          className="block text-xs font-semibold text-stone-900"
        >
          Enter Event Access Code
        </label>
        <p className="text-[11px] text-stone-500">
          Enter the unique code provided by the organizer (e.g. VOTE-XXXXXXXXXX).
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <input
          id={`access-code-${eventId}`}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="VOTE-XXXXXXXXXX"
          autoComplete="one-time-code"
          disabled={busy || isSuccess}
          className="flex-1 rounded-xl border border-stone-300 bg-white px-3.5 py-2 font-mono text-xs text-stone-900 uppercase placeholder:text-stone-400 focus:border-emerald-600 focus:outline-none focus:ring-3 focus:ring-emerald-600/15"
        />
        <button
          type="button"
          disabled={busy || code.trim().length < 4 || isSuccess}
          onClick={redeem}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-stone-900 px-4 py-2 text-xs font-semibold text-white shadow-2xs hover:bg-stone-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {busy ? (
            <>
              <Icon name="refresh" size={13} className="animate-spin" />
              <span>Verifying…</span>
            </>
          ) : (
            <span>Use Access Code</span>
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
