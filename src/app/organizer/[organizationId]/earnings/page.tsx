import { Suspense } from "react";
import { PaymentHistory,SettlementHistory } from "@/components/payments/payment-history";
import type { Metadata } from "next";
import Link from "next/link";
import { DashboardHeader } from "@/components/dashboard-header";
import { requireVerifiedUser } from "@/lib/auth/require-user";

export const metadata: Metadata = { title: "Earnings" };
const money = (amount: number) => new Intl.NumberFormat("en-GH", { style: "currency", currency: "GHS" }).format(Number(amount) / 100);

export default async function EarningsPage({ params,searchParams }: { params: Promise<{ organizationId: string }>;searchParams:Promise<{page?:string}> }) {
  const { organizationId } = await params;
  const query=await searchParams; const page=Math.max(1,Math.min(4000,Number(query.page)||1));
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
        <Suspense fallback={<p>Loading payment history…</p>}><PaymentHistory organizationId={organizationId} page={page}/><SettlementHistory organizationId={organizationId} page={page}/></Suspense>
        <nav aria-label="History pages" className="earnings-heading">{page>1&&<Link className="earnings-account-link" href={`?page=${page-1}`}>Newer records</Link>}<span>Page {page}</span><Link className="earnings-account-link" href={`?page=${page+1}`}>Older records →</Link></nav>      </>}
    </section>
  </main>;
}


