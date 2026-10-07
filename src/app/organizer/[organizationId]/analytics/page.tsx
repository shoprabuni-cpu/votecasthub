import Link from "next/link";
import { requireVerifiedUser } from "@/lib/auth/require-user";
import { analyticsScope, categoryStandings, eventStage, type OrganizerAnalytics } from "@/lib/analytics";
import { DashboardHeader } from "@/components/dashboard-header";
import { EventAnalyticsPicker, type AnalyticsEventChoice } from "@/components/organizer/event-analytics-picker";
import { AnalyticsVisuals } from "@/components/organizer/analytics-visuals";
import { AnalyticsLiveStatus, ShareEventButton } from "@/components/organizer/analytics-live-status";
import { AnalyticsRange } from "@/components/organizer/analytics-range";
import { ResultsExportActions } from "@/components/organizer/results-export-actions";
import { CategoryLeaderboardStudio } from "@/components/organizer/category-leaderboard-studio";
import { Icon } from "@/components/icon";

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
    <main className="min-h-screen bg-stone-50/70 pb-16">
      <DashboardHeader organizationId={organizationId} />
      <section className="mx-auto max-w-xl px-4 py-20 text-center">
        <div className="rounded-3xl border border-stone-200 bg-white p-8 shadow-xs">
          <h1 className="text-xl font-serif font-bold text-stone-900">Let’s try that again.</h1>
          <p className="mt-2 text-xs text-stone-500">{message}</p>
          <Link
            className="mt-5 inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-800 hover:underline"
            href={`/organizer/${organizationId}/analytics`}
          >
            ← Back to event selection
          </Link>
        </div>
      </section>
    </main>
  );

  if (eventsError) return unavailable("We could not load your events. Please refresh and try again.");
  if (!query.event) {
    return (
      <main className="min-h-screen bg-stone-50/70 pb-16">
        <DashboardHeader organizationId={organizationId} />
        <EventAnalyticsPicker events={choices} organizationId={organizationId} />
      </main>
    );
  }

  let scope: ReturnType<typeof analyticsScope>;
  try {
    scope = analyticsScope({ ...query, range: query.range ?? "all" });
  } catch {
    return unavailable("Please select a valid event and time period.");
  }

  const event = choices.find((choice) => choice.id === scope.event);
  if (!event) return unavailable("This event is not available in your workspace.");

  const [overall, activity] = await Promise.all([
    supabase.rpc("get_scoped_organizer_analytics", { p_org: organizationId, p_event: event.id, p_days: 0 }),
    scope.days
      ? supabase.rpc("get_scoped_organizer_analytics", { p_org: organizationId, ...scope.params })
      : Promise.resolve(null),
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

  const standings = categoryStandings(analytics.nominees);
  const period = "Whole event";
  const requestTime = Date.parse(analytics.as_of);
  const stage = eventStage(event, requestTime);
  const ended = stage === "ended" || stage === "archived";
  const live = stage === "active" || stage === "upcoming" || stage === "paused" || Number(analytics.pending_payments) > 0;

  const stageLabel = {
    active: "Voting is open",
    upcoming: "Voting opens soon",
    paused: "Voting is paused",
    ended: "Voting ended",
    archived: "Event archived",
    draft: "Preparing for voting",
  }[stage];

  const lastVoteGhana = analytics.last_vote_at
    ? new Intl.DateTimeFormat("en-GH", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Africa/Accra",
      }).format(new Date(analytics.last_vote_at))
    : "No counted votes yet";

  const paid = event.voting_mode === "paid";
  const money = (amount: number) => `GH₵ ${(Number(amount) / 100).toFixed(2)}`;

  // Safe number helper to prevent NaN in edge cases
  const safeNum = (v: unknown) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };

  // Product Intelligence metrics
  const totalVotesCount = safeNum(row.total_votes);
  const visitorsCount = safeNum(analytics.event_visitors);
  const conversionRate = visitorsCount > 0 ? ((totalVotesCount / visitorsCount) * 100).toFixed(1) : "0.0";

  return (
    <main className="min-h-screen bg-stone-50/70 pb-28 text-stone-900">
      <DashboardHeader organizationId={organizationId} />

      <section className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-6">
        {/* Command Center Live Header */}
        <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-950 via-[#133c2e] to-emerald-950 p-6 sm:p-8 text-white shadow-sm space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-block h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                <p className="text-[11px] font-bold uppercase tracking-widest text-emerald-200">
                  Event Intelligence & Analytics
                </p>
              </div>
              <h1 className="mt-2 text-3xl sm:text-4xl font-serif font-bold tracking-tight text-white">
                {event.name}
              </h1>
              <p className="mt-2 text-xs sm:text-sm text-emerald-100/80">
                <span className="font-semibold text-white">{stageLabel}</span> · {period} · {event.voting_mode === "paid" ? "Paid MoMo/Card ballot" : "Free ballot"}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Link
                href={`/organizer/${organizationId}/analytics`}
                className="rounded-xl border border-white/20 bg-white/10 px-3.5 py-2 text-xs font-semibold text-white hover:bg-white/20 transition-all active:scale-95"
              >
                Switch Event ↺
              </Link>
              <Link
                href={`/organizer/${organizationId}/events/${event.id}`}
                className="rounded-xl bg-white px-3.5 py-2 text-xs font-semibold text-emerald-950 hover:bg-stone-100 transition-all active:scale-95"
              >
                Manage Event Settings →
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
          <aside className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-200 text-amber-900 font-bold text-xs">
                !
              </span>
              <div>
                <h2 className="font-semibold text-amber-950 text-sm">
                  {Number(analytics.pending_payments).toLocaleString()} Payment Attempts Awaiting Confirmation
                </h2>
                <p className="mt-0.5 text-xs text-amber-800 leading-relaxed">
                  These payments are currently processing via Paystack and are not yet counted as confirmed votes. Standings update immediately upon webhook clearance.
                </p>
              </div>
            </div>
            <Link
              href={`/organizer/${organizationId}/payments`}
              className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-amber-900 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-800 transition-all"
            >
              <span>Inspect Transactions</span>
              <Icon name="arrowRight" size={13} />
            </Link>
          </aside>
        )}

        {/* Master KPI Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Votes */}
          <article className="rounded-2xl border border-stone-200/90 bg-white p-5 shadow-xs">
            <span className="text-xs font-medium text-stone-500 block">Total Confirmed Ballots</span>
            <strong className="mt-2 block text-3xl font-bold font-mono text-stone-900">
              {totalVotesCount.toLocaleString()}
            </strong>
            <p className="mt-2 text-[11px] text-stone-400">
              Latest: {lastVoteGhana}
            </p>
          </article>

          {/* Votes Today */}
          <article className="rounded-2xl border border-stone-200/90 bg-white p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-stone-500">Votes Cast Today</span>
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
            </div>
            <strong className="mt-2 block text-3xl font-bold font-mono text-emerald-800">
              {safeNum(analytics.votes_today).toLocaleString()}
            </strong>
            <p className="mt-2 text-[11px] text-stone-400">Since midnight Accra GMT</p>
          </article>

          {/* Voter Conversion */}
          <article className="rounded-2xl border border-stone-200/90 bg-white p-5 shadow-xs">
            <span className="text-xs font-medium text-stone-500 block">Voter Conversion Rate</span>
            <strong className="mt-2 block text-3xl font-bold font-mono text-stone-900">
              {conversionRate}%
            </strong>
            <p className="mt-2 text-[11px] text-stone-400">
              {visitorsCount.toLocaleString()} visitors ({safeNum(analytics.views).toLocaleString()} page views)
            </p>
          </article>

          {/* Earnings (if paid) or Roster count (if free) */}
          {paid ? (
            <article className="rounded-2xl border border-amber-200/80 bg-gradient-to-br from-amber-50/50 to-white p-5 shadow-xs">
              <span className="text-xs font-medium text-amber-950 block">Organizer Net Revenue</span>
              <strong className="mt-2 block text-3xl font-bold font-mono text-amber-900">
                {money(row.net_minor)}
              </strong>
              <p className="mt-2 text-[11px] text-stone-500">
                Gross: {money(row.gross_minor)} ({safeNum(row.paid_votes).toLocaleString()} paid votes)
              </p>
            </article>
          ) : (
            <article className="rounded-2xl border border-stone-200/90 bg-white p-5 shadow-xs">
              <span className="text-xs font-medium text-stone-500 block">Contest Scope</span>
              <strong className="mt-2 block text-3xl font-bold font-mono text-stone-900">
                {analytics.nominees.length}
              </strong>
              <p className="mt-2 text-[11px] text-stone-400">
                Nominees across {analytics.categories.length} award categories
              </p>
            </article>
          )}
        </div>

        {/* Action Prompt when starting out */}
        {(stage === "draft" || stage === "upcoming" || stage === "paused" || !totalVotesCount) && (
          <aside className="rounded-2xl border border-stone-200 bg-white p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="font-semibold text-stone-900 text-sm">
                {stage === "draft"
                  ? "Get your event ready"
                  : stage === "upcoming"
                  ? "Voting hasn’t started yet"
                  : stage === "paused"
                  ? "Voting is paused"
                  : ended
                  ? "No votes were counted"
                  : "Share to get your first votes"}
              </h2>
              <p className="mt-1 text-xs text-stone-500 leading-relaxed max-w-xl">
                {stage === "draft"
                  ? "Review your categories, nominees, and voting window in the Event Setup Studio before publishing."
                  : stage === "upcoming"
                  ? "Check candidate profiles and share the public ballot link with voters ahead of opening time."
                  : stage === "paused"
                  ? "Resume the event from Event Settings whenever you are ready."
                  : ended
                  ? "Voting has officially closed. Review results and export certificates below."
                  : "Distribute your ballot flyer and link across WhatsApp and social media to start tracking results."}
              </p>
            </div>
            {stage === "draft" || stage === "paused" ? (
              <Link
                className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-emerald-900 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800 transition-all"
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

        {/* Section 1: Voting Activity & Trends (Uncollapsed & Front-and-Center!) */}
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
                Trend Analysis
              </span>
              <h2 className="text-2xl font-serif font-bold text-stone-900 tracking-tight">
                Voting Activity & Velocity
              </h2>
            </div>
            <AnalyticsRange days={scope.days} event={event.id} />
          </div>

          <AnalyticsVisuals
            data={(activity?.data as OrganizerAnalytics | undefined) ?? analytics}
            days={scope.days}
          />
        </section>

        {/* Section 2: Category Leaderboard Studio */}
        <section className="space-y-4">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
              The Podium
            </span>
            <h2 className="text-2xl font-serif font-bold text-stone-900 tracking-tight">
              {ended ? "Final Category Standings" : "Who’s Leading Right Now?"}
            </h2>
            <p className="text-xs text-stone-500 mt-1">
              {ended
                ? "Official final standings by category. Tied leaders share first place."
                : "Real-time leaderboard standings. Rankings adjust automatically as new ballots arrive."}
            </p>
          </div>

          <CategoryLeaderboardStudio
            categories={analytics.categories}
            standings={standings}
            ended={ended}
          />
        </section>

        {/* Section 3: Financial & Monetization Details (if paid) */}
        {paid && (
          <section className="rounded-3xl border border-stone-200/90 bg-white p-6 sm:p-8 shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-100 pb-5">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800">
                  Paystack Monetization
                </span>
                <h3 className="text-xl font-serif font-bold text-stone-900 tracking-tight">
                  Event Earnings & Settlement Breakdown
                </h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  Direct Mobile Money (MTN, Telecel, AT) and Card receipts processed for {event.name}.
                </p>
              </div>

              <Link
                href={`/organizer/${organizationId}/payments`}
                className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3.5 py-2 text-xs font-semibold text-stone-800 hover:border-emerald-600 transition-all"
              >
                <span>Payout Accounts & Settlement →</span>
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="rounded-2xl border border-stone-200 bg-stone-50/50 p-4">
                <span className="text-xs text-stone-500 font-medium">Gross Collected</span>
                <p className="mt-1 text-2xl font-bold font-mono text-stone-900">{money(row.gross_minor)}</p>
                <span className="text-[10px] text-stone-400">Total voter payments before fees</span>
              </div>

              <div className="rounded-2xl border border-stone-200 bg-stone-50/50 p-4">
                <span className="text-xs text-stone-500 font-medium">Refunded Amount</span>
                <p className="mt-1 text-2xl font-bold font-mono text-stone-600">{money(row.refunded_minor)}</p>
                <span className="text-[10px] text-stone-400">Any processed refunds</span>
              </div>

              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/30 p-4">
                <span className="text-xs text-emerald-900 font-medium">Your Net Payout Earnings</span>
                <p className="mt-1 text-2xl font-bold font-mono text-emerald-900">{money(row.net_minor)}</p>
                <span className="text-[10px] text-emerald-700">Earnings after platform processing fees</span>
              </div>
            </div>
          </section>
        )}

        {/* Section 4: Export & Certified Results Center */}
        <section className="rounded-3xl border border-stone-200/90 bg-gradient-to-br from-stone-50 via-white to-stone-50 p-6 sm:p-8 shadow-xs space-y-4">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
              Certified Exports
            </span>
            <h3 className="text-xl font-serif font-bold text-stone-900 tracking-tight">
              Export Official Standings & Sponsor Reports
            </h3>
            <p className="text-xs text-stone-500">
              Download raw tabular data or generate high-resolution standings graphics for ceremony presentations.
            </p>
          </div>

          <ResultsExportActions
            nominees={analytics.nominees}
            scopeLabel={`${event.name} · ${period}`}
          />
        </section>
      </section>
    </main>
  );
}
