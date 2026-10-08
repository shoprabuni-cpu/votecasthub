import Link from "next/link";
import { requirePlatformAdmin } from "@/lib/auth/require-platform-admin";
import { OrganizerModerationActions } from "@/components/admin/organizer-moderation-actions";
import { OrganizationClosureAction, OrganizationClosureQueue } from "@/components/admin/organization-closure-review";
import { Icon } from "@/components/icon";

type OrgRow = {
  name: string;
  moderation_status: string;
  paystack_status: string;
  paystack_verified: boolean;
  event_id: string | null;
  event_name: string | null;
  event_status: string | null;
};

const eventStatusStyles: Record<string, string> = {
  published: "bg-emerald-50 text-emerald-800 border-emerald-200",
  pending_review: "bg-amber-50 text-amber-800 border-amber-200",
  draft: "bg-stone-100 text-stone-600 border-stone-200",
  paused: "bg-yellow-50 text-yellow-800 border-yellow-200",
  closed: "bg-stone-100 text-stone-600 border-stone-200",
  archived: "bg-stone-50 text-stone-400 border-stone-200",
};

export default async function OrganizerProfile({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId } = await params;
  const { supabase, role } = await requirePlatformAdmin();

  const [{ data }, { data: history }, { data: closureRequests, error: closureError }, { data: closureReadiness, error: readinessError }] = await Promise.all([
    supabase.rpc("get_admin_organization_profile", { p_org: organizationId }),
    supabase.rpc("get_admin_moderation_history", { p_org: organizationId }),
    supabase.rpc("get_admin_organization_closure_requests", { p_org: organizationId }),
    supabase.rpc("get_admin_organization_closure_readiness", { p_org: organizationId }),
  ]);

  const rows = (data ?? []) as OrgRow[];
  const historyRows = (history ?? []) as {
    id: string;
    kind: string;
    severity: number;
    status: string;
    created_at: string;
  }[];
  const first = rows[0];

  if (!first) {
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-12 text-center shadow-xs space-y-4">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-stone-100 text-stone-400">
          <Icon name="building" size={20} />
        </div>
        <h2 className="text-base font-serif font-bold text-stone-900">
          Organizer not found
        </h2>
        <Link
          href="/admin/organizers"
          className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-4 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50 shadow-2xs"
        >
          <Icon name="arrowLeft" size={13} /> Back to Organizers
        </Link>
      </div>
    );
  }

  const events = rows.filter((r) => r.event_id);

  return (
    <div className="space-y-6">
      {/* Back */}
      <Link
        href="/admin/organizers"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-500 hover:text-stone-800 transition-colors"
      >
        <Icon name="arrowLeft" size={13} /> Back to Organizers
      </Link>

      {/* Header */}
      <div className="border-b border-stone-200 pb-6">
        <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-1">
          Organizer Profile
        </p>
        <h1 className="text-2xl font-serif font-bold text-stone-900 sm:text-3xl">
          {first.name}
        </h1>
        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-stone-500">
          <span>
            Paystack:{" "}
            <span className="font-semibold text-stone-700">
              {first.paystack_status}
            </span>
          </span>
          {first.paystack_verified && (
            <span className="text-emerald-700 font-bold">✓ Verified</span>
          )}
        </div>
      </div>

      {/* Moderation Actions */}
      <OrganizerModerationActions
        organizationId={organizationId}
        status={first.moderation_status}
      />

      {closureError || readinessError ? <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">Organization closure controls could not be loaded. Apply the latest migrations and refresh.</p> : <>
        {first.moderation_status === "closed" ? <div className="rounded-xl border border-stone-200 bg-stone-50 p-5 text-sm"><p className="font-semibold">This organization is permanently closed.</p><p className="mt-2 text-stone-600">{closureReadiness?.reason}</p></div> : <section className="space-y-3 rounded-2xl border border-red-200 bg-white p-5"><h2 className="font-serif font-bold">Close organization</h2><OrganizationClosureAction organizationId={organizationId} organizationName={first.name} blocker={closureReadiness?.blocker ?? null} canClose={role === "admin"} /></section>}
        <OrganizationClosureQueue requests={closureRequests ?? []} role={role} />
      </>}
      {/* Event History */}
      <div className="rounded-2xl border border-stone-200/90 bg-white shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-stone-100">
          <h2 className="text-sm font-serif font-bold text-stone-900">
            Event History
          </h2>
          <p className="text-xs text-stone-500 mt-0.5">
            {events.length} {events.length === 1 ? "event" : "events"} on record
          </p>
        </div>
        {events.length ? (
          <ul className="divide-y divide-stone-100">
            {events.map((e) => (
              <li
                key={e.event_id}
                className="flex items-center justify-between px-5 py-3"
              >
                <span className="text-sm font-medium text-stone-800">
                  {e.event_name ?? "—"}
                </span>
                {e.event_status && (
                  <span
                    className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                      eventStatusStyles[e.event_status] ??
                      eventStatusStyles.draft
                    }`}
                  >
                    {e.event_status.replaceAll("_", " ")}
                  </span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-5 py-4 text-xs text-stone-400 italic">
            No events have been created by this organizer.
          </p>
        )}
      </div>

      {/* Moderation History */}
      <div className="rounded-2xl border border-stone-200/90 bg-white shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-stone-100">
          <h2 className="text-sm font-serif font-bold text-stone-900">
            Moderation History
          </h2>
        </div>
        {historyRows.length ? (
          <ul className="divide-y divide-stone-100">
            {historyRows.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between px-5 py-3"
              >
                <div>
                  <span className="text-xs font-semibold text-stone-800 capitalize">
                    {item.kind.replaceAll("_", " ")}
                  </span>
                  <span className="ml-2 text-[10px] text-stone-400">
                    Severity {item.severity}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      item.status === "resolved"
                        ? "bg-emerald-50 text-emerald-800"
                        : item.status === "open"
                        ? "bg-amber-50 text-amber-800"
                        : "bg-stone-100 text-stone-600"
                    }`}
                  >
                    {item.status}
                  </span>
                  <time className="text-[10px] text-stone-400 font-mono">
                    {new Date(item.created_at).toLocaleDateString("en-GH")}
                  </time>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-5 py-4 text-xs text-stone-400 italic">
            No moderation flags recorded for this organizer.
          </p>
        )}
      </div>
    </div>
  );
}
