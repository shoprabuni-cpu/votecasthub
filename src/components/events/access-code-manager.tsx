"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icon";

function generateCode() {
  return `VIP-${crypto.randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase()}`;
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
  is_expired?: boolean;
};

export function AccessCodeManager({ eventId }: { eventId: string }) {
  const router = useRouter();
  const [rows, setRows] = useState<AccessCodeRow[]>([]);
  const [limit, setLimit] = useState("1");
  const [batchCount, setBatchCount] = useState<1 | 10 | 25 | 50>(1);
  const [generatedCodes, setGeneratedCodes] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await createClient()
      .from("event_access_codes")
      .select("id, max_redemptions, redemption_count, expires_at, created_at")
      .eq("event_id", eventId)
      .order("created_at", { ascending: false });
    if (error) { setMessage(error.message); return; }
    setRows((data ?? []).map((row) => ({ ...row, is_expired: Boolean(row.expires_at && Date.parse(row.expires_at) <= Date.now()) })));
  }, [eventId]);

  useEffect(() => {
    let active = true;
    void createClient()
      .from("event_access_codes")
      .select("id, max_redemptions, redemption_count, expires_at, created_at")
      .eq("event_id", eventId)
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (!active) return;
        if (error) setMessage(error.message);
        else setRows((data ?? []).map((row) => ({ ...row, is_expired: Boolean(row.expires_at && Date.parse(row.expires_at) <= Date.now()) })));
      });
    return () => { active = false; };
  }, [eventId]);

  const createBatch = async () => {
    setBusy(true);
    setCopied(false);
    setMessage("");
    const maxUses = Number(limit);
    if (!Number.isInteger(maxUses) || maxUses < 1 || maxUses > 100000) {
      setMessage("Max uses must be a whole number from 1 to 100,000.");
      setBusy(false);
      return;
    }

    const count = batchCount;
    const codes: string[] = [];
    for (let i = 0; i < count; i++) {
      codes.push(generateCode());
    }

    try {
      const client = createClient();
      for (const code of codes) {
        const hash = await digest(code);
        const { error } = await client.rpc("create_event_access_code", {
          p_event_id: eventId,
          p_code_hash: hash,
          p_max_redemptions: maxUses,
        });
        if (error) throw error;
      }

      setGeneratedCodes(codes);
      setMessage(`Successfully generated ${count} access passcode${count === 1 ? "" : "s"}!`);
      await load();
      router.refresh();
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "Could not generate codes. Please try again.";
      setMessage(errMsg);
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (id: string) => {
    if (!confirm("Revoke this access code? Voters using this code will lose access to further voting.")) return;
    setBusy(true);
    try {
      const { error } = await createClient().rpc("revoke_event_access_code", { p_code_id: id });
      if (error) {
        setMessage(error.message);
      } else {
        setMessage("Code revoked successfully.");
        await load();
        router.refresh();
      }
    } catch {
      setMessage("Could not revoke this code. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const copyCodes = async () => {
    if (!generatedCodes.length) return;
    await navigator.clipboard.writeText(generatedCodes.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadCsv = () => {
    if (!generatedCodes.length) return;
    const siteUrl = typeof window !== "undefined" ? window.location.origin : "https://votecasthub.com";
    const rows = [
      ["Passcode", "WhatsApp_Vote_Link", "Direct_Web_Link"],
      ...generatedCodes.map((code) => [
        code,
        `https://wa.me/233592992566?text=${encodeURIComponent(`VOTE CODE ${code}`)}`,
        `${siteUrl}`,
      ]),
    ];
    const csvContent = "data:text/csv;charset=utf-8," + rows.map((e) => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `vip_passcodes_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getWhatsAppShareUrl = (code: string) => {
    const text = `🎟️ Here is your VIP voting passcode: *${code}*\n\nVote on WhatsApp by sending this code to +233 59 299 2566, or enter it on our official voting page!`;
    return `https://wa.me/?text=${encodeURIComponent(text)}`;
  };

  const totalUsed = rows.reduce((sum, r) => sum + r.redemption_count, 0);
  const totalCapacity = rows.reduce((sum, r) => sum + r.max_redemptions, 0);

  return (
    <div className="rounded-2xl border border-stone-200/90 bg-white p-5 sm:p-6 shadow-xs space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-100 pb-4">
        <div>
          <h3 className="font-serif font-bold text-base text-stone-900">
            Private VIP Access Codes
          </h3>
          <p className="text-xs text-stone-500 mt-0.5">
            Generate single-use or multi-use secret passcodes and dispatch invitations to eligible voters.
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
          Generate New Passcodes
        </span>

        <div className="flex flex-wrap items-center gap-3">
          {/* Quantity Batch Selector */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-stone-700">Quantity:</span>
            <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-stone-300">
              {([1, 10, 25, 50] as const).map((qty) => (
                <button
                  key={qty}
                  type="button"
                  onClick={() => setBatchCount(qty)}
                  className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    batchCount === qty
                      ? "bg-emerald-900 text-white shadow-2xs"
                      : "text-stone-600 hover:bg-stone-100"
                  }`}
                >
                  {qty === 1 ? "1 Code" : `${qty} Codes`}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor="access-limit" className="text-xs font-semibold text-stone-700 whitespace-nowrap">
              Votes per code:
            </label>
            <input
              id="access-limit"
              type="number"
              min="1"
              max="100000"
              value={limit}
              onChange={(e) => setLimit(e.target.value)}
              className="w-16 rounded-xl border border-stone-300 bg-white px-2.5 py-1.5 text-xs font-bold text-center text-stone-900 focus:border-emerald-600 focus:outline-none"
            />
          </div>

          <button
            type="button"
            disabled={busy}
            onClick={createBatch}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-stone-900 px-4 py-2 text-xs font-bold text-white shadow-2xs hover:bg-stone-800 transition-colors disabled:opacity-50 cursor-pointer min-h-10 ml-auto"
          >
            {busy ? (
              <>
                <Icon name="refresh" size={13} className="animate-spin" />
                <span>Generating {batchCount} Codes…</span>
              </>
            ) : (
              <>
                <Icon name="plus" size={13} />
                <span>Generate {batchCount} Passcode{batchCount === 1 ? "" : "s"}</span>
              </>
            )}
          </button>
        </div>

        {/* Generated Codes Alert & Export Controls */}
        {generatedCodes.length > 0 && (
          <div className="mt-3 rounded-xl border border-emerald-300 bg-emerald-50/90 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-bold text-emerald-950">
                ✅ {generatedCodes.length} Passcode{generatedCodes.length === 1 ? "" : "s"} Ready for Distribution!
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={copyCodes}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-xs font-bold text-emerald-900 hover:bg-emerald-50 shadow-2xs cursor-pointer"
                >
                  <Icon name="copy" size={12} />
                  <span>{copied ? "Copied All!" : "Copy Codes"}</span>
                </button>
                <button
                  type="button"
                  onClick={downloadCsv}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-900 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-emerald-800 shadow-2xs cursor-pointer"
                >
                  <span>📥 Download CSV with Share Links</span>
                </button>
              </div>
            </div>

            <div className="max-h-36 overflow-y-auto font-mono text-xs text-stone-800 bg-white/80 p-3 rounded-xl border border-emerald-200 divide-y divide-emerald-100">
              {generatedCodes.map((code) => (
                <div key={code} className="py-1 flex items-center justify-between">
                  <span className="font-bold select-all">{code}</span>
                  <a
                    href={getWhatsAppShareUrl(code)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] font-bold text-emerald-800 hover:text-emerald-950 bg-emerald-100/70 hover:bg-emerald-200 px-2 py-0.5 rounded transition-colors"
                  >
                    💬 WhatsApp Invite
                  </a>
                </div>
              ))}
            </div>

            <p className="text-[11px] text-emerald-900/80">
              💡 <strong>Security Notice:</strong> Passcodes are hashed with SHA-256 for fraud prevention. Download or copy your codes now to distribute to attendees.
            </p>
          </div>
        )}
      </div>

      {message && !generatedCodes.length && (
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
          <div className="divide-y divide-stone-100 rounded-xl border border-stone-200/90 overflow-hidden max-h-80 overflow-y-auto">
            {rows.map((row) => {
              const isRevoked = row.is_expired === true;
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
                      className="text-xs font-semibold text-red-600 hover:text-red-800 hover:bg-stone-100 cursor-pointer disabled:opacity-50 border border-stone-200 bg-white shadow-2xs rounded-lg px-3 py-1.5"
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
