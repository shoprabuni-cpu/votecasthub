import Link from "next/link";
import { requirePlatformAdmin } from "@/lib/auth/require-platform-admin";
import { Icon } from "@/components/icon";

type PaymentRow = {
  reference: string;
  event_name: string | null;
  organization_name: string;
  status: string;
  gross_minor: number;
  refunded_minor: number;
  created_at: string;
};

const statusStyles: Record<string, string> = {
  succeeded: "bg-emerald-50 text-emerald-800 border-emerald-200",
  pending: "bg-amber-50 text-amber-800 border-amber-200",
  failed: "bg-red-50 text-red-800 border-red-200",
  refunded: "bg-blue-50 text-blue-800 border-blue-200",
  reversed: "bg-purple-50 text-purple-800 border-purple-200",
};

export default async function AdminPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const query = await searchParams;
  const { supabase } = await requirePlatformAdmin();
  const { data } = await supabase.rpc("get_admin_payments_filtered", {
    p_search: query.q || null,
    p_status: query.status || null,
  });
  const rows = (data ?? []) as PaymentRow[];

  const totalGross = rows.reduce((sum, r) => sum + Number(r.gross_minor), 0);
  const totalRefunded = rows.reduce((sum, r) => sum + Number(r.refunded_minor), 0);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="border-b border-stone-200 pb-6">
        <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-1">
          Finance Operations
        </p>
        <h1 className="text-2xl font-serif font-bold text-stone-900 sm:text-3xl">
          Payment Activity
        </h1>
        <p className="mt-1 text-sm text-stone-500">
          Search and filter payments, refunds, and reversals.
        </p>
      </div>

      {/* Summary Metrics */}
      {rows.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
          <div className="rounded-2xl border border-stone-200/90 bg-white p-4 shadow-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 block mb-1">
              Transactions
            </span>
            <span className="font-serif font-bold text-stone-900 text-lg">
              {rows.length}
            </span>
          </div>
          <div className="rounded-2xl border border-stone-200/90 bg-white p-4 shadow-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 block mb-1">
              Total Gross
            </span>
            <span className="font-serif font-bold text-stone-900 text-lg">
              GHS {(totalGross / 100).toFixed(2)}
            </span>
          </div>
          <div className="rounded-2xl border border-stone-200/90 bg-white p-4 shadow-xs col-span-2 sm:col-span-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 block mb-1">
              Total Refunded
            </span>
            <span className="font-serif font-bold text-stone-900 text-lg">
              GHS {(totalRefunded / 100).toFixed(2)}
            </span>
          </div>
        </div>
      )}

      {/* Filters */}
      <form
        method="get"
        className="flex flex-col sm:flex-row gap-3"
      >
        <div className="relative flex-1 max-w-sm">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-stone-400 pointer-events-none">
            <Icon name="search" size={14} />
          </span>
          <input
            name="q"
            defaultValue={query.q ?? ""}
            placeholder="Reference, event, or organizer..."
            aria-label="Search payments"
            className="w-full rounded-xl border border-stone-300 bg-white pl-9 pr-3.5 py-2 text-xs text-stone-900 placeholder:text-stone-400 focus:border-emerald-600 focus:outline-none focus:ring-3 focus:ring-emerald-600/15"
          />
        </div>
        <select
          name="status"
          defaultValue={query.status ?? ""}
          aria-label="Filter by payment status"
          className="rounded-xl border border-stone-300 bg-white px-3.5 py-2 text-xs text-stone-800 focus:border-emerald-600 focus:outline-none focus:ring-3 focus:ring-emerald-600/15"
        >
          <option value="">All statuses</option>
          <option value="succeeded">Successful</option>
          <option value="pending">Pending</option>
          <option value="failed">Failed</option>
          <option value="refunded">Refunded</option>
          <option value="reversed">Reversed</option>
        </select>
        <button
          type="submit"
          className="inline-flex items-center gap-1.5 rounded-xl bg-stone-900 px-4 py-2 text-xs font-semibold text-white hover:bg-stone-700 transition-colors shadow-2xs"
        >
          <Icon name="search" size={13} />
          Apply
        </button>
        {(query.q || query.status) && (
          <Link
            href="/admin/payments"
            className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-4 py-2 text-xs font-semibold text-stone-600 hover:bg-stone-50 shadow-2xs"
          >
            Clear
          </Link>
        )}
      </form>

      {/* Table */}
      {rows.length ? (
        <div className="rounded-2xl border border-stone-200/90 bg-white shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-stone-100 bg-stone-50/60">
                  <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-stone-400">
                    Reference
                  </th>
                  <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-stone-400">
                    Event
                  </th>
                  <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-stone-400">
                    Organizer
                  </th>
                  <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-stone-400">
                    Status
                  </th>
                  <th className="px-5 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-stone-400">
                    Gross
                  </th>
                  <th className="px-5 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-stone-400">
                    Refunded
                  </th>
                  <th className="px-5 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-stone-400">
                    Date
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {rows.map((row) => (
                  <tr
                    key={row.reference}
                    className="hover:bg-stone-50/60 transition-colors"
                  >
                    <td className="px-5 py-3.5 font-mono text-[11px] text-stone-700">
                      <Link
                        href={`/admin/payments/${encodeURIComponent(row.reference)}`}
                        className="text-emerald-700 hover:text-emerald-900 hover:underline font-semibold"
                      >
                        {row.reference}
                      </Link>
                    </td>
                    <td className="px-5 py-3.5 text-stone-700 max-w-[160px] truncate">
                      {row.event_name ?? "—"}
                    </td>
                    <td className="px-5 py-3.5 text-stone-700">{row.organization_name}</td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                          statusStyles[row.status] ?? "bg-stone-100 text-stone-600 border-stone-200"
                        }`}
                      >
                        {row.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right font-mono text-stone-700">
                      GHS {(Number(row.gross_minor) / 100).toFixed(2)}
                    </td>
                    <td className="px-5 py-3.5 text-right font-mono text-stone-500">
                      {Number(row.refunded_minor) > 0
                        ? `GHS ${(Number(row.refunded_minor) / 100).toFixed(2)}`
                        : "—"}
                    </td>
                    <td className="px-5 py-3.5 text-right text-stone-400 font-mono text-[11px]">
                      {new Date(row.created_at).toLocaleDateString("en-GH")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-stone-200/90 bg-white p-12 text-center shadow-xs space-y-3">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-stone-100 text-stone-400">
            <Icon name="search" size={20} />
          </div>
          <h2 className="text-base font-serif font-bold text-stone-900">
            No matching payments
          </h2>
          <p className="text-xs text-stone-500">
            Try adjusting your search query or status filter.
          </p>
        </div>
      )}
    </div>
  );
}
