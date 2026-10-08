import type { Metadata } from "next";
import Link from "next/link";
import { DashboardHeader } from "@/components/dashboard-header";
import { requireVerifiedUser } from "@/lib/auth/require-user";
import { PaystackCreditButton } from "@/components/payments/paystack-credit-button";
import { Icon } from "@/components/icon";

export const metadata: Metadata = { title: "SMS credits" };
type Props = { params: Promise<{ organizationId: string }> };

export default async function CreditsPage({ params }: Props) {
  const { organizationId } = await params;
  const { supabase } = await requireVerifiedUser();

  const [
    { data: organization },
    { data: rpcBalance, error: balanceError },
    { data: purchases, error: purchaseError },
    { count: usageCount, error: usageError },
  ] = await Promise.all([
    supabase.from("organizations").select("name").eq("id", organizationId).maybeSingle(),
    supabase.rpc("get_organization_sms_balance", { p_org: organizationId }),
    supabase
      .from("sms_credit_purchases")
      .select("reference,credits,amount_minor,status,refunded_amount_minor,created_at")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(25),
    supabase
      .from("sms_credit_usage")
      .select("request_hash", { count: "exact", head: true })
      .eq("organization_id", organizationId),
  ]);

  const balance = Number(rpcBalance ?? 0);
  const creditUnavailable = Boolean(balanceError && balanceError.code !== "PGRST116");

  const packages = [
    {
      name: "Starter",
      count: 100,
      displayCount: "100",
      priceGhs: "5.00",
      perVoter: "GH₵ 0.05",
      note: "Perfect for testing ballots or small department polls.",
      featured: false,
      tag: "Test & Launch",
    },
    {
      name: "Growth",
      count: 500,
      displayCount: "500",
      priceGhs: "80.00",
      perVoter: "GH₵ 0.16",
      note: "Designed for school faculty awards or club elections.",
      featured: true,
      tag: "Most Popular",
    },
    {
      name: "Event Scale",
      count: 1000,
      displayCount: "1,000",
      priceGhs: "150.00",
      perVoter: "GH₵ 0.15",
      note: "Built for campus-wide or high-reach public award ceremonies.",
      featured: false,
      tag: "High Volume",
    },
  ];

  return (
    <main className="min-h-screen bg-stone-50/70 text-stone-900 antialiased selection:bg-emerald-500/20 selection:text-emerald-900 pb-20">
      <DashboardHeader organizationId={organizationId} />

      <section className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
        {/* Navigation Breadcrumb */}
        <div>
          <Link
            href={`/organizer/${organizationId}/events`}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-500 hover:text-stone-800 transition-colors"
          >
            <Icon name="arrowLeft" size={14} />
            <span>{organization?.name ?? "Back to workspace"}</span>
          </Link>
        </div>

        {/* Hero Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-stone-200 pb-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-600" />
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-800">
                VOTER VERIFICATION
              </p>
            </div>
            <h1 className="mt-2 text-2xl font-serif font-bold tracking-tight text-stone-900 sm:text-3xl">
              SMS Credits & Coverage
            </h1>
            <p className="mt-1 text-xs text-stone-500 max-w-xl">
              Voters never pay for free elections. SMS credits power one-time phone passcodes to
              guarantee one-vote-per-person ballot fairness across Ghana.
            </p>
          </div>
        </div>

        {/* Balance & Overview Card */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Main Balance */}
          <div className="md:col-span-2 rounded-2xl border border-stone-200/90 bg-white p-6 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
                  Current Balance
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800 border border-emerald-100">
                  <Icon name="phone" size={11} />
                  <span>SMS Network Active</span>
                </span>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-4xl font-serif font-bold text-stone-900 tracking-tight">
                  {creditUnavailable ? "Unavailable" : Math.max(0, balance).toLocaleString()}
                </span>
                <span className="text-sm font-medium text-stone-500">credits</span>
              </div>
              <p className="mt-2 text-xs text-stone-500 leading-relaxed">
                {creditUnavailable
                  ? "We could not load the balance right now. Please refresh the page."
                  : balance === 0
                  ? "You have zero credits remaining. Top up below before running free voter verification."
                  : "Credits are deducted automatically as Ghanaian voters request SMS verification codes."}
              </p>
            </div>

            {/* Meter Bar */}
            <div className="mt-5 pt-4 border-t border-stone-100">
              <div className="flex items-center justify-between text-[11px] text-stone-400 mb-1.5 font-medium">
                <span>Coverage Gauge</span>
                <span>{balance > 0 ? "Ready for voting" : "Needs top-up"}</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-stone-100">
                <div
                  className="h-full rounded-full bg-emerald-700 transition-all duration-500"
                  style={{ width: `${Math.max(0, Math.min(100, (balance / 500) * 100))}%` }}
                />
              </div>
            </div>
          </div>

          {/* Usage Stats Box */}
          <div className="rounded-2xl border border-stone-200/90 bg-gradient-to-br from-stone-50 to-white p-6 shadow-xs flex flex-col justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
                All-Time Usage
              </span>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl font-serif font-bold text-stone-900">
                  {usageError ? "—" : (usageCount ?? 0).toLocaleString()}
                </span>
                <span className="text-xs text-stone-500">attempts</span>
              </div>
              <p className="mt-2 text-xs text-stone-500 leading-relaxed">
                Total SMS verification messages successfully processed for your ballots.
              </p>
            </div>

            <div className="mt-4 pt-3 border-t border-stone-200/70 text-[11px] text-stone-500 flex items-center gap-1.5">
              <span className="text-emerald-700 font-bold">✦</span>
              <span>1 credit = 1 SMS send attempt</span>
            </div>
          </div>
        </div>

        {/* Deficit Alert if any */}
        {balance < 0 && (
          <div
            role="status"
            className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4 text-xs text-amber-900 shadow-2xs flex items-start gap-3"
          >
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-amber-200 text-amber-900 font-bold">
              <Icon name="alert" size={14} />
            </div>
            <div>
              <strong className="font-semibold text-amber-950">Outstanding Credit Deficit</strong>
              <p className="mt-0.5 leading-relaxed text-amber-800">
                A refunded transaction included {Math.abs(balance)} credits that were already used.
                Your next credit top-up will first clear this deficit.
              </p>
            </div>
          </div>
        )}

        {/* Packages Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
                PURCHASE PACKAGES
              </p>
              <h2 className="text-lg font-serif font-bold text-stone-900">Choose your coverage</h2>
            </div>
            <span className="text-xs text-stone-400">Instant MTN MoMo, Telecel & Cards via Paystack</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {packages.map((pkg) => (
              <div
                key={pkg.name}
                className={`relative rounded-2xl border p-6 transition-all duration-200 flex flex-col justify-between ${
                  pkg.featured
                    ? "border-emerald-800 bg-white shadow-md ring-1 ring-emerald-800/20"
                    : "border-stone-200/90 bg-white hover:border-stone-300 shadow-xs"
                }`}
              >
                {pkg.featured && (
                  <span className="absolute -top-2.5 right-4 rounded-full bg-emerald-800 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white shadow-2xs">
                    {pkg.tag}
                  </span>
                )}

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider">
                      {pkg.name}
                    </span>
                    {!pkg.featured && (
                      <span className="text-[10px] text-stone-400 font-medium">{pkg.tag}</span>
                    )}
                  </div>

                  <div className="flex items-baseline gap-1 my-2">
                    <span className="text-3xl font-serif font-bold text-stone-900 tracking-tight">
                      {pkg.displayCount}
                    </span>
                    <span className="text-xs font-semibold text-stone-500">credits</span>
                  </div>

                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-lg font-bold text-emerald-900">GH₵ {pkg.priceGhs}</span>
                    <span className="text-[11px] text-stone-400">· {pkg.perVoter} / voter</span>
                  </div>

                  <p className="text-xs text-stone-500 leading-relaxed min-h-[36px]">{pkg.note}</p>
                </div>

                <div className="mt-6 pt-4 border-t border-stone-100">
                  <PaystackCreditButton
                    organizationId={organizationId}
                    credits={pkg.count}
                    featured={pkg.featured}
                    label={`Buy ${pkg.displayCount} Credits (GH₵ ${pkg.priceGhs})`}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Transaction History Table */}
        <div className="rounded-2xl border border-stone-200/90 bg-white shadow-xs overflow-hidden">
          <div className="border-b border-stone-100 p-5 sm:px-6 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400">LEDGER</p>
              <h2 className="text-base font-serif font-bold text-stone-900">Purchase Activity</h2>
            </div>
            <span className="text-xs text-stone-500">Last 25 transactions</span>
          </div>

          {purchaseError ? (
            <div className="p-8 text-center text-xs text-red-600 font-medium">
              We could not load purchase history. Please refresh and try again.
            </div>
          ) : purchases?.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-stone-100 bg-stone-50/60 text-[11px] font-semibold text-stone-500">
                    <th className="py-3 px-4 sm:px-6">Reference</th>
                    <th className="py-3 px-4">Credits</th>
                    <th className="py-3 px-4">Amount Paid</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 sm:px-6">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {purchases.map((p) => (
                    <tr key={p.reference} className="hover:bg-stone-50/50 transition-colors">
                      <td className="py-3.5 px-4 sm:px-6 font-mono text-[11px] font-medium text-stone-800">
                        {p.reference}
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-stone-900">
                        +{p.credits.toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 font-medium text-stone-700">
                        GH₵ {(p.amount_minor / 100).toFixed(2)}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                            p.status === "paid" || p.status === "completed"
                              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                              : p.status === "pending"
                              ? "bg-amber-50 text-amber-800 border border-amber-200"
                              : "bg-red-50 text-red-700 border border-red-200"
                          }`}
                        >
                          {p.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 sm:px-6 text-stone-500">
                        {new Date(p.created_at).toLocaleDateString("en-GH", {
                          dateStyle: "medium",
                          timeZone: "Africa/Accra",
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-10 text-center space-y-2">
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-stone-100 text-stone-400">
                <Icon name="phone" size={18} />
              </div>
              <p className="text-xs font-semibold text-stone-700">No credit purchases yet</p>
              <p className="text-xs text-stone-400 max-w-sm mx-auto">
                Select any package above to add voter verification coverage to your organization.
              </p>
            </div>
          )}
        </div>

        {/* Paid Voting Callout */}
        <div className="rounded-2xl border border-stone-200/90 bg-gradient-to-br from-stone-50 to-white p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-900 font-bold font-serif text-lg">
              ₵
            </span>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-amber-900">
                RUNNING PAID VOTING INSTEAD?
              </p>
              <h3 className="text-sm font-semibold text-stone-900 mt-0.5">
                Paid events consume zero SMS credits
              </h3>
              <p className="text-xs text-stone-500 mt-1 max-w-lg leading-relaxed">
                Paid ballots verify identity directly through Mobile Money checkout (MTN MoMo,
                Telecel Cash, Visa/Mastercard). Connect your Paystack settlement account to start
                monetizing.
              </p>
            </div>
          </div>
          <Link
            href={`/organizer/${organizationId}/payments`}
            className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-xs font-semibold text-stone-800 shadow-2xs hover:bg-stone-50 hover:border-stone-300 transition-all shrink-0 cursor-pointer"
          >
            <span>Set up payments</span>
            <Icon name="arrowRight" size={13} />
          </Link>
        </div>
      </section>
    </main>
  );
}
