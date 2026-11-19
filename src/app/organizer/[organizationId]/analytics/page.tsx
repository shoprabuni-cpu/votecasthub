import Link from "next/link";
import { requireVerifiedUser } from "@/lib/auth/require-user";
import { analyticsScope, categoryStandings, eventStage, type OrganizerAnalytics } from "@/lib/analytics";
import { DashboardHeader } from "@/components/dashboard-header";
import type { AnalyticsEventChoice } from "@/components/organizer/event-analytics-picker";
import { AnalyticsLiveStatus, ShareEventButton } from "@/components/organizer/analytics-live-status";
import { ReportsTabbedHub } from "@/components/organizer/reports-tabbed-hub";
import { EventSwitcher } from "@/components/organizer/event-switcher";
import { Icon } from "@/components/icon";
import type { TicketTier } from "@/lib/tickets/types";
import type { AttendeeRecord } from "@/lib/tickets/actions";

export default async function AnalyticsPage({
  params,
  searchParams,
}: {
  params: Promise<{ organizationId: string }>;
  searchParams: Promise<{ range?: string | string[]; event?: string | string[] }>;
}) {
  const { organizationId } = await params;
  const query = await searchParams;
  const { supabase } = await requireVerifiedUser();

  const { data: events, error: eventsError } = await supabase.rpc("get_organization_events", {
    p_organization_id: organizationId,
  });
  const choices = (events ?? []) as AnalyticsEventChoice[];

  const unavailable = (message: string) => (
    <main className="min-h-screen bg-stone-50/70 pb-16 text-stone-900 dark:bg-black dark:text-stone-100 transition-colors">
      <DashboardHeader organizationId={organizationId} />
      <section className="mx-auto max-w-xl px-4 py-20 text-center">
        <div className="rounded-3xl border border-stone-200 bg-white p-8 shadow-xs dark:border-[#1c2721] dark:bg-[#080b09]">
          <h1 className="text-xl font-serif font-bold text-stone-900">Let’s try that again.</h1>
          <p className="mt-2 text-xs text-stone-500">{message}</p>
          <Link
            className="mt-5 inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-800 hover:underline"
            href={`/organizer/${organizationId}/analytics`}
          >
            ← Back to events
          </Link>
        </div>
      </section>
    </main>
  );

  if (eventsError) return unavailable("We could not load your events. Please refresh and try again.");

  // Empty state if organizer has no events yet
  if (choices.length === 0) {
    return (
      <main className="min-h-screen bg-stone-50/70 pb-16 text-stone-900 dark:bg-black dark:text-stone-100 transition-colors">
        <DashboardHeader organizationId={organizationId} />
        <section className="mx-auto max-w-lg px-4 py-20 text-center">
          <div className="rounded-3xl border border-stone-200 bg-white p-8 shadow-xs dark:border-[#1c2721] dark:bg-[#080b09]">
            <span className="text-4xl">🏆</span>
            <h1 className="mt-4 text-2xl font-serif font-bold text-stone-900">
              No events found yet
            </h1>
            <p className="mt-2 text-xs text-stone-600 leading-relaxed">
              Create and publish your first election or awards event to start tracking live standings, voter turnout, and Mobile Money collections.
            </p>
            <Link
              className="mt-6 inline-flex items-center gap-1.5 rounded-xl bg-emerald-900 px-5 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-800 transition-all active:scale-95"
              href={`/organizer/${organizationId}/events/new`}
            >
              <span>+ Create an Event</span>
            </Link>
          </div>
        </section>
      </main>
    );
  }

  // Auto-select the best event if not specified in URL query
  const targetEventId =
    (typeof query.event === "string" && query.event ? query.event : null) ||
    choices.find((e) => ["published", "active"].includes(e.status))?.id ||
    choices.find((e) => e.status === "paused")?.id ||
    choices[0].id;

  let scope: ReturnType<typeof analyticsScope>;
  try {
    scope = analyticsScope({ range: query.range ?? "all", event: targetEventId });
  } catch {
    return unavailable("Please select a valid event and time period.");
  }

  const event = choices.find((choice) => choice.id === scope.event);
  if (!event) return unavailable("This event is not available in your workspace.");

  const [overall, activity, tiersRes, attendeesRes] = await Promise.all([
    supabase.rpc("get_scoped_organizer_analytics", { p_org: organizationId, p_event: event.id, p_days: 0 }),
    scope.days
      ? supabase.rpc("get_scoped_organizer_analytics", { p_org: organizationId, ...scope.params })
      : Promise.resolve(null),
    supabase
      .from("event_ticket_tiers")
      .select("id, event_id, name, price_minor, capacity, sold_count, is_active, sort_order, created_at, updated_at")
      .eq("event_id", event.id)
      .order("sort_order", { ascending: true }),
    supabase.rpc("get_event_attendees", { p_event_id: event.id }),
  ]);

  const { data, error } = overall;
  if (activity?.error || (activity && !activity.data)) {
    return unavailable("We could not load this activity period. Please try again.");
  }
  if (error || !data) {
    return unavailable("We could not load this event’s insights. Please try again shortly.");
  }

  const analytics = data as OrganizerAnalytics;
  const row = analytics.rows[0];
  if (!row) return unavailable("This event is no longer available.");

  const ticketTiers = (tiersRes?.data ?? []) as TicketTier[];
  const attendees = (attendeesRes?.data ?? []) as AttendeeRecord[];
  const isTicketing = event.event_type === "ticketing";
  const hasTickets = isTicketing || event.event_type === "hybrid" || ticketTiers.length > 0;

  // Ticketing Metrics
  const totalTicketCapacity = ticketTiers.reduce((acc, t) => acc + (Number(t.capacity) || 0), 0);
  const totalTicketsSold = attendees.reduce((acc, a) => acc + (Number(a.quantity) || 1), 0);
  const remainingAllowance = Math.max(0, totalTicketCapacity - totalTicketsSold);
  const totalCheckedIn = attendees
    .filter((a) => a.status === "checked_in" || !!a.checked_in_at)
    .reduce((acc, a) => acc + (Number(a.quantity) || 1), 0);
  const checkInRate = totalTicketsSold > 0 ? ((totalCheckedIn / totalTicketsSold) * 100).toFixed(1) : "0.0";
  const ticketRevenueGross = attendees.reduce((acc, a) => acc + (Number(a.price_minor) || 0), 0);
  const ticketRevenueNet = Math.round(ticketRevenueGross * 0.9);

  const standings = categoryStandings(analytics.nominees);
  const period = isTicketing ? "Passes & Attendee Admissions" : "Whole event";
  const requestTime = Date.parse(analytics.as_of);
  const stage = eventStage(event, requestTime);
  const ended = stage === "ended" || stage === "archived";
  const live = stage === "active" || stage === "upcoming" || stage === "paused" || Number(analytics.pending_payments) > 0;

  const stageLabel = isTicketing
    ? {
        active: "Ticket sales live",
        upcoming: "Ticket sales open soon",
        paused: "Ticket sales paused",
        ended: "Event ended / doors closed",
        archived: "Event archived",
        draft: "Preparing ticket tiers",
      }[stage]
    : {
        active: "Voting is open",
        upcoming: "Voting opens soon",
        paused: "Voting is paused",
        ended: "Voting ended",
        archived: "Event archived",
        draft: "Preparing for voting",
      }[stage];

  const eventTypeLabel = isTicketing
    ? "Ticketed Event & Gate Passes"
    : event.event_type === "hybrid"
    ? "Hybrid (Voting & Ticketing)"
    : event.voting_mode === "paid"
    ? "Paid MoMo / Card Ballot"
    : "Free Ballot";

  const lastVoteGhana = analytics.last_vote_at
    ? new Intl.DateTimeFormat("en-GH", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Africa/Accra",
      }).format(new Date(analytics.last_vote_at))
    : "No counted votes yet";

  const paid = event.voting_mode === "paid";
  const money = (amount: number) => `GH₵ ${(Number(amount) / 100).toFixed(2)}`;

  const safeNum = (v: unknown) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };

  const totalVotesCount = safeNum(row.total_votes);
  const visitorsCount = safeNum(analytics.event_visitors);
  const conversionRate = visitorsCount > 0 ? ((totalVotesCount / visitorsCount) * 100).toFixed(1) : "0.0";

  return (
    <main className="min-h-screen bg-stone-50/70 pb-28 text-stone-900 dark:bg-black dark:text-stone-100 transition-colors">
      <DashboardHeader organizationId={organizationId} />

      <section className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
        {/* Command Center Live Header */}
        <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-950 via-[#133c2e] to-emerald-950 p-6 sm:p-8 text-white shadow-sm space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-block h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                <p className="text-[11px] font-bold uppercase tracking-widest text-emerald-200">
                  Reports &amp; Live Standings
                </p>
              </div>
              <h1 className="mt-2 text-3xl sm:text-4xl font-serif font-bold tracking-tight text-white">
                {event.name}
              </h1>
              <p className="mt-2 text-xs sm:text-sm text-emerald-100/80">
                <span className="font-semibold text-white">{stageLabel}</span> · {period} · {eventTypeLabel}
              </p>
            </div>

            {/* Event Switcher & Settings */}
            <div className="flex flex-wrap items-center gap-2">
              <EventSwitcher choices={choices} activeId={event.id} days={scope.days} />

              <Link
                href={`/organizer/${organizationId}/events/${event.id}`}
                className="inline-flex items-center gap-1.5 rounded-xl border border-white/20 bg-white/10 px-3.5 py-2 text-xs font-semibold text-white shadow-xs backdrop-blur-sm hover:bg-white/20 transition-all active:scale-95"
              >
                <span>Event Settings</span>
                <Icon name="arrowRight" size={13} />
              </Link>
            </div>
          </div>

          <AnalyticsLiveStatus
            asOf={analytics.as_of}
            refresh={live}
            startsAt={event.starts_at}
            upcoming={stage === "upcoming"}
          />
        </div>

        {/* Pending Payments Alert if any */}
        {Number(analytics.pending_payments) > 0 && (
          <aside className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 dark:border-amber-900/60 dark:bg-amber-950/30">
            <div className="flex items-start gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-200 text-amber-900 font-bold text-xs dark:bg-amber-900 dark:text-amber-200">
                !
              </span>
              <div>
                <h2 className="font-semibold text-amber-950 dark:text-amber-200 text-sm">
                  {Number(analytics.pending_payments).toLocaleString()} Payments Awaiting Confirmation
                </h2>
                <p className="mt-0.5 text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
                  These payments are currently being processed by Paystack and will automatically count as confirmed votes as soon as settled.
                </p>
              </div>
            </div>
            <Link
              href={`/organizer/${organizationId}/payments`}
              className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-amber-900 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-800 transition-all dark:bg-amber-700 dark:hover:bg-amber-600"
            >
              <span>Inspect Transactions</span>
              <Icon name="arrowRight" size={13} />
            </Link>
          </aside>
        )}

        {/* Master KPI Row */}
        {isTicketing ? (
          /* Ticketing KPI Row */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Passes Issued */}
            <article className="rounded-2xl border border-stone-200/90 bg-white p-5 shadow-xs dark:border-[#1c2721] dark:bg-[#0c120e]">
              <span className="text-xs font-medium text-stone-500 dark:text-stone-400 block">Total Passes Issued</span>
              <strong className="mt-2 block text-3xl font-bold font-mono text-stone-900 dark:text-white">
                {totalTicketsSold.toLocaleString()}
              </strong>
              <p className="mt-2 text-[11px] text-stone-400 dark:text-stone-500">
                {totalTicketCapacity > 0
                  ? `${((totalTicketsSold / totalTicketCapacity) * 100).toFixed(1)}% of total capacity booked`
                  : "No capacity limit set"}
              </p>
            </article>

            {/* Gate Admissions */}
            <article className="rounded-2xl border border-stone-200/90 bg-white p-5 shadow-xs dark:border-[#1c2721] dark:bg-[#0c120e]">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-stone-500 dark:text-stone-400">Gate Admissions</span>
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              </div>
              <strong className="mt-2 block text-3xl font-bold font-mono text-emerald-800 dark:text-emerald-400">
                {totalCheckedIn.toLocaleString()}
              </strong>
              <p className="mt-2 text-[11px] text-stone-400 dark:text-stone-500">
                {checkInRate}% attendance rate at gate
              </p>
            </article>

            {/* Inventory Allowance Remaining */}
            <article className="rounded-2xl border border-stone-200/90 bg-white p-5 shadow-xs dark:border-[#1c2721] dark:bg-[#0c120e]">
              <span className="text-xs font-medium text-stone-500 dark:text-stone-400 block">Inventory Allowance Left</span>
              <strong className="mt-2 block text-3xl font-bold font-mono text-stone-900 dark:text-white">
                {remainingAllowance.toLocaleString()}
              </strong>
              <p className="mt-2 text-[11px] text-stone-400 dark:text-stone-500">
                Out of {totalTicketCapacity.toLocaleString()} max event seats
              </p>
            </article>

            {/* Net Payout Revenue */}
            <article className="rounded-2xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50/50 to-white p-5 shadow-xs dark:border-emerald-900/50 dark:from-emerald-950/30 dark:to-[#0c120e]">
              <span className="text-xs font-medium text-emerald-950 dark:text-emerald-300 block">Organizer Net Payout</span>
              <strong className="mt-2 block text-3xl font-bold font-mono text-emerald-900 dark:text-emerald-400">
                {money(ticketRevenueNet)}
              </strong>
              <p className="mt-2 text-[11px] text-stone-500 dark:text-stone-400">
                Gross: {money(ticketRevenueGross)} (10% platform fee)
              </p>
            </article>
          </div>
        ) : (
          /* Standard Voting KPI Row */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Votes */}
            <article className="rounded-2xl border border-stone-200/90 bg-white p-5 shadow-xs dark:border-[#1c2721] dark:bg-[#0c120e]">
              <span className="text-xs font-medium text-stone-500 dark:text-stone-400 block">Total Confirmed Ballots</span>
              <strong className="mt-2 block text-3xl font-bold font-mono text-stone-900 dark:text-white">
                {totalVotesCount.toLocaleString()}
              </strong>
              <p className="mt-2 text-[11px] text-stone-400 dark:text-stone-500">
                Latest: {lastVoteGhana}
              </p>
            </article>

            {/* Votes Today */}
            <article className="rounded-2xl border border-stone-200/90 bg-white p-5 shadow-xs dark:border-[#1c2721] dark:bg-[#0c120e]">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-stone-500 dark:text-stone-400">Votes Cast Today</span>
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              </div>
              <strong className="mt-2 block text-3xl font-bold font-mono text-emerald-800 dark:text-emerald-400">
                {safeNum(analytics.votes_today).toLocaleString()}
              </strong>
              <p className="mt-2 text-[11px] text-stone-400 dark:text-stone-500">Since midnight Accra GMT</p>
            </article>

            {/* Voter Conversion */}
            <article className="rounded-2xl border border-stone-200/90 bg-white p-5 shadow-xs dark:border-[#1c2721] dark:bg-[#0c120e]">
              <span className="text-xs font-medium text-stone-500 dark:text-stone-400 block">
                {stage === "upcoming" ? "Pre-Launch Traffic" : "Voter Conversion Rate"}
              </span>
              <strong className="mt-2 block text-3xl font-bold font-mono text-stone-900 dark:text-white">
                {stage === "upcoming" ? `${visitorsCount} Visits` : `${conversionRate}%`}
              </strong>
              <p className="mt-2 text-[11px] text-stone-400 dark:text-stone-500">
                {stage === "upcoming"
                  ? "Unique visitors previewing candidate profiles"
                  : `${visitorsCount.toLocaleString()} visitors (${safeNum(analytics.views).toLocaleString()} page views)`}
              </p>
            </article>

            {/* Earnings (if paid) or Roster count (if free) */}
            {paid ? (
              <article className="rounded-2xl border border-amber-200/80 bg-gradient-to-br from-amber-50/50 to-white p-5 shadow-xs dark:border-amber-900/50 dark:from-amber-950/30 dark:to-[#0c120e]">
                <span className="text-xs font-medium text-amber-950 dark:text-amber-300 block">Organizer Net Revenue</span>
                <strong className="mt-2 block text-3xl font-bold font-mono text-amber-900 dark:text-amber-400">
                  {money(row.net_minor)}
                </strong>
                <p className="mt-2 text-[11px] text-stone-500 dark:text-stone-400">
                  Gross: {money(row.gross_minor)} ({safeNum(row.paid_votes).toLocaleString()} paid votes)
                </p>
              </article>
            ) : (
              <article className="rounded-2xl border border-stone-200/90 bg-white p-5 shadow-xs dark:border-[#1c2721] dark:bg-[#0c120e]">
                <span className="text-xs font-medium text-stone-500 dark:text-stone-400 block">Contest Scope</span>
                <strong className="mt-2 block text-3xl font-bold font-mono text-stone-900 dark:text-white">
                  {analytics.nominees.length}
                </strong>
                <p className="mt-2 text-[11px] text-stone-400 dark:text-stone-500">
                  Nominees across {analytics.categories.length} award categories
                </p>
              </article>
            )}
          </div>
        )}

        {/* Action Prompt when starting out */}
        {(stage === "draft" || stage === "upcoming" || stage === "paused" || (!totalVotesCount && !totalTicketsSold)) && (
          <aside className="rounded-2xl border border-stone-200 bg-white p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 dark:border-[#1c2721] dark:bg-[#0c120e]">
            <div>
              <h2 className="font-semibold text-stone-900 dark:text-white text-sm">
                {stage === "draft"
                  ? isTicketing ? "Prepare your ticket tiers" : "Get your event ready"
                  : stage === "upcoming"
                  ? isTicketing ? "Ticket sales haven't started yet" : "Voting hasn’t started yet"
                  : stage === "paused"
                  ? isTicketing ? "Ticket sales are paused" : "Voting is paused"
                  : ended
                  ? isTicketing ? "Ticket sales have ended" : "No votes were counted"
                  : isTicketing ? "Share your event to sell tickets" : "Share to get your first votes"}
              </h2>
              <p className="mt-1 text-xs text-stone-500 dark:text-stone-400 leading-relaxed max-w-xl">
                {stage === "draft"
                  ? isTicketing
                    ? "Configure your VIP, Regular and Early Bird tiers and capacities before publishing."
                    : "Review your categories, nominees, and voting window in the Event Setup Studio before publishing."
                  : stage === "upcoming"
                  ? isTicketing
                    ? "Check tier pricing and share the event page with attendees ahead of the gate opening."
                    : "Check candidate profiles and share the public ballot link with voters ahead of opening time."
                  : stage === "paused"
                  ? "Resume the event from Event Settings whenever you are ready."
                  : ended
                  ? isTicketing
                    ? "Event has ended. Review final attendee admissions and check-in rates below."
                    : "Voting has officially closed. Review results and export certificates below."
                  : isTicketing
                  ? "Share your ticket booking link across WhatsApp and social media to start issuing passes."
                  : "Distribute your ballot flyer and link across WhatsApp and social media to start tracking results."}
              </p>
            </div>
            {stage === "draft" || stage === "paused" ? (
              <Link
                className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-emerald-900 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800 transition-all dark:bg-emerald-800 dark:hover:bg-emerald-700"
                href={`/organizer/${organizationId}/events/${event.id}`}
              >
                <span>Manage Event</span>
                <Icon name="arrowRight" size={13} />
              </Link>
            ) : (
              <ShareEventButton slug={event.slug} />
            )}
          </aside>
        )}

        {/* Tabbed Reports & Standings Hub */}
        <ReportsTabbedHub
          analytics={analytics}
          activityAnalytics={activity?.data as OrganizerAnalytics | null | undefined}
          event={event}
          organizationId={organizationId}
          standings={standings}
          days={scope.days}
          ended={ended}
          paid={paid}
          ticketTiers={ticketTiers}
          attendees={attendees}
        />
      </section>
    </main>
  );
}
