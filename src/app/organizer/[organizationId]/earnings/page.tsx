import { Suspense } from "react";
import { PaymentHistory, SettlementHistory } from "@/components/payments/payment-history";
import type { Metadata } from "next";
import Link from "next/link";
import { DashboardHeader } from "@/components/dashboard-header";
import { requireVerifiedUser } from "@/lib/auth/require-user";
import { Icon } from "@/components/icon";

export const metadata: Metadata = { title: "Earnings ledger — VotecastHub" };

const money = (amount: number) =>
  new Intl.NumberFormat("en-GH", { style: "currency", currency: "GHS" }).format(Number(amount) / 100);

export default async function EarningsPage({
  params,
  searchParams,
}: {
  params: Promise<{ organizationId: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { organizationId } = await params;
  const query = await searchParams;
  const page = Math.max(1, Math.min(4000, Number(query.page) || 1));

  const { supabase } = await requireVerifiedUser();
  const [{ data: org }, { data, error }] = await Promise.all([
    supabase.from("organizations").select("name").eq("id", organizationId).maybeSingle(),
    supabase.rpc("get_organization_paid_earnings", { p_organization_id: organizationId }),
  ]);

  const row = data?.[0] ?? {
    gross_minor: 0,
    provider_fee_minor: 0,
    platform_fee_minor: 0,
    net_minor: 0,
    payment_count: 0,
  };

  const root = `/organizer/${organizationId}`;

  return (
    <main className="min-h-screen bg-stone-50/70 text-stone-900 antialiased selection:bg-emerald-500/20 selection:text-emerald-900">
      <DashboardHeader organizationId={organizationId} />

      <section className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
        {/* Navigation Breadcrumb */}
        <div>
          <Link
            href={`${root}/events`}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-500 hover:text-stone-800 transition-colors"
          >
            <Icon name="arrowLeft" size={14} />
            <span>{org?.name ?? "Workspace"}</span>
          </Link>
        </div>

        {/* Page Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-stone-200 pb-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-600" />
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-800">PAYMENTS & REVENUE</p>
            </div>
            <h1 className="mt-2 text-2xl font-serif font-bold tracking-tight text-stone-900 sm:text-3xl">
              Earnings & Settlement Ledger
            </h1>
            <p className="mt-1 text-xs text-stone-500">
              Complete audit of vote earnings, platform fee absorption, and automatic settlement batches.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <Link
              href={`${root}/payments`}
              className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3.5 py-2 text-xs font-semibold text-stone-700 hover:border-amber-500/30 hover:bg-amber-50/30 hover:text-amber-900 shadow-2xs transition-all"
            >
              <Icon name="coin" size={14} className="text-amber-600" />
              <span>Settlement Account Details →</span>
            </Link>
          </div>
        </div>

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-xs text-red-700 shadow-xs">
            Earnings totals could not be loaded at this time. Please refresh shortly.
          </div>
        ) : (
          <>
            {/* Net Earnings Big Hero Card */}
            <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-950 via-[#133c2e] to-emerald-950 p-6 sm:p-8 text-white shadow-sm">
              <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-emerald-300 backdrop-blur-xs">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Organizer Net Revenue (90%)
                  </div>
                  <div className="mt-4 text-4xl sm:text-5xl font-extrabold font-mono text-white tracking-tight">
                    {money(row.net_minor)}
                  </div>
                  <p className="mt-2 text-xs text-emerald-100/80 max-w-md">
                    Direct payout share credited to your designated bank or Mobile Money account.
                    Paystack fees are absorbed by the platform fee.
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/10 p-4 shrink-0 text-right md:text-left backdrop-blur-xs">
                  <div className="text-2xl font-bold font-mono text-white">
                    {Number(row.payment_count).toLocaleString("en-GH")}
                  </div>
                  <div className="text-[11px] text-emerald-200 uppercase font-semibold tracking-wider">
                    Successful Paid Checkouts
                  </div>
                </div>
              </div>

              <div className="mt-6 flex items-center justify-between border-t border-white/10 pt-4 text-[11px] text-emerald-200/70 font-mono">
                <span>Currency: GHS (Ghana Cedi)</span>
                <span>Cumulative event total</span>
              </div>
            </div>

            {/* Metrics Breakdown Grid */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-xs">
                <div className="flex items-center justify-between text-xs text-stone-500 font-medium">
                  <span>Gross Revenue</span>
                  <span className="font-mono text-stone-400">₵</span>
                </div>
                <div className="mt-2 text-2xl font-bold font-mono text-stone-900">
                  {money(row.gross_minor)}
                </div>
                <p className="mt-1.5 text-[11px] text-stone-400">
                  Total incoming voter payments before deductions
                </p>
              </div>

              <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-xs">
                <div className="flex items-center justify-between text-xs text-stone-500 font-medium">
                  <span>Paystack Gateway Cost</span>
                  <span className="text-stone-400">↗</span>
                </div>
                <div className="mt-2 text-2xl font-bold font-mono text-stone-700">
                  {money(row.provider_fee_minor)}
                </div>
                <p className="mt-1.5 text-[11px] text-stone-400">
                  Fully absorbed by platform share, not charged extra
                </p>
              </div>

              <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-xs">
                <div className="flex items-center justify-between text-xs text-stone-500 font-medium">
                  <span>Platform Share (10%)</span>
                  <span className="font-mono text-emerald-700">%</span>
                </div>
                <div className="mt-2 text-2xl font-bold font-mono text-emerald-800">
                  {money(row.platform_fee_minor)}
                </div>
                <p className="mt-1.5 text-[11px] text-stone-400">
                  Covers SMS OTP, infrastructure & processor charges
                </p>
              </div>
            </div>

            {/* Tables */}
            <Suspense
              fallback={
                <div className="rounded-2xl border border-stone-200 bg-white p-12 text-center text-xs text-stone-400 shadow-xs">
                  Loading transaction tables…
                </div>
              }
            >
              <div className="space-y-6">
                <PaymentHistory organizationId={organizationId} page={page} />
                <SettlementHistory organizationId={organizationId} page={page} />
              </div>
            </Suspense>

            {/* Pagination Controls */}
            <div className="flex items-center justify-between border-t border-stone-200 pt-6 text-xs text-stone-500">
              {page > 1 ? (
                <Link
                  href={`?page=${page - 1}`}
                  className="rounded-xl border border-stone-200 bg-white px-3.5 py-2 font-semibold text-stone-700 hover:bg-stone-50 shadow-2xs transition-colors"
                >
                  ← Newer records
                </Link>
              ) : (
                <div />
              )}

              <span className="font-mono font-medium text-stone-600">Page {page}</span>

              <Link
                href={`?page=${page + 1}`}
                className="rounded-xl border border-stone-200 bg-white px-3.5 py-2 font-semibold text-stone-700 hover:bg-stone-50 shadow-2xs transition-colors"
              >
                Older records →
              </Link>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
