"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function ClosureRequestForm({ organizationId }: { organizationId: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setMessage("");
    const { error } = await createClient().rpc("request_organization_closure", {
      p_organization_id: organizationId,
      p_reason: reason,
    });
    setMessage(error?.message ?? "Closure request submitted for platform review.");
    if (!error) setReason("");
    setBusy(false);
  }

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-xs">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-stone-900">Danger Zone</h3>
          <p className="mt-0.5 text-xs text-stone-500">
            Request platform review to decommission or close this organization.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 transition-colors self-start sm:self-auto"
        >
          {isOpen ? "Cancel" : "Close organization…"}
        </button>
      </div>

      {isOpen && (
        <div className="mt-6 border-t border-stone-100 pt-6 space-y-4">
          <p className="text-xs text-stone-600 leading-relaxed">
            Events, past voting audits, transactions, and SMS records are permanently preserved for compliance.
            Please explain why this workspace should be deactivated:
          </p>

          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            minLength={20}
            maxLength={1000}
            rows={3}
            placeholder="Explain the reason for closure (minimum 20 characters)…"
            className="w-full rounded-xl border border-stone-200 bg-stone-50 p-3.5 text-xs text-stone-900 placeholder:text-stone-400 focus:border-red-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-red-500 transition-all resize-none shadow-2xs"
          />

          <div className="flex items-center justify-between">
            <span className="text-[11px] text-stone-400 font-mono">
              {reason.length}/1000 characters (min 20)
            </span>
            <button
              type="button"
              disabled={busy || reason.trim().length < 20}
              onClick={submit}
              className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-40 disabled:pointer-events-none transition-all shadow-xs"
            >
              {busy ? "Submitting…" : "Confirm closure request"}
            </button>
          </div>

          {message && (
            <p className="rounded-xl border border-stone-200 bg-stone-50 p-3 text-xs text-stone-700" role="status">
              {message}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
