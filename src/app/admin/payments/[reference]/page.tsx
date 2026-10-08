import Link from "next/link";
import { requirePlatformAdmin } from "@/lib/auth/require-platform-admin";
import { Icon } from "@/components/icon";

type PaymentDetail = {
  reference: string;
  event_name: string | null;
  organization_name: string;
  status: string;
  gross_minor: number;
  refunded_minor: number;
  provider_fee_minor: number;
  organizer_net_minor: number;
  created_at: string;
  confirmed_at: string | null;
};

type WebhookRow = {
  id: string;
  kind: string;
  resource: string;
  processed_at: string | null;
};

const statusStyles: Record<string, string> = {
  succeeded: "bg-emerald-50 text-emerald-900 border-emerald-200",
  pending: "bg-amber-50 text-amber-900 border-amber-200",
  failed: "bg-red-50 text-red-900 border-red-200",
  refunded: "bg-blue-50 text-blue-900 border-blue-200",
  reversed: "bg-purple-50 text-purple-900 border-purple-200",
};

export default async function PaymentDetail({
  params,
}: {
  params: Promise<{ reference: string }>;
}) {
  const { reference } = await params;
  const { supabase } = await requirePlatformAdmin();

  const [{ data }, { data: webhooks }] = await Promise.all([
    supabase.rpc("get_admin_payment_detail", { p_reference: reference }),
    supabase.rpc("get_admin_payment_webhooks", { p_reference: reference }),
  ]);

  const p = (data ?? [])[0] as PaymentDetail | undefined;
  const webhookRows = (webhooks ?? []) as WebhookRow[];

  if (!p) {
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-12 text-center shadow-xs space-y-4">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-stone-100 text-stone-400">
          <Icon name="search" size={20} />
        </div>
        <h2 className="text-base font-serif font-bold text-stone-900">
          Payment not found
        </h2>
        <Link
          href="/admin/payments"
          className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-4 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50 shadow-2xs"
        >
          <Icon name="arrowLeft" size={13} /> Back to Payments
        </Link>
      </div>
    );
  }

  const moneyRows: [string, string][] = [
    ["Gross", `GHS ${(Number(p.gross_minor) / 100).toFixed(2)}`],
    ["Provider fee", `GHS ${(Number(p.provider_fee_minor) / 100).toFixed(2)}`],
    ["Refunded", `GHS ${(Number(p.refunded_minor) / 100).toFixed(2)}`],
    ["Organizer net", `GHS ${(Number(p.organizer_net_minor) / 100).toFixed(2)}`],
  ];

  return (
    <div className="space-y-6">
      {/* Back */}
      <Link
        href="/admin/payments"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-500 hover:text-stone-800 transition-colors"
      >
        <Icon name="arrowLeft" size={13} /> Back to Payments
      </Link>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-stone-200 pb-6">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-1">
            Payment Detail
          </p>
          <h1 className="text-xl font-mono font-bold text-stone-900 sm:text-2xl break-all">
            {p.reference}
          </h1>
          <p className="mt-1 text-sm text-stone-500">
            {p.event_name ?? "Unknown event"} &middot;{" "}
            <span className="font-medium text-stone-700">{p.organization_name}</span>
          </p>
        </div>
        <span
          className={`self-start rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wider ${
            statusStyles[p.status] ?? "bg-stone-100 text-stone-700 border-stone-200"
          }`}
        >
          {p.status}
        </span>
      </div>

      {/* Financial Breakdown */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        {moneyRows.map(([label, value]) => (
          <div
            key={label}
            className="rounded-2xl border border-stone-200/90 bg-white p-4 shadow-xs"
          >
            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 block mb-1">
              {label}
            </span>
            <span className="font-mono font-bold text-stone-900 text-sm">
              {value}
            </span>
          </div>
        ))}
      </div>

      {/* Timeline */}
      <div className="rounded-2xl border border-stone-200/90 bg-white shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-stone-100">
          <h2 className="text-sm font-serif font-bold text-stone-900">
            Refund &amp; Timeline
          </h2>
        </div>
        <ul className="divide-y divide-stone-100">
          <li className="flex items-center justify-between px-5 py-3.5">
            <span className="text-xs text-stone-500">Created</span>
            <time className="text-xs font-mono text-stone-700">
              {new Date(p.created_at).toLocaleString("en-GH")}
            </time>
          </li>
          <li className="flex items-center justify-between px-5 py-3.5">
            <span className="text-xs text-stone-500">Confirmed</span>
            <time className="text-xs font-mono text-stone-700">
              {p.confirmed_at
                ? new Date(p.confirmed_at).toLocaleString("en-GH")
                : "Not yet confirmed"}
            </time>
          </li>
          <li className="flex items-center justify-between px-5 py-3.5">
            <span className="text-xs text-stone-500">Adjustment state</span>
            <span
              className={`text-xs font-semibold ${
                Number(p.refunded_minor) > 0
                  ? "text-blue-700"
                  : "text-stone-400"
              }`}
            >
              {Number(p.refunded_minor) > 0
                ? "Refund or reversal recorded"
                : "No adjustment recorded"}
            </span>
          </li>
        </ul>
      </div>

      {/* Webhook History */}
      <div className="rounded-2xl border border-stone-200/90 bg-white shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-stone-100">
          <h2 className="text-sm font-serif font-bold text-stone-900">
            Webhook History
          </h2>
          <p className="text-xs text-stone-500 mt-0.5">
            {webhookRows.length} job{webhookRows.length !== 1 ? "s" : ""} recorded
          </p>
        </div>
        {webhookRows.length ? (
          <ul className="divide-y divide-stone-100">
            {webhookRows.map((hook) => (
              <li
                key={hook.id}
                className="flex items-center justify-between px-5 py-3"
              >
                <div>
                  <span className="text-xs font-semibold text-stone-800 capitalize">
                    {hook.kind}
                  </span>
                  <span className="ml-2 text-[11px] text-stone-400">
                    {hook.resource}
                  </span>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    hook.processed_at
                      ? "bg-emerald-50 text-emerald-800"
                      : "bg-amber-50 text-amber-800"
                  }`}
                >
                  {hook.processed_at ? "Processed" : "Pending"}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-5 py-4 text-xs text-stone-400 italic">
            No webhook jobs recorded for this payment.
          </p>
        )}
      </div>
    </div>
  );
}
