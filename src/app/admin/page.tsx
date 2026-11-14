import { requirePlatformAdmin } from "@/lib/auth/require-platform-admin";
import { AdminReviewQueue } from "@/components/admin/review-queue";
import { Icon } from "@/components/icon";
import Link from "next/link";

export default async function AdminPage() {
  const { supabase } = await requirePlatformAdmin();
  const [
    { data: corrections, error: correctionError },
    { data: overview },
    { data: allEvents },
    { data: ussdRequests },
  ] = await Promise.all([
    supabase.rpc("get_pending_correction_requests"),
    supabase.rpc("get_admin_overview"),
    supabase.rpc("get_admin_events", { p_search: null }),
    supabase
      .from("event_ussd_requests")
      .select("event_id, organization_id, status, updated_at, event_code")
      .in("status", ["requested", "accepted"])
      .order("updated_at", { ascending: false })
      .limit(20),
  ]);

  const pendingEvents = (allEvents ?? []).filter(
    (item: { status: string }) => item.status === "pending_review"
  );
  const pendingUssd = ussdRequests ?? [];

  const photoPaths = (corrections ?? [])
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
            Review submissions awaiting approval, issue USSD quotes, oversee live ballots, and monitor platform metrics.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {pendingEvents.length > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-900 border border-emerald-200">
              <span>{pendingEvents.length} events awaiting approval</span>
            </span>
          )}
          {pendingUssd.length > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-900 border border-blue-200">
              <span>{pendingUssd.length} USSD requests</span>
            </span>
          )}
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-900 border border-amber-200">
            <span>{corrections?.length ?? 0} corrections pending</span>
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
                <Icon name={m.icon} size={14} />
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

      {/* 1. Pending Event Approvals (Visible the moment you log in!) */}
      {pendingEvents.length > 0 && (
        <section className="space-y-4 rounded-2xl border border-emerald-200 bg-emerald-50/40 p-5 sm:p-6 shadow-xs">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                ACTION REQUIRED
              </p>
              <h2 className="text-lg font-serif font-bold text-stone-900">
                Events Awaiting Review & Approval ({pendingEvents.length})
              </h2>
            </div>
            <Link
              href="/admin/events"
              className="text-xs font-semibold text-emerald-900 hover:underline"
            >
              View all events →
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {pendingEvents.map((evt: any) => (
              <div
                key={evt.id}
                className="flex flex-col justify-between rounded-xl border border-emerald-200 bg-white p-4 shadow-2xs hover:shadow-xs transition-all"
              >
                <div>
                  <span className="inline-block rounded-md bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-900">
                    Awaiting Review
                  </span>
                  <h3 className="mt-2 text-base font-semibold text-stone-900 truncate">
                    {evt.name}
                  </h3>
                  <p className="text-xs text-stone-500 mt-0.5">
                    Org: <strong className="text-stone-700">{evt.organization_name}</strong>
                  </p>
                  <p className="text-[11px] text-stone-400 mt-1">
                    Submitted: {new Date(evt.created_at).toLocaleDateString("en-GH", { timeZone: "Africa/Accra" })}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-stone-100 flex items-center justify-between">
                  <span className="text-xs font-semibold text-stone-700 capitalize">
                    {evt.voting_mode} voting
                  </span>
                  <Link
                    href={`/admin/events/${evt.id}`}
                    className="inline-flex items-center gap-1 text-xs font-bold text-emerald-800 hover:text-emerald-900 rounded-lg px-2.5 py-1.5 hover:bg-emerald-50 border border-emerald-300"
                  >
                    <span>Review Event</span>
                    <span>→</span>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 2. Pending USSD Quote & Activation Requests */}
      {pendingUssd.length > 0 && (
        <section className="space-y-4 rounded-2xl border border-blue-200 bg-blue-50/30 p-5 sm:p-6 shadow-xs">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-blue-800">
                USSD GATEWAY
              </p>
              <h2 className="text-lg font-serif font-bold text-stone-900">
                USSD Access Requests ({pendingUssd.length})
              </h2>
            </div>
            <Link
              href="/admin/ussd"
              className="text-xs font-semibold text-blue-900 hover:underline"
            >
              Open USSD console →
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {pendingUssd.map((req: any) => (
              <div
                key={req.event_id}
                className="flex flex-col justify-between rounded-xl border border-blue-200 bg-white p-4 shadow-2xs hover:shadow-xs transition-all"
              >
                <div>
                  <span className="inline-block rounded-md bg-blue-50 border border-blue-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-900">
                    {req.status === "accepted" ? "Quote Accepted (Awaiting Activation)" : "Quote Requested"}
                  </span>
                  <p className="mt-2 text-xs font-mono font-bold text-stone-800">
                    Event Code: {req.event_code}
                  </p>
                  <p className="text-[11px] text-stone-400 mt-1">
                    Updated: {new Date(req.updated_at).toLocaleDateString("en-GH", { timeZone: "Africa/Accra" })}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-stone-100 flex items-center justify-between">
                  <span className="text-[11px] text-stone-500">
                    {req.status === "accepted" ? "Ready for shortcode" : "Needs price quote"}
                  </span>
                  <Link
                    href="/admin/ussd"
                    className="inline-flex items-center gap-1 text-xs font-bold text-blue-800 hover:text-blue-900 rounded-lg px-2.5 py-1.5 hover:bg-blue-50 border border-blue-300"
                  >
                    <span>{req.status === "accepted" ? "Activate" : "Issue Quote"}</span>
                    <span>→</span>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 3. Organizer Correction Requests (Existing reviews) */}
      <section className="space-y-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
            AUDIT & APPROVALS
          </p>
          <h2 className="text-base font-serif font-bold text-stone-900">
            Organizer Correction Requests
          </h2>
        </div>

        {correctionError ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-xs text-red-900">
            The review queue is temporarily unavailable. Please refresh the page.
          </div>
        ) : (
          <AdminReviewQueue requests={corrections ?? []} previewUrls={previewUrls} />
        )}
      </section>
    </div>
  );
}
