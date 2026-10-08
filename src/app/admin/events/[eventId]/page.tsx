import Link from "next/link";
import { requirePlatformAdmin } from "@/lib/auth/require-platform-admin";
import { Icon } from "@/components/icon";
import { DataDeletionPanel } from "@/components/admin/data-deletion-panel";

type AdminEventRow = {
  event_name: string;
  event_status: string;
  organization_name: string;
  voting_mode: string;
  description: string | null;
  starts_at: string;
  ends_at: string;
  category_id: string | null;
  category_name: string | null;
  category_active: boolean | null;
  nominee_id: string | null;
  nominee_name: string | null;
  nominee_active: boolean | null;
};

export default async function AdminEventDetail({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const { supabase, role } = await requirePlatformAdmin();
  const { data, error } = await supabase.rpc("get_admin_event_detail", { p_event_id: eventId });
  const rows = (data ?? []) as AdminEventRow[];

  if (error || !rows.length) {
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-12 text-center shadow-xs space-y-4">
        <h2 className="text-base font-serif font-bold text-stone-900">Event details unavailable</h2>
        <p className="text-xs text-stone-500">
          The requested event could not be found or loaded.
        </p>
        <Link
          className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-4 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50 shadow-2xs"
          href="/admin/events"
        >
          <Icon name="arrowLeft" size={13} /> Back to Events
        </Link>
      </div>
    );
  }

  const event = rows[0];
  const categories = new Map<
    string,
    { name: string; active: boolean; nominees: { id: string; name: string; active: boolean }[] }
  >();

  for (const row of rows) {
    if (row.category_id) {
      const existing = categories.get(row.category_id);
      const category: { name: string; active: boolean; nominees: { id: string; name: string; active: boolean }[] } = existing ?? {
        name: row.category_name ?? "",
        active: row.category_active ?? false,
        nominees: [],
      };
      if (row.nominee_id) {
        category.nominees.push({
          id: row.nominee_id,
          name: row.nominee_name ?? "",
          active: row.nominee_active ?? false,
        });
      }
      categories.set(row.category_id, category);
    }
  }

  const statusStyles: Record<string, string> = {
    pending_review: "bg-amber-50 text-amber-900 border-amber-200",
    published: "bg-emerald-50 text-emerald-900 border-emerald-200",
    paused: "bg-yellow-50 text-yellow-900 border-yellow-200",
    closed: "bg-stone-100 text-stone-700 border-stone-200",
    archived: "bg-stone-100 text-stone-500 border-stone-200",
    draft: "bg-stone-50 text-stone-600 border-stone-200",
  };

  return (
    <div className="space-y-6">
      {/* Back Link */}
      <div>
        <Link
          href="/admin/events"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-500 hover:text-stone-800 transition-colors"
        >
          <Icon name="arrowLeft" size={13} /> Back to Platform Events
        </Link>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-200 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-stone-500">{event.organization_name}</span>
            <span
              className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                statusStyles[event.event_status] ?? statusStyles.draft
              }`}
            >
              {event.event_status.replaceAll("_", " ")}
            </span>
          </div>
          <h1 className="mt-1 text-2xl font-serif font-bold text-stone-900 sm:text-3xl">
            {event.event_name}
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`/events`}
            target="_blank"
            className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3.5 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50 shadow-2xs"
          >
            <Icon name="eye" size={14} />
            <span>Public Page</span>
          </Link>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="rounded-2xl border border-stone-200/90 bg-white p-4 shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 block mb-1">
            Voting Mode
          </span>
          <span className="font-semibold text-stone-800 capitalize text-sm">
            {event.voting_mode} Voting
          </span>
        </div>
        <div className="rounded-2xl border border-stone-200/90 bg-white p-4 shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 block mb-1">
            Categories
          </span>
          <span className="font-serif font-bold text-stone-900 text-lg">{categories.size}</span>
        </div>
        <div className="rounded-2xl border border-stone-200/90 bg-white p-4 shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 block mb-1">
            Voting Opens
          </span>
          <span className="font-mono text-xs text-stone-700">
            {new Date(event.starts_at).toLocaleString("en-GH", { dateStyle: "short", timeStyle: "short" })}
          </span>
        </div>
        <div className="rounded-2xl border border-stone-200/90 bg-white p-4 shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 block mb-1">
            Voting Closes
          </span>
          <span className="font-mono text-xs text-stone-700">
            {new Date(event.ends_at).toLocaleString("en-GH", { dateStyle: "short", timeStyle: "short" })}
          </span>
        </div>
      </div>

      {/* Description */}
      <div className="rounded-2xl border border-stone-200/90 bg-white p-6 shadow-xs space-y-2">
        <h2 className="text-xs font-bold uppercase tracking-wider text-stone-400">Description</h2>
        <p className="text-xs text-stone-700 leading-relaxed">
          {event.description || "No public description provided for this event."}
        </p>
      </div>

      {/* Categories & Nominees Roster */}
      <DataDeletionPanel kind="event" targetId={eventId} role={role} />
      <div className="space-y-4">
        <h2 className="text-base font-serif font-bold text-stone-900">Award Categories & Nominees</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from(categories.values()).map((category) => (
            <div
              key={category.name}
              className="rounded-2xl border border-stone-200/90 bg-white p-5 shadow-xs space-y-3"
            >
              <div className="flex items-center justify-between border-b border-stone-100 pb-2.5">
                <h3 className="font-serif font-semibold text-sm text-stone-900">{category.name}</h3>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    category.active ? "bg-emerald-50 text-emerald-800" : "bg-stone-100 text-stone-500"
                  }`}
                >
                  {category.active ? "Active" : "Hidden"}
                </span>
              </div>

              {category.nominees.length ? (
                <ul className="divide-y divide-stone-100 text-xs text-stone-600">
                  {category.nominees.map((n) => (
                    <li key={n.id} className="py-2 flex items-center justify-between">
                      <span className="font-medium text-stone-800">{n.name}</span>
                      <span className="text-[10px] text-stone-400">
                        {n.active ? "Visible" : "Hidden"}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-stone-400 italic">No nominees listed in this category.</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
