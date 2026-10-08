"use client";

import { useState } from "react";
import { Icon } from "@/components/icon";

const STATUS_CONFIG: Record<
  string,
  { label: string; style: string; nextOptions: { value: string; label: string; danger?: boolean }[] }
> = {
  active: {
    label: "Active",
    style: "bg-emerald-50 text-emerald-900 border-emerald-200",
    nextOptions: [
      { value: "restricted", label: "Restrict Account" },
      { value: "suspended", label: "Suspend Account", danger: true },
    ],
  },
  restricted: {
    label: "Restricted",
    style: "bg-amber-50 text-amber-900 border-amber-200",
    nextOptions: [
      { value: "active", label: "Reactivate" },
      { value: "suspended", label: "Suspend Account", danger: true },
    ],
  },
  suspended: {
    label: "Suspended",
    style: "bg-red-50 text-red-900 border-red-200",
    nextOptions: [
      { value: "active", label: "Reactivate" },
      { value: "restricted", label: "Restrict Account" },
    ],
  },
};

export function OrganizerModerationActions({
  organizationId,
  status,
}: {
  organizationId: string;
  status: string;
}) {
  const [current, setCurrent] = useState(status);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function update(next: string) {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/admin/organizations/moderation", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: organizationId,
          status: next,
          note: `Changed from profile to ${next}`,
        }),
      });
      if (r.ok) {
        setCurrent(next);
      } else {
        setError("Failed to update status. Please try again.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const config = STATUS_CONFIG[current] ?? STATUS_CONFIG.active;

  return (
    <div className="rounded-2xl border border-stone-200/90 bg-white p-5 shadow-xs space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wider text-stone-400">
          Moderation Status
        </h3>
        <span
          className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${config.style}`}
        >
          {config.label}
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        {config.nextOptions.map((opt) => (
          <button
            key={opt.value}
            disabled={busy}
            onClick={() => update(opt.value)}
            className={`inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-semibold shadow-2xs transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
              opt.danger
                ? "border-red-200 bg-red-50 text-red-800 hover:bg-red-100"
                : "border-stone-200 bg-white text-stone-700 hover:bg-stone-50"
            }`}
          >
            {busy ? (
              <Icon name="refresh" size={13} className="animate-spin" />
            ) : null}
            {opt.label}
          </button>
        ))}
      </div>

      {error && (
        <p className="text-xs text-red-600 font-medium">{error}</p>
      )}
    </div>
  );
}
