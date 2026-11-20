import Link from "next/link";
import Image from "next/image";
import { requirePlatformAdmin } from "@/lib/auth/require-platform-admin";
import { EventReviewConversation } from "@/components/events/review-conversation";
import { AdminEventActionBar } from "@/components/admin/admin-event-action-bar";
import { Icon } from "@/components/icon";
import { TicketIcon, VoteIcon } from "@/components/brand-icons";
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
    { data: voteRows },
  ] = await Promise.all([
    supabase.rpc("get_admin_event_detail", { p_event_id: eventId }),
    supabase
      .from("events")
      .select("id, slug, event_type, venue_name, venue_address, doors_open_time, image_path, results_visibility, unit_price_minor, voting_mode, organization_id, created_at, updated_at")
      .eq("id", eventId)
      .maybeSingle(),
    supabase.from("event_ticket_tiers").select("*").eq("event_id", eventId).order("sort_order", { ascending: true }),
    supabase.rpc("get_public_event_results", { p_event_id: eventId }),
  ]);

  const rows = (data ?? []) as AdminEventRow[];

  if (error || !rows.length) {
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-12 text-center shadow-xs space-y-4 dark:border-[#1c2721] dark:bg-[#0c120e]">
        <h2 className="text-base font-serif font-bold text-stone-900 dark:text-white">Event details unavailable</h2>
        <p className="text-xs text-stone-500 dark:text-stone-400">
          The requested event could not be found or loaded.
        </p>
        <Link
          className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-4 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50 shadow-2xs dark:border-[#1c2721] dark:bg-[#141b16] dark:text-stone-300"
          href="/admin/events"
        >
          <Icon name="arrowLeft" size={13} /> Back to Events
        </Link>
      </div>
    );
  }

  const event = rows[0];
  let coverImageUrl: string | null = null;
  if (eventMeta?.image_path) {
    const { data: imgData } = await supabase.storage.from("nominee-images").createSignedUrl(eventMeta.image_path, 3600);
    coverImageUrl = imgData?.signedUrl ?? null;
  }

  const isHybrid = eventMeta?.event_type === "hybrid";
  const hasTickets = (ticketTiers ?? []).length > 0 || eventMeta?.event_type === "ticketing" || isHybrid;
  const hasNominees = rows.some((r) => r.category_id) || eventMeta?.event_type === "voting" || isHybrid;

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
    pending_review: "bg-amber-50 text-amber-900 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/50",
    published: "bg-emerald-50 text-emerald-900 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/50",
    paused: "bg-yellow-50 text-yellow-900 border-yellow-200 dark:bg-yellow-950/40 dark:text-yellow-300 dark:border-yellow-900/50",
    closed: "bg-stone-100 text-stone-700 border-stone-200 dark:bg-stone-900 dark:text-stone-300 dark:border-stone-800",
    archived: "bg-stone-100 text-stone-500 border-stone-200 dark:bg-stone-900 dark:text-stone-400 dark:border-stone-800",
    draft: "bg-stone-50 text-stone-600 border-stone-200 dark:bg-stone-900 dark:text-stone-400 dark:border-stone-800",
  };

  const totalCapacity = (ticketTiers ?? []).reduce((acc: number, t: any) => acc + (t.capacity || 0), 0);
  const totalSold = (ticketTiers ?? []).reduce((acc: number, t: any) => acc + (t.sold_count || 0), 0);
  const totalVotes = (voteRows ?? []).reduce((acc: number, r: any) => acc + Number(r.vote_count || 0), 0);

  const ghDate = (val: string) =>
    new Intl.DateTimeFormat("en-GH", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Africa/Accra",
    }).format(new Date(val));

  return (
    <div className="space-y-6">
      {/* Navigation & Header */}
      <div>
        <Link
          href="/admin/events"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 transition-colors"
        >
          <Icon name="arrowLeft" size={13} /> Back to Platform Events
        </Link>
      </div>

      {/* Main Event Card & Action Bar */}
      <div className="rounded-2xl border border-stone-200/90 bg-white p-5 sm:p-6 shadow-xs dark:border-[#1c2721] dark:bg-[#0c120e] space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-5 border-b border-stone-100 pb-5 dark:border-[#1a251f]">
          <div className="flex items-start gap-4">
            {coverImageUrl ? (
              <div className="relative h-20 w-20 sm:h-24 sm:w-24 shrink-0 overflow-hidden rounded-2xl border border-stone-200 bg-stone-100 shadow-sm dark:border-[#1c2721] dark:bg-[#141b16]">
                <Image
                  src={coverImageUrl}
                  alt={event.event_name}
                  fill
                  unoptimized
                  className="object-cover"
                />
              </div>
            ) : (
              <div className="flex h-20 w-20 sm:h-24 sm:w-24 shrink-0 items-center justify-center rounded-2xl border border-dashed border-stone-200 bg-stone-50 text-stone-400 dark:border-[#1c2721] dark:bg-[#121914]">
                {eventMeta?.event_type === "ticketing" ? <TicketIcon size={32} /> : <VoteIcon size={32} />}
              </div>
            )}

            <div className="space-y-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                {eventMeta?.organization_id ? (
                  <Link
                    href={`/admin/organizers/${eventMeta.organization_id}`}
                    className="text-xs font-semibold text-stone-600 hover:text-emerald-700 dark:text-stone-300 dark:hover:text-emerald-400 underline underline-offset-2"
                  >
                    {event.organization_name}
                  </Link>
                ) : (
                  <span className="text-xs font-semibold text-stone-500">{event.organization_name}</span>
                )}

                <span
                  className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                    statusStyles[event.event_status] ?? statusStyles.draft
                  }`}
                >
                  {event.event_status.replaceAll("_", " ")}
                </span>

                {isHybrid ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 text-purple-900 border border-purple-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-900/50">
                    <span>🎟️ Pass + 🗳️ Vote</span>
                  </span>
                ) : eventMeta?.event_type === "ticketing" ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 text-amber-900 border border-amber-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/50">
                    <TicketIcon size={11} />
                    <span>Ticketing Event</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-900 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/50">
                    <VoteIcon size={11} />
                    <span>Awards Contest</span>
                  </span>
                )}
              </div>

              <h1 className="text-xl sm:text-2xl md:text-3xl font-serif font-bold text-stone-900 dark:text-white leading-tight">
                {event.event_name}
              </h1>

              {eventMeta?.slug && (
                <p className="font-mono text-[11px] text-stone-400 dark:text-stone-500">
                  slug: /{eventMeta.slug}
                </p>
              )}
            </div>
          </div>

          {/* Interactive Moderation Action Bar */}
          <AdminEventActionBar
            eventId={eventId}
            currentStatus={event.event_status}
            eventSlug={eventMeta?.slug}
          />
        </div>

        {/* Key Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="rounded-xl border border-stone-200/80 bg-stone-50/60 p-3 dark:border-[#1a251f] dark:bg-[#121914]">
            <span className="text-[9px] font-bold uppercase tracking-wider text-stone-400 block mb-0.5">
              Total Ballots Cast
            </span>
            <span className="font-serif font-bold text-lg text-emerald-800 dark:text-emerald-400">
              {totalVotes.toLocaleString()}
            </span>
          </div>

          <div className="rounded-xl border border-stone-200/80 bg-stone-50/60 p-3 dark:border-[#1a251f] dark:bg-[#121914]">
            <span className="text-[9px] font-bold uppercase tracking-wider text-stone-400 block mb-0.5">
              Categories
            </span>
            <span className="font-serif font-bold text-lg text-stone-900 dark:text-white">
              {categories.size}
            </span>
          </div>

          <div className="rounded-xl border border-stone-200/80 bg-stone-50/60 p-3 dark:border-[#1a251f] dark:bg-[#121914]">
            <span className="text-[9px] font-bold uppercase tracking-wider text-stone-400 block mb-0.5">
              Ticket Tiers / Passes
            </span>
            <span className="font-serif font-bold text-lg text-stone-900 dark:text-white">
              {(ticketTiers ?? []).length} tiers
            </span>
          </div>

          <div className="rounded-xl border border-stone-200/80 bg-stone-50/60 p-3 dark:border-[#1a251f] dark:bg-[#121914]">
            <span className="text-[9px] font-bold uppercase tracking-wider text-stone-400 block mb-0.5">
              Capacity Sold
            </span>
            <span className="font-mono text-xs font-bold text-stone-800 dark:text-stone-200 block mt-1">
              {totalSold} / {totalCapacity || "∞"}
            </span>
          </div>

          <div className="rounded-xl border border-stone-200/80 bg-stone-50/60 p-3 dark:border-[#1a251f] dark:bg-[#121914]">
            <span className="text-[9px] font-bold uppercase tracking-wider text-stone-400 block mb-0.5">
              Voting Mode
            </span>
            <span className="font-semibold text-xs text-stone-800 dark:text-stone-200 capitalize block mt-1">
              {event.voting_mode}
            </span>
          </div>

          <div className="rounded-xl border border-stone-200/80 bg-stone-50/60 p-3 dark:border-[#1a251f] dark:bg-[#121914]">
            <span className="text-[9px] font-bold uppercase tracking-wider text-stone-400 block mb-0.5">
              Results Visibility
            </span>
            <span className="font-semibold text-xs text-stone-800 dark:text-stone-200 capitalize block mt-1">
              {(eventMeta?.results_visibility ?? "organizer_only").replace("_", " ")}
            </span>
          </div>
        </div>
      </div>

      {/* Description & Venue Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-stone-200/90 bg-white p-5 shadow-xs space-y-2 dark:border-[#1c2721] dark:bg-[#0c120e]">
          <h2 className="text-xs font-bold uppercase tracking-wider text-stone-400">Story &amp; Description</h2>
          <p className="text-xs text-stone-700 leading-relaxed whitespace-pre-wrap dark:text-stone-300">
            {event.description || "No public description provided for this event."}
          </p>
        </div>

        <div className="rounded-2xl border border-stone-200/90 bg-white p-5 shadow-xs space-y-2 dark:border-[#1c2721] dark:bg-[#0c120e]">
          <h2 className="text-xs font-bold uppercase tracking-wider text-stone-400">Schedule &amp; Venue Details</h2>
          <div className="space-y-1.5 text-xs text-stone-700 dark:text-stone-300">
            <p>
              <strong>Opens:</strong> <span className="font-mono">{ghDate(event.starts_at)}</span>
            </p>
            <p>
              <strong>Closes:</strong> <span className="font-mono">{ghDate(event.ends_at)}</span>
            </p>
            {eventMeta?.venue_name && (
              <p className="pt-1 border-t border-stone-100 dark:border-[#1a251f]">
                <strong>📍 Venue:</strong> {eventMeta.venue_name} {eventMeta.venue_address ? `(${eventMeta.venue_address})` : ""}
              </p>
            )}
            {eventMeta?.doors_open_time && (
              <p>
                <strong>⏰ Doors open:</strong> {eventMeta.doors_open_time}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* 1. Award Categories & Nominees (Shown if voting or hybrid event) */}
      {hasNominees && (
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-stone-200/80 pb-2 dark:border-[#1c2721]">
            <h2 className="flex items-center gap-2 text-base font-serif font-bold text-stone-900 dark:text-white">
              <VoteIcon size={16} />
              <span>Award Categories &amp; Contenders ({categories.size})</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Array.from(categories.values()).map((category) => (
              <div
                key={category.name}
                className="rounded-2xl border border-stone-200/90 bg-white p-5 shadow-xs space-y-3 dark:border-[#1c2721] dark:bg-[#0c120e]"
              >
                <div className="flex items-center justify-between border-b border-stone-100 pb-2.5 dark:border-[#1a251f]">
                  <h3 className="font-serif font-semibold text-sm text-stone-900 dark:text-white">{category.name}</h3>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      category.active
                        ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                        : "bg-stone-100 text-stone-500 dark:bg-stone-800 dark:text-stone-400"
                    }`}
                  >
                    {category.active ? "Active" : "Hidden"}
                  </span>
                </div>

                {category.nominees.length ? (
                  <ul className="divide-y divide-stone-100 dark:divide-[#18221b] text-xs text-stone-600 dark:text-stone-400">
                    {category.nominees.map((n) => (
                      <li key={n.id} className="py-2 flex items-center justify-between">
                        <span className="font-medium text-stone-800 dark:text-stone-200">{n.name}</span>
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

      {/* 2. Ticket Tiers & Capacity (Shown if ticketing or hybrid event) */}
      {hasTickets && (
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-stone-200/80 pb-2 dark:border-[#1c2721]">
            <h2 className="flex items-center gap-2 text-base font-serif font-bold text-stone-900 dark:text-white">
              <TicketIcon size={16} />
              <span>Admission Ticket Tiers &amp; Capacity ({(ticketTiers ?? []).length})</span>
            </h2>
            <span className="text-xs font-mono text-stone-500">
              {totalCapacity ? `${totalCapacity} Total Capacity` : "No capacity cap"}
            </span>
          </div>

          <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden shadow-xs dark:border-[#1c2721] dark:bg-[#0c120e]">
            {(ticketTiers ?? []).length > 0 ? (
              <table className="w-full text-left text-xs">
                <thead className="bg-stone-50 border-b border-stone-200 text-stone-600 font-bold uppercase tracking-wider dark:bg-[#121914] dark:border-[#1a251f] dark:text-stone-400">
                  <tr>
                    <th className="px-4 py-3">Tier Name</th>
                    <th className="px-4 py-3">Price</th>
                    <th className="px-4 py-3">Capacity</th>
                    <th className="px-4 py-3">Sold</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 dark:divide-[#18221b]">
                  {(ticketTiers ?? []).map((t: any) => (
                    <tr key={t.id} className="hover:bg-stone-50/50 dark:hover:bg-[#141d18]">
                      <td className="px-4 py-3 font-semibold text-stone-900 dark:text-white">{t.name}</td>
                      <td className="px-4 py-3 font-mono font-bold text-emerald-800 dark:text-emerald-400">
                        {t.price_minor === 0 ? "FREE" : `GH₵ ${(t.price_minor / 100).toFixed(2)}`}
                      </td>
                      <td className="px-4 py-3 font-mono text-stone-700 dark:text-stone-300">{t.capacity || "Unlimited"}</td>
                      <td className="px-4 py-3 font-mono text-stone-700 dark:text-stone-300">{t.sold_count}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            t.is_active
                              ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                              : "bg-stone-100 text-stone-500 dark:bg-stone-800 dark:text-stone-400"
                          }`}
                        >
                          {t.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="p-8 text-center text-xs text-stone-500 dark:text-stone-400">
                This event is configured for ticketing, but the organizer has not published ticket tiers yet.
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. Review Conversation & Organizer Feedback */}
      <EventReviewConversation eventId={eventId} />

      {/* 4. Danger Zone / Data Deletion */}
      <div className="pt-4">
        <DataDeletionPanel kind="event" targetId={eventId} role={role} />
      </div>
    </div>
  );
}
