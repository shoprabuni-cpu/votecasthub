"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { AppModal } from "@/components/ui/app-modal";
import { PaystackSubaccountForm } from "./paystack-subaccount-form";

export function AccountManagement({ organizationId, status, businessName }: { organizationId: string; status: string; businessName: string }) {
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
        method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ organizationId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setEditing(false);
      setMessage("Payment account deactivated. You can now create a new account.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not deactivate the account.");
    } finally { setBusy(false); }
  }
  return <div className="account-management">
    <div className="account-management-notice"><strong>{inactive ? "Ready for a new payment account" : "One account. All your paid events."}</strong><p>{inactive ? "Paid checkout is unavailable until your new account is verified. Your previous payment history is preserved." : "Changes apply to future checkouts across your events. Pending payments must be resolved before changing settlement details."}</p></div>
    <div className="account-management-actions">
      <button className="primary-link" type="button" disabled={busy} onClick={() => setEditing(!editing)}>{editing ? "Cancel editing" : inactive ? "Create new payment account" : "Update payment account"}</button>
      {!inactive && <button className="secondary-button account-deactivate" type="button" disabled={busy} onClick={() => setConfirming(true)}>{busy ? "Deactivating…" : "Deactivate account"}</button>}
    </div>
    {message && <p className="form-message" role="status">{message}</p>}
    {editing && <section className="account-edit-panel"><h3>{inactive ? "New settlement account" : "Update settlement details"}</h3><p>Enter and verify the complete bank or mobile money details below.</p><PaystackSubaccountForm organizationId={organizationId} mode={inactive ? "create" : "update"} businessName={businessName} onSaved={() => setEditing(false)} /></section>}
    <AppModal open={confirming} title="Deactivate payment account?" tone="danger" message="This will stop new paid checkouts for all your events. After deactivation is confirmed, you can create a new account. Existing payment records will be kept." confirmLabel="Deactivate account" onCancel={() => setConfirming(false)} onConfirm={deactivate} />
  </div>;
}
