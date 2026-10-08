"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { DeletionKind, DeletionPreview } from "@/lib/admin/deletion";

export function DataDeletionControls({ kind, targetId, preview, canDelete }: {
  kind: DeletionKind; targetId: string; preview: DeletionPreview; canDelete: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(action: "request" | "cancel") {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/deletions", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, kind, targetId, confirmationName: name, reason, jobId: preview.job?.id }),
      });
      const result = await response.json();
      if (!response.ok) { setMessage(result.error ?? "Deletion could not be updated."); return; }
      if (action === "request" && result.immediate) {
        router.push("/admin/deletions");
      } else {
        setMessage(action === "cancel" ? "Deletion cancelled. The item remains closed." : "Deletion scheduled. You can cancel during the grace period.");
        setOpen(false);
      }
      router.refresh();
    } catch { setMessage("Could not update deletion. Please try again."); }
    finally { setBusy(false); }
  }

  return <section className="space-y-4 rounded-2xl border border-red-200 bg-white p-5">
    <h2 className="font-serif font-bold">Delete {kind}</h2>
    {preview.purged_at ? <p className="text-sm text-stone-600">Disposable data was purged. The remaining reference supports retained history.</p> : <>
      <p className="text-sm text-stone-600">{preview.immediate ? "This unused item is eligible for immediate deletion." : "Deletion closes this item immediately and purges eligible data after a 30-day grace period."} {preview.retained_reference ? "Financial or audit records and their minimal references will remain." : "The item will be physically deleted."}</p>
      <p className="text-xs text-stone-500">Images, voter lists, access codes, analytics, free-vote details, and disposable content will be removed. Financial records and audit logs are preserved. Export any records you need before scheduling deletion.</p>
      {canDelete && <a href={`/api/admin/deletions?kind=${kind}&targetId=${targetId}`} className="inline-block text-xs font-semibold text-emerald-800 underline">Download results snapshot (JSON)</a>}
      <dl className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">{Object.entries(preview.counts).map(([label, count]) => <div key={label} className="rounded-lg bg-stone-50 p-2"><dt className="capitalize text-stone-500">{label.replaceAll("_", " ")}</dt><dd className="font-semibold">{count}</dd></div>)}</dl>
      {preview.blocker && <p role="status" className="text-sm text-amber-900">{preview.blocker}</p>}
      {preview.job && <div className="space-y-2 rounded-xl bg-amber-50 p-3 text-xs text-amber-900"><p>Scheduled for {new Date(preview.job.scheduled_for).toLocaleString("en-GH", { timeZone: "Africa/Accra" })}. Cancellation leaves the item closed.</p>{preview.job.last_error && <p>Last attempt: {preview.job.last_error}. The maintenance job will retry.</p>}</div>}
      {preview.job && !preview.cancellable && <p className="text-xs text-stone-500">The grace period has ended. Deletion can no longer be cancelled.</p>}
      {canDelete && (!preview.job || preview.cancellable) && <button type="button" disabled={busy || (!preview.job && Boolean(preview.blocker))} onClick={() => setOpen(!open)} className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-800 disabled:opacity-40">{open ? "Hide controls" : preview.job ? "Cancel scheduled deletion…" : "Review deletion…"}</button>}
      {open && canDelete && <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void submit(preview.job ? "cancel" : "request"); }}>
        {!preview.job && <div><label htmlFor={`delete-name-${targetId}`} className="text-xs font-semibold">Type {preview.name} to confirm</label><input id={`delete-name-${targetId}`} value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" disabled={busy} className="mt-1 w-full rounded-lg border border-stone-300 p-2 text-sm" /></div>}
        <div><label htmlFor={`delete-reason-${targetId}`} className="text-xs font-semibold">{preview.job ? "Cancellation reason (at least 5 characters)" : "Deletion reason (20–1,000 characters)"}</label><textarea id={`delete-reason-${targetId}`} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={1000} rows={3} disabled={busy} className="mt-1 w-full rounded-lg border border-stone-300 p-2 text-sm" /></div>
        <button type="submit" disabled={busy || reason.trim().length < (preview.job ? 5 : 20) || (!preview.job && (name !== preview.name || Boolean(preview.blocker)))} className="rounded-lg bg-red-700 px-4 py-2 text-xs font-semibold text-white disabled:opacity-40">{busy ? "Processing…" : preview.job ? "Cancel deletion" : preview.immediate ? "Permanently delete now" : "Close and schedule deletion"}</button>
      </form>}
    </>}
    {message && <p role="status" className="text-sm text-stone-700">{message}</p>}
  </section>;
}
