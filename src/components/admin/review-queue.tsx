"use client";

import { useState } from "react";
import { Icon } from "@/components/icon";

type RequestRow = {
  id: string;
  event_name: string;
  kind: string;
  proposed_value: string;
  original_value: string;
  reason: string;
  created_at: string;
};

export function AdminReviewQueue({
  requests,
  previewUrls,
}: {
  requests: RequestRow[];
  previewUrls: Record<string, string>;
}) {
  const [items, setItems] = useState(requests);
  const [busy, setBusy] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [error, setError] = useState("");

  async function review(id: string, approve: boolean) {
    if ((notes[id] ?? "").trim().length < 20) { setError("Explain the identity and fairness checks in at least 20 characters."); return; }
    setBusy(id);
    setError("");
    try {
    const response = await fetch("/api/admin/corrections/review", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, approve, note: notes[id] }),
    });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error ?? "Unable to review this correction. Try again.");
      setItems(current => current.filter(item => item.id !== id));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to review this correction."); }
    finally { setBusy(null); }
  }

  if (!items.length) {
    return (
      <div className="rounded-2xl border border-stone-200/90 bg-white p-12 text-center shadow-xs space-y-3">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-800">
          <Icon name="check" size={20} />
        </div>
        <h2 className="text-base font-serif font-bold text-stone-900">All caught up!</h2>
        <p className="text-xs text-stone-500 max-w-sm mx-auto">
          There are currently no pending organizer correction requests awaiting review.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}
      {items.map((item) => (
        <article
          key={item.id}
          className="rounded-2xl border border-stone-200/90 bg-white p-6 shadow-xs space-y-4"
        >
          {/* Header Row */}
          <label className="block text-sm font-semibold text-stone-700">Review note (required)<textarea rows={3} minLength={20} maxLength={1000} value={notes[item.id] ?? ""} onChange={event => setNotes(previous => ({ ...previous, [item.id]: event.target.value }))} placeholder="Explain the identity and fairness checks, or why the change is rejected." className="mt-2 w-full rounded-xl border border-stone-300 p-3 text-sm font-normal" /></label>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-100 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-900 border border-amber-200">
                  {item.kind.replaceAll("_", " ")}
                </span>
                <span className="text-[11px] text-stone-400">
                  Submitted {new Date(item.created_at).toLocaleString("en-GH", { dateStyle: "medium", timeStyle: "short" })}
                </span>
              </div>
              <h2 className="text-base font-serif font-bold text-stone-900 mt-1">
                {item.event_name}
              </h2>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={busy !== null || (notes[item.id] ?? "").trim().length < 20}
                onClick={() => review(item.id, true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-900 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-800 disabled:opacity-60 transition-all cursor-pointer"
              >
                {busy === item.id ? (
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <Icon name="check" size={13} />
                )}
                <span>Approve change</span>
              </button>

              <button
                type="button"
                disabled={busy !== null || (notes[item.id] ?? "").trim().length < 20}
                onClick={() => review(item.id, false)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3.5 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50 hover:border-stone-300 disabled:opacity-60 transition-all cursor-pointer"
              >
                <Icon name="close" size={13} />
                <span>Reject</span>
              </button>
            </div>
          </div>

          {/* Photo Preview if kind is photo */}
          {item.kind === "photo" && previewUrls[item.proposed_value] && (
            <div className="flex items-center gap-4 p-3 rounded-xl bg-stone-50 border border-stone-200/80">
              <div
                className="h-20 w-20 shrink-0 rounded-xl bg-stone-200 bg-cover bg-center border border-stone-300"
                style={{ backgroundImage: `url("${previewUrls[item.proposed_value]}")` }}
                role="img"
                aria-label="Proposed nominee photo preview"
              />
              <div className="text-xs text-stone-600">
                <p className="font-semibold text-stone-900">New Nominee Artwork Uploaded</p>
                <p className="text-[11px] text-stone-500 mt-0.5">
                  Verify the image adheres to community standards before approving.
                </p>
              </div>
            </div>
          )}

          {/* Comparison Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="rounded-xl border border-stone-100 bg-stone-50/60 p-3.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 block mb-1">
                Current Public Value
              </span>
              <p className="font-mono text-stone-700 break-words leading-relaxed">
                {item.original_value || "—"}
              </p>
            </div>

            <div className="rounded-xl border border-emerald-100 bg-emerald-50/30 p-3.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 block mb-1">
                Proposed Value
              </span>
              <p className="font-mono text-emerald-950 font-medium break-words leading-relaxed">
                {item.kind === "photo" ? "Uploaded Photo (Preview Above)" : item.proposed_value || "—"}
              </p>
            </div>
          </div>

          {/* Justification note */}
          <div className="rounded-xl border border-stone-100 bg-stone-50/40 p-3 text-xs text-stone-600">
            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 block mb-0.5">
              Organizer Explanation
            </span>
            <p className="italic text-stone-700">“{item.reason}”</p>
          </div>
        </article>
      ))}
    </div>
  );
}
