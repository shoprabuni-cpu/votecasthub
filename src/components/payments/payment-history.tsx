import { createClient } from "@/lib/supabase/server";
import { paystack } from "@/lib/payments/gateway";

const money = (n: number) =>
  new Intl.NumberFormat("en-GH", { style: "currency", currency: "GHS" }).format(Number(n) / 100);

const date = (s: string) =>
  new Intl.DateTimeFormat("en-GH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Accra",
  }).format(new Date(s));

export async function PaymentHistory({
  organizationId,
  page,
}: {
  organizationId: string;
  page: number;
}) {
  const db = await createClient();
  const { data: rows, error } = await db.rpc("get_payment_history", {
    p_org: organizationId,
    p_offset: (page - 1) * 25,
  });

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-xs space-y-4">
      <div>
        <h2 className="text-base font-bold text-stone-900">Direct Vote Checkout Transactions</h2>
        <p className="mt-0.5 text-xs text-stone-500">
          Gross amounts, payment provider costs, platform fee, and net organizer earnings per checkout.
        </p>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-700">
          Payment history could not be loaded. Please refresh shortly.
        </div>
      ) : rows && rows.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-stone-200">
          <table className="w-full text-left text-xs">
            <thead className="bg-stone-50 text-[11px] font-semibold uppercase tracking-wider text-stone-600 border-b border-stone-200">
              <tr>
                <th className="px-4 py-3">Date & Reference</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Gross</th>
                <th className="px-4 py-3">Refunded</th>
                <th className="px-4 py-3">Platform (10%)</th>
                <th className="px-4 py-3">Paystack Cost</th>
                <th className="px-4 py-3 text-right">Your Net (90%)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 font-mono text-stone-700">
              {rows.map(
                (r: {
                  reference: string;
                  created_at: string;
                  status: string;
                  gross: number;
                  refunded: number;
                  platform: number;
                  provider: number;
                  net: number;
                }) => {
                  const isSuccess = r.status === "confirmed" || r.status === "success";
                  return (
                    <tr key={r.reference} className="hover:bg-stone-50/70 transition-colors">
                      <td className="px-4 py-3 font-sans">
                        <div className="font-semibold text-stone-900">{date(r.created_at)}</div>
                        <div className="text-[11px] font-mono text-stone-400 truncate max-w-[140px]">
                          {r.reference}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-sans">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                            isSuccess
                              ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                              : "bg-stone-100 text-stone-600 border border-stone-200"
                          }`}
                        >
                          {r.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium text-stone-800">{money(r.gross)}</td>
                      <td className="px-4 py-3 text-stone-400">{r.refunded ? money(r.refunded) : "—"}</td>
                      <td className="px-4 py-3 text-stone-500">{money(r.platform)}</td>
                      <td className="px-4 py-3 text-stone-400">{money(r.provider)}</td>
                      <td className="px-4 py-3 text-right font-bold text-emerald-700">
                        {money(r.net)}
                      </td>
                    </tr>
                  );
                }
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-stone-200 p-8 text-center text-xs text-stone-500">
          No checkout payments recorded on this page yet.
        </div>
      )}
    </div>
  );
}

export async function SettlementHistory({
  organizationId,
  page,
}: {
  organizationId: string;
  page: number;
}) {
  const db = await createClient();
  const { data: account, error } = await db
    .from("organization_paystack_accounts")
    .select("subaccount_code")
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error || !account) {
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-xs space-y-2">
        <h2 className="text-base font-bold text-stone-900">Bank Settlements</h2>
        <p className="text-xs text-stone-500">
          {error
            ? "Settlement records temporarily unavailable."
            : "Connect your payment settlement account to view automatic bank payouts."}
        </p>
      </div>
    );
  }

  try {
    const subaccount = await paystack<{ id: number; subaccount_code: string }>(
      `/subaccount/${encodeURIComponent(account.subaccount_code)}`
    );
    if (!Number.isSafeInteger(subaccount.id) || subaccount.subaccount_code !== account.subaccount_code) {
      throw new Error();
    }

    const settlements = await paystack<
      Array<{
        id: number;
        status: string;
        currency: string;
        effective_amount: number;
        settlement_date: string;
        createdAt: string;
      }>
    >(`/settlement?subaccount=${subaccount.id}&perPage=25&page=${page}`);

    const ghsSettlements = settlements.filter((r) => r.currency === "GHS");

    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-xs space-y-4">
        <div>
          <h2 className="text-base font-bold text-stone-900">Paystack Bank & MoMo Payouts</h2>
          <p className="mt-0.5 text-xs text-stone-500">
            Real-time settlement status reported directly by Paystack for your linked subaccount.
          </p>
        </div>

        {ghsSettlements.length > 0 ? (
          <div className="overflow-x-auto rounded-xl border border-stone-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-stone-50 text-[11px] font-semibold uppercase tracking-wider text-stone-600 border-b border-stone-200">
                <tr>
                  <th className="px-4 py-3">Payout ID</th>
                  <th className="px-4 py-3">Settlement Date</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Effective Payout</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 font-mono text-stone-700">
                {ghsSettlements.map((r) => (
                  <tr key={r.id} className="hover:bg-stone-50/70 transition-colors">
                    <td className="px-4 py-3 font-sans font-semibold text-stone-900">#{r.id}</td>
                    <td className="px-4 py-3 text-stone-600">
                      {r.settlement_date || r.createdAt ? date(r.settlement_date || r.createdAt) : "Pending"}
                    </td>
                    <td className="px-4 py-3 font-sans">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                          r.status === "success"
                            ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                            : "bg-amber-100 text-amber-800 border border-amber-200"
                        }`}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-emerald-700">
                      {money(r.effective_amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-stone-200 p-8 text-center text-xs text-stone-500">
            No payouts on this page yet. Confirmed voter checkout payments may still be queuing for next-day settlement.
          </div>
        )}
      </div>
    );
  } catch {
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-xs space-y-2">
        <h2 className="text-base font-bold text-stone-900">Paystack Bank & MoMo Payouts</h2>
        <p className="text-xs text-stone-500" role="status">
          Paystack settlement ledger is temporarily unreachable. Your earnings and balances remain secure.
        </p>
      </div>
    );
  }
}
