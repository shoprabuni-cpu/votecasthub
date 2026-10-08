"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Icon } from "@/components/icon";

function generateCode() {
  return `VOTE-${crypto.randomUUID().replaceAll("-", "").slice(0, 10).toUpperCase()}`;
}

async function digest(v: string) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(v));
  return Array.from(new Uint8Array(b))
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
}

type AccessCodeRow = {
  id: string;
  max_redemptions: number;
  redemption_count: number;
  expires_at: string | null;
  created_at?: string;
};

export function AccessCodeManager({ eventId }: { eventId: string }) {
  const [rows, setRows] = useState<AccessCodeRow[]>([]);
  const [limit, setLimit] = useState("1");
  const [newCode, setNewCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data } = await createClient()
      .from("event_access_codes")
      .select("id, max_redemptions, redemption_count, expires_at, created_at")
      .eq("event_id", eventId)
      .order("created_at", { ascending: false });
    setRows(data ?? []);
  };

  useEffect(() => {
    load();
  }, [eventId]);

  const create = async () => {
    setBusy(true);
    setCopied(false);
    const value = generateCode();
    try {
      const { error } = await createClient().from("event_access_codes").insert({
        event_id: eventId,
        code_hash: await digest(value),
        max_redemptions: Math.max(1, Number(limit) || 1),
      });
      if (error) {
        setNewCode("");
        setMessage("Could not generate access code. Please try again.");
      } else {
        setNewCode(value);
        setMessage("Copy this code now to share with your voter. It will not be shown again.");
        load();
      }
    } catch {
      setMessage("An unexpected error occurred.");
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (id: string) => {
    if (!confirm("Revoke this access code? Any voter who hasn't redeemed it will be locked out.")) return;
    setBusy(true);
    try {
      const { error } = await createClient().rpc("revoke_event_access_code", { p_code_id: id });
      if (error) {
        setMessage(error.message);
      } else {
        setMessage("Code revoked successfully.");
        load();
      }
    } finally {
      setBusy(false);
    }
  };

  const copyCode = async () => {
    if (!newCode) return;
    await navigator.clipboard.writeText(newCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const totalUsed = rows.reduce((sum, r) => sum + r.redemption_count, 0);
  const totalCapacity = rows.reduce((sum, r) => sum + r.max_redemptions, 0);

  return (
    <div className="rounded-2xl border border-stone-200/90 bg-white p-5 sm:p-6 shadow-xs space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-100 pb-4">
        <div>
          <h3 className="font-serif font-bold text-base text-stone-900">
            Private Access Codes
          </h3>
          <p className="text-xs text-stone-500 mt-0.5">
            Generate single or multi-use secret passcodes for eligible voters.
          </p>
        </div>
        {rows.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-stone-100 px-3 py-1 text-[11px] font-semibold text-stone-700">
              {rows.length} {rows.length === 1 ? "Code" : "Codes"} &middot; {totalUsed}/{totalCapacity} redeemed
            </span>
          </div>
        )}
      </div>

      {/* Code Generator Form */}
      <div className="rounded-xl border border-stone-200/80 bg-stone-50/60 p-4 space-y-3">
        <span className="text-[11px] font-bold uppercase tracking-wider text-stone-400 block">
          Generate New Passcode
        </span>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="flex items-center gap-2">
            <label htmlFor="access-limit" className="text-xs font-semibold text-stone-700 whitespace-nowrap">
              Max uses:
            </label>
            <input
              id="access-limit"
              type="number"
              min="1"
              max="100000"
              value={limit}
              onChange={(e) => setLimit(e.target.value)}
              className="w-20 rounded-xl border border-stone-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-stone-900 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
            />
          </div>

          <button
            type="button"
            disabled={busy}
            onClick={create}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-stone-900 px-4 py-2 text-xs font-semibold text-white shadow-2xs hover:bg-stone-800 transition-colors disabled:opacity-50 cursor-pointer"
          >
            {busy ? (
              <>
                <Icon name="refresh" size={13} className="animate-spin" />
                <span>Generating…</span>
              </>
            ) : (
              <>
                <Icon name="plus" size={13} />
                <span>Create Passcode</span>
              </>
            )}
          </button>
        </div>

        {/* Generated Code Reveal Alert */}
        {newCode && (
          <div className="mt-3 rounded-xl border border-emerald-300 bg-emerald-50/90 p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
                New Passcode Created
              </span>
              <button
                type="button"
                onClick={copyCode}
                className="inline-flex items-center gap-1 rounded-lg bg-emerald-700 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-emerald-800 shadow-2xs cursor-pointer"
              >
                <Icon name="copy" size={12} />
                <span>{copied ? "Copied!" : "Copy Code"}</span>
              </button>
            </div>
            <div className="font-mono text-sm sm:text-base font-bold tracking-wider text-emerald-950 select-all bg-white/70 py-1.5 px-3 rounded-lg border border-emerald-200 inline-block">
              {newCode}
            </div>
            <p className="text-[11px] text-emerald-900/80">
              ⚠️ Copy this code now. For security, only the cryptographic hash is stored and this plain code cannot be recovered later.
            </p>
          </div>
        )}
      </div>

      {message && !newCode && (
        <p className="text-xs text-stone-600 font-medium" role="status">
          {message}
        </p>
      )}

      {/* Code Roster List */}
      <div className="space-y-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-stone-400 block">
          Existing Code Passes ({rows.length})
        </span>

        {rows.length > 0 ? (
          <div className="divide-y divide-stone-100 rounded-xl border border-stone-200/90 overflow-hidden">
            {rows.map((row) => {
              const isRevoked = Boolean(row.expires_at);
              const isFullyUsed = row.redemption_count >= row.max_redemptions;
              return (
                <div
                  key={row.id}
                  className="flex items-center justify-between p-3.5 hover:bg-stone-50/60 transition-colors text-xs"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                        isRevoked
                          ? "bg-red-50 text-red-700 border border-red-200"
                          : isFullyUsed
                          ? "bg-stone-100 text-stone-600 border border-stone-200"
                          : "bg-emerald-50 text-emerald-800 border border-emerald-200"
                      }`}
                    >
                      {isRevoked ? "Revoked" : isFullyUsed ? "Exhausted" : "Active"}
                    </span>
                    <span className="font-mono text-stone-700 font-semibold">
                      {row.redemption_count} / {row.max_redemptions} used
                    </span>
                  </div>

                  {!isRevoked && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => revoke(row.id)}
                      className="text-[11px] font-semibold text-red-600 hover:text-red-800 hover:underline cursor-pointer disabled:opacity-50"
                    >
                      Revoke Pass
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-stone-400 italic py-2">
            No access codes created yet for this event.
          </p>
        )}
      </div>
    </div>
  );
}
