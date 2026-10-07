"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AppModal } from "@/components/ui/app-modal";
import { PaystackSubaccountForm } from "./paystack-subaccount-form";

export function AccountManagement({
  organizationId,
  status,
  businessName,
}: {
  organizationId: string;
  status: string;
  businessName: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const inactive = status === "inactive";

  async function deactivate() {
    setConfirming(false);
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/payments/paystack/subaccount", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setEditing(false);
      setMessage("Payment account deactivated. You can now configure a new settlement account.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not deactivate the account.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-stone-200 bg-stone-50/70 p-4">
        <div>
          <h4 className="text-xs font-semibold text-stone-900">
            {inactive ? "Ready for new settlement setup" : "Manage account connection"}
          </h4>
          <p className="mt-0.5 text-xs text-stone-500">
            {inactive
              ? "Paid checkouts remain paused until your replacement account is verified."
              : "Updates apply to future checkouts across all your events."}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            disabled={busy}
            onClick={() => setEditing(!editing)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-800 active:scale-95 transition-all shadow-xs"
          >
            <span>{editing ? "Cancel editing" : inactive ? "Connect new account" : "Edit details"}</span>
          </button>

          {!inactive && (
            <button
              type="button"
              disabled={busy}
              onClick={() => setConfirming(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 transition-colors"
            >
              {busy ? "Deactivating…" : "Deactivate"}
            </button>
          )}
        </div>
      </div>

      {message && (
        <div className="rounded-xl border border-stone-200 bg-white p-3 text-xs text-stone-700 shadow-2xs" role="status">
          {message}
        </div>
      )}

      {editing && (
        <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-xs space-y-4">
          <div className="border-b border-stone-100 pb-3">
            <h3 className="text-sm font-bold text-stone-900">
              {inactive ? "Connect new settlement account" : "Update settlement details"}
            </h3>
            <p className="text-xs text-stone-500">
              Submit verified bank or mobile money credentials to update your payout destination.
            </p>
          </div>
          <PaystackSubaccountForm
            organizationId={organizationId}
            mode={inactive ? "create" : "update"}
            businessName={businessName}
            onSaved={() => setEditing(false)}
          />
        </div>
      )}

      <AppModal
        open={confirming}
        title="Deactivate payment account?"
        tone="danger"
        message="This will pause new paid voter checkouts across your active events. Past payment history and audit trails remain preserved. You can reconnect a new account immediately after."
        confirmLabel="Deactivate account"
        onCancel={() => setConfirming(false)}
        onConfirm={deactivate}
      />
    </div>
  );
}
