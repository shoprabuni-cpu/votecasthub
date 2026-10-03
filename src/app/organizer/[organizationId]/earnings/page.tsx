import type { Metadata } from "next";
import Link from "next/link";
import { DashboardHeader } from "@/components/dashboard-header";
import { requireVerifiedUser } from "@/lib/auth/require-user";

export const metadata: Metadata = { title: "Earnings" };
const money = (amount: number) => new Intl.NumberFormat("en-GH", { style: "currency", currency: "GHS" }).format(Number(amount) / 100);

export default async function EarningsPage({ params }: { params: Promise<{ organizationId: string }> }) {
  const { organizationId } = await params;
  const { supabase } = await requireVerifiedUser();
  const { data, error } = await supabase.rpc("get_organization_paid_earnings", { p_organization_id: organizationId });
  const row = data?.[0] ?? { gross_minor: 0, provider_fee_minor: 0, platform_fee_minor: 0, net_minor: 0, payment_count: 0 };
  const root = `/organizer/${organizationId}`;
  return <main className="dashboard-page">
    <DashboardHeader organizationId={organizationId} />
    <section className="dashboard-content earnings-page">
      <Link className="back-link" href={`${root}/events`}>← Workspace</Link>
      <div className="earnings-heading"><div><p className="eyebrow">PAYMENTS &amp; REVENUE</p><h1>Your event earnings.</h1><p>See what your votes earned and where the fees went.</p></div><Link className="earnings-account-link" href={`${root}/payments`}>Payment account <span aria-hidden="true">↗</span></Link></div>
      {error ? <section className="earnings-history" role="alert"><h2>Earnings are temporarily unavailable</h2><p>We couldn’t load your payment totals. Please refresh and try again.</p></section> : <>
        <section className="earnings-net-card" aria-label="Organizer net earnings"><div><p className="eyebrow">ORGANIZER NET EARNINGS</p><strong>{money(row.net_minor)}</strong><p>Your 90% share. Paystack charges are covered by the 10% platform fee.</p></div><div className="earnings-payment-count"><span aria-hidden="true">↗</span><strong>{Number(row.payment_count).toLocaleString("en-GH")}</strong><small>Successful payments</small></div><div className="earnings-net-footer"><span>GHS · Ghana cedi</span><span>Earnings total · not a bank balance</span></div></section>
        <section className="earnings-metrics" aria-label="Revenue breakdown">{[
          { label: "Gross revenue", value: row.gross_minor, icon: "₵", note: "Paid votes before deductions" },
          { label: "Paystack fees", value: row.provider_fee_minor, icon: "↗", note: "Included in platform fee, not extra" },
          { label: "Platform fee", value: row.platform_fee_minor, icon: "%", note: "10% total, including Paystack fees" },
        ].map(metric => <article className="earnings-metric" key={metric.label}><div><span>{metric.label}</span><span className="earnings-metric-icon" aria-hidden="true">{metric.icon}</span></div><strong>{money(metric.value)}</strong><p>{metric.note}</p></article>)}</section>
        <section className="earnings-history"><div className="earnings-history-heading"><div><p className="eyebrow">PAYMENT ACTIVITY</p><h2>Settlement overview</h2></div><span className="earnings-count-badge">{Number(row.payment_count).toLocaleString("en-GH")} payments</span></div><div className="earnings-empty"><span className="earnings-empty-icon" aria-hidden="true">₵</span><h3>{Number(row.payment_count) === 0 ? "Your earnings start with the first vote." : "Your paid voting revenue is recorded."}</h3><p>{Number(row.payment_count) === 0 ? "Once a paid vote is confirmed, its revenue and fees will appear here." : "The totals above reflect recorded payments. Individual settlement dates and bank payout status are not yet available here."}</p><Link className="earnings-account-link" href={`${root}/${Number(row.payment_count) === 0 ? "events" : "payments"}`}>{Number(row.payment_count) === 0 ? "Manage your events" : "View payment account"} <span aria-hidden="true">→</span></Link></div><p className="earnings-settlement-note">Paystack handles settlement to your approved account. Recorded earnings do not confirm that funds have reached your bank or mobile money wallet.</p></section>
      </>}
    </section>
  </main>;
}

