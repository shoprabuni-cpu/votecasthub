import type { Metadata } from "next";
import Link from "next/link";
import { DashboardHeader } from "@/components/dashboard-header";
import { requireVerifiedUser } from "@/lib/auth/require-user";
import { PaystackCreditButton } from "@/components/payments/paystack-credit-button";

export const metadata: Metadata = { title: "SMS credits" };
type Props = { params: Promise<{ organizationId: string }> };

export default async function CreditsPage({ params }: Props) {
  const { organizationId } = await params;
  const { supabase } = await requireVerifiedUser();
  const [{ data: organization }, { data: creditBalance }] = await Promise.all([supabase.from("organizations").select("name").eq("id", organizationId).maybeSingle(), supabase.from("organization_sms_credits").select("balance").eq("organization_id", organizationId).maybeSingle()]);
  const balance = creditBalance?.balance ?? 0;
  return <main className="dashboard-page"><DashboardHeader organizationId={organizationId} /><section className="dashboard-content credits-page">
    <Link className="back-link" href={`/organizer/${organizationId}/events`}>← {organization?.name ?? "Workspace"}</Link>
    <div className="credits-hero"><div><p className="eyebrow"><span className="status-dot"/> VOTER VERIFICATION</p><h1>SMS credits for<br /><em>free voting.</em></h1><p className="auth-description">Voters never pay for a free event. Your credits cover the one-time phone verification that keeps voting fair and accountable.</p></div><div className="credits-orbit" aria-hidden="true"><span>SMS</span><strong>✦</strong></div></div>
    <section className="credits-balance-card"><div><span className="eyebrow">AVAILABLE BALANCE</span><strong>{balance.toLocaleString()} <small>credits</small></strong><p>Top up before publishing a free-voting event.</p></div><div className="credits-balance-meter"><span style={{ width: `${Math.min(100, balance / 10)}%` }} /></div><small className="credits-balance-note">One credit covers one accepted voter verification SMS.</small></section>
    <div className="dashboard-section-heading credits-heading"><div><p className="eyebrow">CHOOSE YOUR COVERAGE</p><h2>Simple packages</h2></div><span className="dashboard-count">Prices shown before payment</span></div>
    <section className="credit-packages" aria-label="SMS credit packages">
      {[{ name: "Starter", count: "100", price: "GH₵20", note: "For a small community event", mark: "01" }, { name: "Growth", count: "500", price: "GH₵80", note: "For a growing awards event", mark: "02", featured: true }, { name: "Event", count: "1,000", price: "GH₵150", note: "For a high-reach public event", mark: "03" }].map((pkg) => <article className={`credit-package ${pkg.featured ? "is-featured" : ""}`} key={pkg.name}><span className="credit-package-mark">{pkg.mark}</span><p className="eyebrow">{pkg.name}</p><h3>{pkg.count}<small> SMS credits</small></h3><strong className="credit-package-price">{pkg.price}</strong><p>{pkg.note}</p><PaystackCreditButton organizationId={organizationId} credits={Number(pkg.count.replace(",", ""))} /></article>)}
    </section>
    <section className="no-sms-card"><span className="no-sms-card-icon">₵</span><div><p className="eyebrow">DO NOT NEED SMS?</p><h2>Choose paid voting instead.</h2><p>Paid events use checkout for every vote and do not require voter phone verification. Connect your Paystack payment account before publishing.</p></div><Link className="text-link" href={`/organizer/${organizationId}/payments`}>Set up payments →</Link></section>
  </section></main>;
}
