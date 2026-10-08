"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type OrganizationClosureRequest = {
  id: string;
  organization_id: string;
  organization_name: string;
  reason: string;
  status: string;
  review_note: string | null;
  created_at: string;
  reviewed_at: string | null;
  blocker: string | null;
};

export function OrganizationClosureAction({ organizationId, organizationName, requestId, blocker, canClose, canReject = false }: {
  organizationId: string; organizationName: string; requestId?: string; blocker: string | null; canClose: boolean; canReject?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const prefix = requestId ?? organizationId;

  async function submit(action: "close" | "reject") {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/admin/organizations/closure", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, organizationId, requestId, confirmationName: name, note }),
      });
      const result = await response.json();
      if (!response.ok) { setMessage(result.error ?? "Review could not be completed."); return; }
      setMessage(action === "close" ? "Organization closed. Historical records retained." : "Closure request rejected.");
      setOpen(false); router.refresh();
    } catch { setMessage("Could not complete this review. Please try again."); }
    finally { setBusy(false); }
  }

  return <div className="space-y-3">
    {blocker && <p className="text-xs text-amber-900" role="status">{blocker}</p>}
    {(canClose || canReject) && <button type="button" onClick={() => setOpen(!open)} disabled={busy} className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-800">{open ? "Cancel" : requestId ? "Review closure request" : "Close organization…"}</button>}
    {open && <div className="space-y-3 rounded-xl border border-stone-200 bg-stone-50 p-4">
      <p className="text-xs text-stone-600">Closure permanently disables this workspace, voting, and organizer changes. Events, payments, votes, and audit history remain available to platform administrators. Closure cannot be undone here.</p>
      {canClose && <div className="space-y-1"><label htmlFor={`close-name-${prefix}`} className="block text-xs font-semibold">Type {organizationName} to confirm closure</label><input id={`close-name-${prefix}`} value={name} onChange={(e) => setName(e.target.value)} disabled={busy} autoComplete="off" className="w-full rounded-lg border border-stone-300 bg-white p-2 text-sm" /></div>}
      <label htmlFor={`close-note-${prefix}`} className="block text-xs font-semibold">Review reason (20–1,000 characters to close; at least 5 to reject)</label>
      <textarea id={`close-note-${prefix}`} value={note} onChange={(e) => setNote(e.target.value)} disabled={busy} maxLength={1000} rows={3} className="w-full rounded-lg border border-stone-300 bg-white p-2 text-sm" />
      <div className="flex flex-wrap gap-2">
        {canClose && <button type="button" disabled={busy || Boolean(blocker) || name !== organizationName || note.trim().length < 20} onClick={() => submit("close")} className="rounded-lg bg-red-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40">{busy ? "Processing…" : requestId ? "Approve and close organization" : "Permanently close organization"}</button>}
        {requestId && canReject && <button type="button" disabled={busy || note.trim().length < 5} onClick={() => submit("reject")} className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs font-semibold disabled:opacity-40">Reject request</button>}
      </div>
    </div>}
    {message && <p role="status" className="text-xs text-stone-700">{message}</p>}
  </div>;
}

export function OrganizationClosureQueue({ requests, role }: { requests: OrganizationClosureRequest[]; role: string }) {
  return <section className="space-y-4 rounded-2xl border border-stone-200 bg-white p-5">
    <h2 className="font-serif text-base font-bold">Organization closure requests</h2>
    {!requests.length && <p className="text-xs text-stone-500">No closure requests.</p>}
    {requests.map((request) => <article key={request.id} className="space-y-3 border-t border-stone-100 pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-semibold">{request.organization_name}</h3><span className="text-xs capitalize text-stone-600">{request.status}</span></div>
      <p className="whitespace-pre-wrap text-sm text-stone-700">{request.reason}</p>
      <p className="text-xs text-stone-500">Requested {new Date(request.created_at).toLocaleString("en-GH", { timeZone: "Africa/Accra" })}</p>
      {request.review_note && <p className="text-xs text-stone-600">Review: {request.review_note}</p>}
      {request.status === "pending" && <OrganizationClosureAction organizationId={request.organization_id} organizationName={request.organization_name} requestId={request.id} blocker={request.blocker} canClose={role === "admin"} canReject={["admin", "moderator"].includes(role)} />}
    </article>)}
  </section>;
}
