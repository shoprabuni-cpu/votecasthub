"use client";

import { useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/icon";

type Flag = {
  id: string;
  organization_id: string;
  event_id: string | null;
  kind: string;
  severity: number;
  details: string;
  status: string;
  created_at: string;
};

export function ModerationQueue({ flags }: { flags: Flag[] }) {
  const [items, setItems] = useState(flags);
  const [busy, setBusy] = useState<string | null>(null);

  async function review(id: string, status: string) {
    setBusy(id);
    const r = await fetch("/api/admin/moderation/review", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    if (r.ok) setItems((x) => x.filter((f) => f.id !== id));
    setBusy(null);
  }

  async function moderate(id: string, status: string) {
    setBusy(id);
    const r = await fetch("/api/admin/organizations/moderation", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, status, note: `Moderation flag ${id}` }),
    });
    if (r.ok) setItems((x) => x.filter((f) => f.id !== id));
    setBusy(null);
  }

  if (!items.length) {
    return (
      <div className="rounded-2xl border border-stone-200/90 bg-white p-12 text-center shadow-xs space-y-3">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-800">
          <Icon name="shield" size={20} />
        </div>
        <h2 className="text-base font-serif font-bold text-stone-900">No open risk flags</h2>
        <p className="text-xs text-stone-500 max-w-sm mx-auto">
          The safety system has not detected any suspicious vote surges, bot activity, or payment risk flags.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {items.map((flag) => {
        const isHighSeverity = flag.severity >= 4;
        return (
          <article
            key={flag.id}
            className={`rounded-2xl border p-6 shadow-xs space-y-4 transition-all ${
              isHighSeverity ? "border-red-200 bg-red-50/20" : "border-stone-200/90 bg-white"
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-100 pb-3">
              <div className="flex items-center gap-2">
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                    isHighSeverity
                      ? "bg-red-100 text-red-900 border border-red-200"
                      : "bg-amber-100 text-amber-900 border border-amber-200"
                  }`}
                >
                  {flag.kind.replaceAll("_", " ")}
                </span>
                <span className="text-[11px] text-stone-400">
                  Severity {flag.severity}/5
                </span>
              </div>
              <time className="text-[11px] text-stone-400" dateTime={flag.created_at}>
                Raised {new Date(flag.created_at).toLocaleString("en-GH", { dateStyle: "medium", timeStyle: "short" })}
              </time>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs text-stone-400">Organization:</span>
                <Link
                  href={`/admin/organizers/${flag.organization_id}`}
                  className="font-mono text-xs font-semibold text-emerald-800 hover:underline"
                >
                  {flag.organization_id}
                </Link>
              </div>
              <p className="text-xs text-stone-800 leading-relaxed font-mono bg-stone-50/80 p-3 rounded-xl border border-stone-200/60">
                {flag.details}
              </p>
            </div>

            <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-stone-100">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={busy === flag.id}
                  onClick={() => review(flag.id, "reviewed")}
                  className="rounded-xl border border-stone-200 bg-white px-3 py-1.5 text-xs font-semibold text-stone-700 shadow-2xs hover:bg-stone-50 disabled:opacity-60 transition-all cursor-pointer"
                >
                  Mark Reviewed
                </button>
                <button
                  type="button"
                  disabled={busy === flag.id}
                  onClick={() => review(flag.id, "dismissed")}
                  className="rounded-xl border border-stone-200 bg-white px-3 py-1.5 text-xs font-semibold text-stone-500 hover:bg-stone-50 disabled:opacity-60 transition-all cursor-pointer"
                >
                  Dismiss
                </button>
              </div>

              <div className="flex items-center gap-2 ml-auto">
                <button
                  type="button"
                  disabled={busy === flag.id}
                  onClick={() => moderate(flag.organization_id, "restricted")}
                  className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-900 shadow-2xs hover:bg-amber-100 disabled:opacity-60 transition-all cursor-pointer"
                >
                  Restrict Organizer
                </button>
                <button
                  type="button"
                  disabled={busy === flag.id}
                  onClick={() => moderate(flag.organization_id, "suspended")}
                  className="rounded-xl bg-red-700 px-3.5 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-red-800 disabled:opacity-60 transition-all cursor-pointer"
                >
                  Suspend Organizer
                </button>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
