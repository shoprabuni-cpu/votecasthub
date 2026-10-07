import type { Metadata } from "next";
import Link from "next/link";
import { DashboardHeader } from "@/components/dashboard-header";
import { PaystackSubaccountForm } from "@/components/payments/paystack-subaccount-form";
import { AccountManagement } from "@/components/payments/account-management";
import { RefreshAccount } from "@/components/payments/refresh-account";
import { requireVerifiedUser } from "@/lib/auth/require-user";
import { paymentAdmin } from "@/lib/payments/admin";
import { Icon } from "@/components/icon";

export const metadata: Metadata = { title: "Payment settlement account — VotecastHub" };

export default async function PaymentsPage({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId } = await params;
  const { supabase, userId } = await requireVerifiedUser();

  const { data: member } = await supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!member) {
    return (
      <main className="min-h-screen bg-stone-950 text-stone-100 antialiased selection:bg-emerald-500/30 selection:text-emerald-200">
        <DashboardHeader />
        <section className="mx-auto max-w-lg px-4 py-20 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10 text-red-400">
            <Icon name="shield" size={24} />
          </div>
          <h1 className="text-xl font-bold text-white">Organization access denied</h1>
          <p className="mt-2 text-xs text-stone-400">
            You do not have active membership in this organization workspace.
          </p>
          <div className="mt-6">
            <Link
              href="/organizer"
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500 transition-colors"
            >
              Back to Organizations
            </Link>
          </div>
        </section>
      </main>
    );
  }

  const canManage = ["owner", "admin"].includes(member.role);

  const [{ data: org }, { data: account, error }, { data: operation, error: operationError }] =
    await Promise.all([
      supabase.from("organizations").select("name").eq("id", organizationId).maybeSingle(),
      paymentAdmin()
        .from("organization_paystack_accounts")
        .select("business_name,settlement_bank,account_last4,account_name,account_type,status,paystack_verified")
        .eq("organization_id", organizationId)
        .maybeSingle(),
      paymentAdmin()
        .from("payment_account_operations")
        .select("kind,created_at")
        .eq("organization_id", organizationId)
        .maybeSingle(),
    ]);

  const isVerifiedActive = account?.status === "active" && account.paystack_verified;
  const isInactive = account?.status === "inactive";

  return (
    <main className="min-h-screen bg-stone-950 text-stone-100 antialiased selection:bg-emerald-500/30 selection:text-emerald-200">
      <DashboardHeader organizationId={organizationId} />

      <section className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
        {/* Navigation Breadcrumb */}
        <div>
          <Link
            href={`/organizer/${organizationId}/events`}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-stone-400 hover:text-white transition-colors"
          >
            <Icon name="arrowLeft" size={14} />
            <span>{org?.name ?? "Back to workspace"}</span>
          </Link>
        </div>

        {/* Page Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-stone-800/80 pb-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-500">PAYSTACK SETTLEMENT</p>
            </div>
            <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
              Payout & Settlement Account
            </h1>
            <p className="mt-1 text-xs text-stone-400 max-w-xl">
              Direct settlement into your Ghanaian bank or Mobile Money account. 90% of each paid vote goes directly to you.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <Link
              href={`/organizer/${organizationId}/earnings`}
              className="inline-flex items-center gap-1.5 rounded-xl border border-stone-800 bg-stone-900 px-3.5 py-2 text-xs font-semibold text-stone-200 hover:border-stone-700 hover:text-white transition-all"
            >
              <Icon name="coin" size={14} className="text-amber-400" />
              <span>Earnings History</span>
            </Link>
          </div>
        </div>

        {/* Clear Transparent 90/10 Fee Card (Positioned Above Account Form for immediate clarity) */}
        <div className="overflow-hidden rounded-2xl border border-emerald-900/30 bg-gradient-to-br from-stone-900/90 via-stone-900/60 to-emerald-950/20 p-6 backdrop-blur-md">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1.5 max-w-md">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-400 border border-emerald-500/20">
                <Icon name="check" size={12} />
                <span>Zero Hidden Fees</span>
              </div>
              <h2 className="text-base font-bold text-white">
                Transparent revenue split. Paystack deductions included.
              </h2>
              <p className="text-xs text-stone-400 leading-relaxed">
                For every GH₵100 earned in voter checkouts, your account receives GH₵90. The 10% platform share absorbs standard mobile money and card transaction fees.
              </p>
            </div>

            <div className="flex items-center gap-4 rounded-xl border border-stone-800 bg-stone-950/60 p-4 shrink-0">
              <div className="text-center px-3">
                <div className="text-2xl font-bold font-mono text-emerald-400">90%</div>
                <div className="text-[10px] uppercase font-semibold text-stone-400 tracking-wider">Your Payout</div>
              </div>
              <div className="h-8 w-px bg-stone-800" />
              <div className="text-center px-3">
                <div className="text-2xl font-bold font-mono text-stone-400">10%</div>
                <div className="text-[10px] uppercase font-semibold text-stone-500 tracking-wider">Platform & Fees</div>
              </div>
            </div>
          </div>
        </div>

        {/* Syncing or Operation In-Progress Alert */}
        {operation && (
          <div className="flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-950/20 p-5 text-amber-200 backdrop-blur-sm">
            <span className="mt-0.5 h-2 w-2 rounded-full bg-amber-400 animate-ping shrink-0" />
            <div className="text-xs space-y-1">
              <div className="font-semibold text-white">Synchronization in progress with Paystack</div>
              <p className="text-amber-300/90 leading-relaxed">
                An account configuration request is currently executing. Paid checkouts and profile modifications are momentarily paused. Please refresh shortly.
              </p>
            </div>
          </div>
        )}

        {/* Database Load Error State */}
        {error || operationError ? (
          <div className="rounded-2xl border border-red-500/20 bg-red-950/20 p-6 text-center text-xs text-red-300">
            We could not load your saved settlement configuration. Please refresh this page before proceeding.
          </div>
        ) : (
          <>
            {/* Existing Connected Account Card */}
            {account ? (
              <div className="rounded-2xl border border-stone-800/80 bg-stone-900/60 p-6 sm:p-8 backdrop-blur-sm space-y-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-stone-800/80 pb-5">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xl font-bold font-mono">
                      ₵
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-white">{account.business_name}</h2>
                      <div className="flex items-center gap-2 mt-1">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${
                            isVerifiedActive
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                              : isInactive
                              ? "bg-stone-800 text-stone-400 border border-stone-700"
                              : "bg-amber-500/10 text-amber-300 border border-amber-500/30"
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              isVerifiedActive
                                ? "bg-emerald-400"
                                : isInactive
                                ? "bg-stone-500"
                                : "bg-amber-400 animate-pulse"
                            }`}
                          />
                          {isVerifiedActive
                            ? "Verified settlement account"
                            : isInactive
                            ? "Deactivated"
                            : "Awaiting Paystack verification"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <RefreshAccount organizationId={organizationId} />
                </div>

                {/* Account Details Data Grid */}
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                  <div className="rounded-xl border border-stone-800/60 bg-stone-950/60 p-3.5">
                    <div className="text-[10px] uppercase font-semibold text-stone-400 tracking-wider">
                      Registered Name
                    </div>
                    <div className="mt-1 text-xs font-bold text-white font-mono truncate">
                      {account.account_name || "Sync to fetch name"}
                    </div>
                  </div>

                  <div className="rounded-xl border border-stone-800/60 bg-stone-950/60 p-3.5">
                    <div className="text-[10px] uppercase font-semibold text-stone-400 tracking-wider">
                      Channel Type
                    </div>
                    <div className="mt-1 text-xs font-bold text-white capitalize">
                      {account.account_type === "mobile_money" ? "Mobile Money (MoMo)" : "GhIPSS Bank Account"}
                    </div>
                  </div>

                  <div className="rounded-xl border border-stone-800/60 bg-stone-950/60 p-3.5">
                    <div className="text-[10px] uppercase font-semibold text-stone-400 tracking-wider">
                      Bank / Network
                    </div>
                    <div className="mt-1 text-xs font-bold text-white">
                      {account.settlement_bank}
                    </div>
                  </div>

                  <div className="rounded-xl border border-stone-800/60 bg-stone-950/60 p-3.5">
                    <div className="text-[10px] uppercase font-semibold text-stone-400 tracking-wider">
                      Account / Number
                    </div>
                    <div className="mt-1 text-xs font-bold text-white font-mono">
                      •••• •••• {account.account_last4}
                    </div>
                  </div>

                  <div className="rounded-xl border border-stone-800/60 bg-stone-950/60 p-3.5">
                    <div className="text-[10px] uppercase font-semibold text-stone-400 tracking-wider">
                      Currency
                    </div>
                    <div className="mt-1 text-xs font-bold text-emerald-400 font-mono">
                      GHS (Ghana Cedi)
                    </div>
                  </div>

                  <div className="rounded-xl border border-stone-800/60 bg-stone-950/60 p-3.5">
                    <div className="text-[10px] uppercase font-semibold text-stone-400 tracking-wider">
                      Settlement Speed
                    </div>
                    <div className="mt-1 text-xs font-bold text-stone-300">
                      T+1 Automated
                    </div>
                  </div>
                </div>

                {/* Management Actions */}
                {canManage && !operation && (
                  <div className="border-t border-stone-800/80 pt-4">
                    <AccountManagement
                      key={account.status}
                      organizationId={organizationId}
                      status={account.status}
                      businessName={account.business_name}
                    />
                  </div>
                )}
              </div>
            ) : canManage && !operation ? (
              /* Setup New Account State */
              <div className="rounded-2xl border border-stone-800/80 bg-stone-900/60 p-6 sm:p-8 backdrop-blur-sm space-y-6">
                <div>
                  <h2 className="text-lg font-bold text-white">Connect Settlement Account</h2>
                  <p className="mt-1 text-xs text-stone-400">
                    Enter the Ghanaian bank account or Mobile Money wallet where your ticket and voting proceeds should be delivered.
                  </p>
                </div>

                <PaystackSubaccountForm organizationId={organizationId} />
              </div>
            ) : null}

            {!canManage && (
              <div className="rounded-xl border border-stone-800 bg-stone-900/40 p-4 text-xs text-stone-400 text-center">
                Only organization owners and administrators can configure or modify settlement bank accounts.
              </div>
            )}
          </>
        )}
      </section>
    </main>
  );
}
