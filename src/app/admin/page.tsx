import { requirePlatformAdmin } from "@/lib/auth/require-platform-admin";
import { AdminReviewQueue } from "@/components/admin/review-queue";
import { Icon } from "@/components/icon";

export default async function AdminPage() {
  const { supabase } = await requirePlatformAdmin();
  const [{ data, error }, { data: overview }] = await Promise.all([
    supabase.rpc("get_pending_correction_requests"),
    supabase.rpc("get_admin_overview"),
  ]);

  const photoPaths = (data ?? [])
    .filter((item: { kind: string }) => item.kind === "photo")
    .map((item: { proposed_value: string }) => item.proposed_value);

  const { data: signed } = photoPaths.length
    ? await supabase.storage.from("nominee-images").createSignedUrls(photoPaths, 3600)
    : { data: [] };

  const previewUrls = Object.fromEntries(
    (signed ?? []).flatMap((item) => (item.path && item.signedUrl ? [[item.path, item.signedUrl]] : []))
  );

  const totals = overview?.[0];

  const metrics = [
    { label: "Organizers", value: totals?.organizers ?? 0, icon: "building" },
    { label: "Total Events", value: totals?.events ?? 0, icon: "vote" },
    { label: "Published Live", value: totals?.published_events ?? 0, icon: "sparkle" },
    { label: "Payments Settled", value: totals?.successful_payments ?? 0, icon: "check" },
    {
      label: "Gross Volume",
      value: `GH₵ ${(Number(totals?.gross_minor ?? 0) / 100).toLocaleString("en-GH", { minimumFractionDigits: 2 })}`,
      icon: "coin",
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-stone-200 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-600" />
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-800">
              PLATFORM OPERATIONS
            </p>
          </div>
          <h1 className="mt-2 text-2xl font-serif font-bold tracking-tight text-stone-900 sm:text-3xl">
            Operations & Review Queue
          </h1>
          <p className="mt-1 text-xs text-stone-500 max-w-xl">
            Monitor real-time platform metrics, review organizer correction submissions, and oversee live ballots.
          </p>
        </div>

        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-900 border border-amber-200">
            <span>{data?.length ?? 0} corrections pending</span>
          </span>
        </div>
      </div>

      {/* Metrics Banner */}
      <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        {metrics.map((m) => (
          <div
            key={m.label}
            className="rounded-2xl border border-stone-200/90 bg-white p-4 shadow-xs flex flex-col justify-between"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
                {m.label}
              </span>
              <span className="text-stone-400">
                <Icon name={m.icon as any} size={14} />
              </span>
            </div>
            <div className="mt-3">
              <span className="text-xl font-serif font-bold text-stone-900 tracking-tight">
                {m.value}
              </span>
            </div>
          </div>
        ))}
      </section>

      {/* Main Queue Section */}
      <section className="space-y-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
            AUDIT & APPROVALS
          </p>
          <h2 className="text-base font-serif font-bold text-stone-900">
            Organizer Correction Requests
          </h2>
        </div>

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-xs text-red-900">
            The review queue is temporarily unavailable. Please refresh the page.
          </div>
        ) : (
          <AdminReviewQueue requests={data ?? []} previewUrls={previewUrls} />
        )}
      </section>
    </div>
  );
}
