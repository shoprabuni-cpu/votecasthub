import Link from "next/link";
import { requirePlatformAdmin } from "@/lib/auth/require-platform-admin";
import { EventReviewConversation } from "@/components/events/review-conversation";
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
  const [
    { data, error },
    { data: eventMeta },
    { data: ticketTiers },
  ] = await Promise.all([
    supabase.rpc("get_admin_event_detail", { p_event_id: eventId }),
    supabase.from("events").select("event_type, venue_name, venue_address, doors_open_time, image_path").eq("id", eventId).maybeSingle(),
    supabase.from("event_ticket_tiers").select("*").eq("event_id", eventId).order("sort_order", { ascending: true }),
  ]);
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
  const isTicketOnly = eventMeta?.event_type === "ticketing";
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

  const totalCapacity = (ticketTiers ?? []).reduce((acc: number, t: any) => acc + (t.capacity || 0), 0);
  const totalSold = (ticketTiers ?? []).reduce((acc: number, t: any) => acc + (t.sold_count || 0), 0);

  return (
    <div className="space-y-6">
      <EventReviewConversation eventId={eventId} />
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
            {isTicketOnly && (
              <span className="rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                🎟️ Ticketed Event
              </span>
            )}
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
      {isTicketOnly ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
          <div className="rounded-2xl border border-stone-200/90 bg-white p-4 shadow-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 block mb-1">
              Venue
            </span>
            <span className="font-semibold text-stone-800 text-sm truncate block">
              {eventMeta?.venue_name || "Not specified"}
            </span>
          </div>
          <div className="rounded-2xl border border-stone-200/90 bg-white p-4 shadow-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 block mb-1">
              Doors Open
            </span>
            <span className="font-semibold text-stone-800 text-sm">
              {eventMeta?.doors_open_time || "Not specified"}
            </span>
          </div>
          <div className="rounded-2xl border border-stone-200/90 bg-white p-4 shadow-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 block mb-1">
              Ticket Tiers
            </span>
            <span className="font-serif font-bold text-stone-900 text-lg">{(ticketTiers ?? []).length}</span>
          </div>
          <div className="rounded-2xl border border-stone-200/90 bg-white p-4 shadow-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 block mb-1">
              Capacity / Sold
            </span>
            <span className="font-mono text-xs text-stone-700 font-bold">
              {totalSold} / {totalCapacity} passes
            </span>
          </div>
        </div>
      ) : (
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
      )}

      {/* Description & Venue */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-stone-200/90 bg-white p-6 shadow-xs space-y-2">
          <h2 className="text-xs font-bold uppercase tracking-wider text-stone-400">Description</h2>
          <p className="text-xs text-stone-700 leading-relaxed whitespace-pre-wrap">
            {event.description || "No public description provided for this event."}
          </p>
        </div>

        {isTicketOnly && (
          <div className="rounded-2xl border border-stone-200/90 bg-white p-6 shadow-xs space-y-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-stone-400">Venue Details</h2>
            <p className="text-sm font-semibold text-stone-900">{eventMeta?.venue_name || "Venue unassigned"}</p>
            {eventMeta?.venue_address && (
              <p className="text-xs text-stone-600">{eventMeta.venue_address}</p>
            )}
            <p className="text-xs text-stone-500 pt-1">
              Schedule: {new Date(event.starts_at).toLocaleString("en-GH")} → {new Date(event.ends_at).toLocaleString("en-GH")}
            </p>
          </div>
        )}
      </div>

      <DataDeletionPanel kind="event" targetId={eventId} role={role} />

      {/* Tiers or Nominees */}
      {isTicketOnly ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-serif font-bold text-stone-900">🎟️ Event Ticket Tiers & Capacity</h2>
            <span className="text-xs font-mono text-stone-500">{totalCapacity} Total Capacity</span>
          </div>

          <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden shadow-xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-stone-50 border-b border-stone-200 text-stone-600 font-bold uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Tier Name</th>
                  <th className="px-4 py-3">Price</th>
                  <th className="px-4 py-3">Capacity</th>
                  <th className="px-4 py-3">Sold</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {(ticketTiers ?? []).map((t: any) => (
                  <tr key={t.id} className="hover:bg-stone-50/50">
                    <td className="px-4 py-3 font-semibold text-stone-900">{t.name}</td>
                    <td className="px-4 py-3 font-mono font-bold text-emerald-800">
                      {t.price_minor === 0 ? "FREE" : `GH₵ ${(t.price_minor / 100).toFixed(2)}`}
                    </td>
                    <td className="px-4 py-3 font-mono text-stone-700">{t.capacity}</td>
                    <td className="px-4 py-3 font-mono text-stone-700">{t.sold_count}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        t.is_active ? "bg-emerald-50 text-emerald-800" : "bg-stone-100 text-stone-500"
                      }`}>
                        {t.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
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
      )}
    </div>
  );
}
