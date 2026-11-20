"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AppModal } from "@/components/ui/app-modal";
import { Icon } from "@/components/icon";

export function AdminEventActionBar({
  eventId,
  currentStatus,
  eventSlug,
}: {
  eventId: string;
  currentStatus: string;
  eventSlug?: string | null;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(currentStatus);
  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<{ text: string; kind: "error" | "success" } | null>(null);

  async function executeAction(action: "approve" | "reject" | "status", body: Record<string, any>, nextStatus: string) {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/events/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: eventId, ...body }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error ?? "Failed to perform admin moderation action.");
      }
      setStatus(nextStatus);
      setMessage({ text: `Event status updated to ${nextStatus.replace("_", " ")}.`, kind: "success" });
      router.refresh();
      return true;
    } catch (err) {
      setMessage({
        text: err instanceof Error ? err.message : "Moderation action failed. Please try again.",
        kind: "error",
      });
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function handleApprove() {
    await executeAction("approve", {}, "published");
  }

  async function handlePause() {
    await executeAction("status", { status: "paused" }, "paused");
  }

  async function handleResume() {
    await executeAction("status", { status: "published" }, "published");
  }

  async function handleClose() {
    const ok = window.confirm("Are you sure you want to close this event? Voting will stop permanently.");
    if (!ok) return;
    await executeAction("status", { status: "closed" }, "closed");
  }

  async function handleRejectSubmit() {
    if (reason.trim().length < 5) {
      setMessage({ text: "Please enter a specific reason (at least 5 characters).", kind: "error" });
      return;
    }
    const success = await executeAction("reject", { reason }, "draft");
    if (success) {
      setRejecting(false);
      setReason("");
    }
  }

  const publicUrl = eventSlug ? `/events/${eventSlug}` : "/events";

  return (
    <div className="space-y-3">
      {message && (
        <div
          className={`rounded-xl p-3 text-xs font-semibold border ${
            message.kind === "error"
              ? "bg-rose-50 text-rose-900 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900/50"
              : "bg-emerald-50 text-emerald-900 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/50"
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2.5">
        {/* Direct Link to Live Event Ballot */}
        <a
          href={publicUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3.5 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50 shadow-2xs transition-colors dark:border-[#1c2721] dark:bg-[#0c120e] dark:text-stone-300 dark:hover:bg-[#141d18]"
        >
          <Icon name="eye" size={14} />
          <span>View Public Ballot ↗</span>
        </a>

        {/* Action: Approve if Pending Review */}
        {status === "pending_review" && (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={handleApprove}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-800 hover:bg-emerald-700 px-4 py-2 text-xs font-bold text-white shadow-xs transition-all disabled:opacity-50 cursor-pointer"
            >
              <span>{busy ? "Approving…" : "✓ Approve Event"}</span>
            </button>

            <button
              type="button"
              disabled={busy}
              onClick={() => setRejecting(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 px-3.5 py-2 text-xs font-bold text-amber-900 shadow-2xs transition-colors disabled:opacity-50 cursor-pointer dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200"
            >
              <span>✕ Request Changes</span>
            </button>
          </>
        )}

        {/* Action: Pause / Resume if Live */}
        {status === "published" && (
          <button
            type="button"
            disabled={busy}
            onClick={handlePause}
            className="inline-flex items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 px-3.5 py-2 text-xs font-bold text-amber-900 shadow-2xs transition-colors disabled:opacity-50 cursor-pointer dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200"
          >
            <span>{busy ? "Updating…" : "⏸ Pause Voting"}</span>
          </button>
        )}

        {status === "paused" && (
          <button
            type="button"
            disabled={busy}
            onClick={handleResume}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-800 hover:bg-emerald-700 px-4 py-2 text-xs font-bold text-white shadow-xs transition-all disabled:opacity-50 cursor-pointer"
          >
            <span>{busy ? "Updating…" : "▶ Resume Voting"}</span>
          </button>
        )}

        {/* Action: Close Event if Published or Paused */}
        {(status === "published" || status === "paused") && (
          <button
            type="button"
            disabled={busy}
            onClick={handleClose}
            className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 px-3 py-2 text-xs font-semibold text-stone-600 transition-colors disabled:opacity-50 cursor-pointer dark:border-[#1c2721] dark:bg-[#0c120e] dark:text-stone-400"
          >
            <span>⏹ Close Event</span>
          </button>
        )}
      </div>

      {/* Reject / Request Changes Modal */}
      <AppModal
        open={rejecting}
        title="Request Changes / Return Submission"
        message="Explain to the event organizer what needs adjustment (e.g. spelling error, missing nominee info, ticket price discrepancy) before this event can be approved."
        tone="danger"
        confirmLabel={busy ? "Sending…" : "Send Feedback & Return"}
        cancelLabel="Cancel"
        busy={busy}
        onCancel={() => setRejecting(false)}
        onConfirm={handleRejectSubmit}
      >
        <div className="space-y-4 pt-2">
          <div>
            <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
              Feedback / Rejection Reason
            </label>
            <textarea
              rows={4}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Provide clear guidance for the organizer (minimum 5 characters)..."
              className="w-full rounded-xl border border-stone-300 p-3 text-xs text-stone-900 focus:border-amber-500 focus:outline-none dark:border-[#2a3830] dark:bg-[#121914] dark:text-stone-100"
            />
          </div>
        </div>
      </AppModal>
    </div>
  );
}
