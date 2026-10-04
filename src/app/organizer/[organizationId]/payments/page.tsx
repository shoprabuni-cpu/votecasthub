import type { Metadata } from "next";
import Link from "next/link";
import { DashboardHeader } from "@/components/dashboard-header";
import { PaystackSubaccountForm } from "@/components/payments/paystack-subaccount-form";
import { AccountManagement } from "@/components/payments/account-management";
import { RefreshAccount } from "@/components/payments/refresh-account";
import { requireVerifiedUser } from "@/lib/auth/require-user";
import { paymentAdmin } from "@/lib/payments/admin";
export const metadata: Metadata = { title: "Payment account" };
export default async function PaymentsPage({ params }: { params: Promise<{ organizationId: string }> }) {
  const { organizationId } = await params;
  const { supabase, userId } = await requireVerifiedUser();
  const { data: member } = await supabase.from("organization_members").select("role").eq("organization_id", organizationId).eq("user_id", userId).maybeSingle();
  if (!member) return <main className="dashboard-page"><p>Organization access denied.</p></main>;
  const canManage = ["owner", "admin"].includes(member.role);
  const [{ data: org }, { data: account, error }, { data: operation, error: operationError }] = await Promise.all([
    supabase.from("organizations").select("name").eq("id", organizationId).maybeSingle(),
    paymentAdmin().from("organization_paystack_accounts").select("business_name,settlement_bank,account_last4,account_name,account_type,status,paystack_verified").eq("organization_id", organizationId).maybeSingle(),
    paymentAdmin().from("payment_account_operations").select("kind,created_at").eq("organization_id", organizationId).maybeSingle(),
  ]);
  return <main className="dashboard-page"><DashboardHeader organizationId={organizationId} /><section className="dashboard-content payment-account-page">
    <Link className="back-link" href={`/organizer/${organizationId}/events`}>← {org?.name ?? "Workspace"}</Link>
    <p className="eyebrow">PAYSTACK SETTLEMENT</p><h1>Payment account</h1>
    <p className="auth-description">Your bank or mobile money account receives 90% of each paid vote. Paystack charges are included in the 10% platform share.</p>
    {error || operationError ? <section className="event-editor-panel" role="alert">We could not load your saved account. Refresh this page before continuing.</section> : <>
      {operation && <section className="form-message" role="status">An account request is being synchronized with Paystack. New checkouts and further changes are paused. Refresh shortly; if this persists after a failed request, contact support to reconcile it.</section>}
      {account ? <section className="event-editor-panel">
        <div className="payment-panel-heading"><span className="payment-panel-icon" aria-hidden="true">₵</span><div><h2>{account.business_name}</h2><p>{account.status === "inactive" ? "Deactivated payment account" : account.status === "active" && account.paystack_verified ? "Verified settlement account" : "Awaiting verification"}</p></div></div>
        <dl className="saved-account-details">
          <div><dt>Registered name</dt><dd>{account.account_name || "Refresh verification to load"}</dd></div>
          <div><dt>Account type</dt><dd>{account.account_type === "mobile_money" ? "Mobile money" : "Bank account"}</dd></div>
          <div><dt>Bank or network</dt><dd>{account.settlement_bank}</dd></div>
          <div><dt>Account number</dt><dd>•••• {account.account_last4}</dd></div>
          <div><dt>Status</dt><dd>{account.status}</dd></div><div><dt>Currency</dt><dd>GHS</dd></div>
        </dl>
        {canManage && !operation && <><AccountManagement key={account.status} organizationId={organizationId} status={account.status} businessName={account.business_name} /><RefreshAccount organizationId={organizationId} /></>}
      </section> : canManage && !operation ? <section className="event-editor-panel"><h2>Your settlement account</h2><p>Add the bank or mobile money details for your event earnings.</p><PaystackSubaccountForm organizationId={organizationId} /><RefreshAccount organizationId={organizationId} /></section> : null}
      {!canManage && <p className="payment-account-note">Only organization owners and admins can manage settlement details.</p>}
    </>}
    <aside className="payment-fee-card"><div><span className="eyebrow">CLEAR PRICING</span><h2>One fee. No extra processing deduction.</h2></div><dl><div><dt>Platform share, including Paystack fees</dt><dd>10%</dd></div><div><dt>Your share</dt><dd>90%</dd></div></dl><p>For GH₵100 in paid votes, your earnings are GH₵90. Paystack charges come out of the GH₵10 platform share.</p><Link className="text-link" href={`/organizer/${organizationId}/earnings`}>View earnings →</Link></aside>
  </section></main>;
}
