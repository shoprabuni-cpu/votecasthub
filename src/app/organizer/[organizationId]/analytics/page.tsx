import Link from "next/link";
import { requireVerifiedUser } from "@/lib/auth/require-user";
import { analyticsScope, categoryStandings, eventStage, contestSummary, type OrganizerAnalytics } from "@/lib/analytics";
import { DashboardHeader } from "@/components/dashboard-header";
import { EventAnalyticsPicker, type AnalyticsEventChoice } from "@/components/organizer/event-analytics-picker";
import { AnalyticsVisuals } from "@/components/organizer/analytics-visuals";
import { AnalyticsLiveStatus, ShareEventButton } from "@/components/organizer/analytics-live-status";
import { AnalyticsRange } from "@/components/organizer/analytics-range";
import { ResultsExportActions } from "@/components/organizer/results-export-actions";

export default async function AnalyticsPage({ params, searchParams }: { params: Promise<{ organizationId: string }>; searchParams: Promise<{ range?: string | string[]; event?: string | string[] }> }) {
  const { organizationId } = await params;
  const query = await searchParams;
  const { supabase } = await requireVerifiedUser();
  // Load choices only on arrival. No analytics RPC runs until an event is chosen.
  const { data: events, error: eventsError } = await supabase.rpc("get_organization_events", { p_organization_id: organizationId });
  const choices = (events ?? []) as AnalyticsEventChoice[];
  const unavailable = (message: string) => <main className="dashboard-page"><DashboardHeader organizationId={organizationId} /><section className="mx-auto max-w-3xl px-6 py-20 text-center"><h1 className="text-2xl font-bold text-[#173d32]">Let’s try that again.</h1><p className="mt-3 text-slate-500">{message}</p><Link className="mt-5 inline-block text-green-800 underline" href={`/organizer/${organizationId}/analytics`}>Back to event selection</Link></section></main>;
  if (eventsError) return unavailable("We could not load your events. Please refresh and try again.");
  if (!query.event) return <main className="dashboard-page"><DashboardHeader organizationId={organizationId} /><EventAnalyticsPicker events={choices} organizationId={organizationId} /></main>;
  let scope: ReturnType<typeof analyticsScope>;
  try { scope = analyticsScope({ ...query, range: query.range ?? "all" }); } catch { return unavailable("Please select a valid event and time period."); }
  const event = choices.find(choice => choice.id === scope.event);
  if (!event) return unavailable("This event is not available in your workspace.");
  const [overall, activity] = await Promise.all([
    supabase.rpc("get_scoped_organizer_analytics", { p_org: organizationId, p_event: event.id, p_days: 0 }),
    scope.days ? supabase.rpc("get_scoped_organizer_analytics", { p_org: organizationId, ...scope.params }) : Promise.resolve(null),
  ]);
  const { data, error } = overall;
  if (activity?.error || (activity && !activity.data)) return unavailable("We could not load this activity period. Please try again.");
  if (error || !data) return unavailable("We could not load this event’s insights. Please try again shortly.");
  const analytics = data as OrganizerAnalytics;
  const row = analytics.rows[0];
  if (!row) return unavailable("This event is no longer available.");
  const standings = categoryStandings(analytics.nominees);
  const period = "Whole event";
  const requestTime = Date.parse(analytics.as_of);
  const stage = eventStage(event, requestTime);
  const ended = stage === "ended" || stage === "archived";
  const live = stage === "active" || stage === "upcoming" || stage === "paused" || Number(analytics.pending_payments) > 0;
  const stageLabel = { active: "Voting is open", upcoming: "Voting opens soon", paused: "Voting is paused", ended: "Voting ended", archived: "Event archived", draft: "Preparing for voting" }[stage];
  const lastVote = analytics.last_vote_at ? new Date(analytics.last_vote_at).toLocaleString("en-GB", { timeZone: "UTC", dateStyle: "medium", timeStyle: "short" }) + " UTC" : "No counted votes yet";
  const paid = event.voting_mode === "paid";
  const money = (amount: number) => `GHS ${(Number(amount) / 100).toFixed(2)}`;
  return <main className="dashboard-page"><DashboardHeader organizationId={organizationId} /><section className="mx-auto max-w-6xl space-y-7 px-4 py-8 sm:px-6">
    <div className="space-y-5 rounded-3xl bg-[#173d32] p-6 text-white sm:p-8"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs uppercase tracking-[.2em] text-[#d9e9c8]">Event insights</p><h1 className="mt-2 text-3xl font-bold">{event.name}</h1><p className="mt-3 text-sm text-green-100">{stageLabel} · {period}</p></div><Link href={`/organizer/${organizationId}/analytics`} className="rounded-full border border-white/30 px-4 py-2 text-sm">Choose another event</Link></div><AnalyticsLiveStatus asOf={analytics.as_of} refresh={live} startsAt={event.starts_at} upcoming={stage === "upcoming"} /></div>
    <div className="grid gap-4 sm:grid-cols-3">{[
      ["Votes counted", Number(row.total_votes).toLocaleString(), "Confirmed votes after any adjustments"],
      ["Votes today", Number(analytics.votes_today).toLocaleString(), "Counted since midnight UTC"],
      ["Event visitors", Number(analytics.event_visitors).toLocaleString(), `${Number(analytics.views).toLocaleString()} event page views`],
    ].map(([label, value, note]) => <article className="rounded-2xl border border-[#dce7dc] bg-white p-5" key={label}><p className="text-sm text-slate-500">{label}</p><strong className="mt-2 block text-3xl font-bold text-[#173d32]">{value}</strong><p className="mt-2 text-xs text-slate-500">{note}</p></article>)}</div>
    <p className="text-sm text-slate-500">Latest counted vote: {lastVote} · {analytics.nominees.length} nominees across {analytics.categories.length} categories</p>
    {Number(analytics.pending_payments) > 0 && <aside className="rounded-2xl border border-amber-200 bg-amber-50 p-5"><h2 className="font-semibold text-amber-900">{Number(analytics.pending_payments).toLocaleString()} payment attempts awaiting confirmation</h2><p className="mt-2 text-sm text-amber-900">These are not counted as votes. {ended ? "Standings may change if an outstanding payment is confirmed. Review them before announcing final results." : "Votes appear only after payment confirmation."}</p><Link href={`/organizer/${organizationId}/payments`} className="mt-3 inline-block text-sm underline">Review payments</Link></aside>}
    {(stage === "draft" || stage === "upcoming" || stage === "paused" || !Number(row.total_votes)) && <aside className="space-y-3 rounded-2xl border border-[#dce7dc] bg-[#f7faf4] p-5"><h2 className="font-semibold text-[#173d32]">{stage === "draft" ? "Get your event ready" : stage === "upcoming" ? "Voting hasn’t started yet" : stage === "paused" ? "Voting is paused" : ended ? "No votes were counted" : "Get your first votes"}</h2><p className="text-sm text-slate-600">{stage === "draft" ? "Review your categories, nominees and voting dates before publishing." : stage === "upcoming" ? "Check your nominees and share the event link ahead of opening." : stage === "paused" ? "Review the event settings when you are ready to resume voting." : ended ? "Check outstanding payments before sharing the results." : "Share your event with voters to start following the results."}</p>{stage === "draft" || stage === "paused" ? <Link className="text-sm text-green-800 underline" href={`/organizer/${organizationId}/events/${event.id}`}>Manage event</Link> : <ShareEventButton slug={event.slug} />}</aside>}
    <section><div className="mb-5"><h2 className="font-serif text-2xl text-[#173d32]">{ended ? "Category results" : "Who’s leading?"}</h2><p className="mt-2 text-sm text-slate-500">{ended ? "Voting has ended. Vote standings by category. Tied leaders share first place." : "Whole-event standings by category. Results can change while voting is open."}</p></div>
      <div className="space-y-5">{analytics.categories.map(category => {
        const nominees = standings.filter(nominee => nominee.category_id === category.category_id);
        const leaderVotes = Number(nominees[0]?.total_votes ?? 0);
        const leaders = nominees.filter(nominee => Number(nominee.total_votes) === leaderVotes && leaderVotes > 0);
        return <article key={category.category_id} className="overflow-hidden rounded-2xl border border-[#dce7dc] bg-white"><div className="border-b border-[#edf1e9] bg-[#f7faf4] p-5"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-lg font-bold text-[#173d32]">{category.category_name}</h3><span className="text-sm text-slate-500">{Number(category.total_votes).toLocaleString()} votes</span></div>{leaders.length ? <p className="mt-3 text-[#1e704d]"><span aria-hidden="true">✦ </span><strong>{leaders.map(leader => leader.nominee_name).join(" & ")}</strong><span className="text-sm"> · {leaders.length > 1 ? "Tied for first" : ended ? "Highest votes" : "Leading"}</span></p> : <p className="mt-3 text-sm text-slate-500">No votes yet. The first vote starts the story.</p>}{leaders.length > 0 && <p className="mt-2 text-sm text-slate-600">{contestSummary(nominees, ended)}</p>}</div>
          {nominees.length ? <div className="overflow-x-auto"><table className="w-full text-left text-sm"><caption className="sr-only">{category.category_name} standings · {period}</caption><thead className="text-xs text-slate-500"><tr><th className="px-5 py-3">Position</th><th className="px-5 py-3">Nominee</th><th className="px-5 py-3">Votes</th><th className="px-5 py-3">Share</th><th className="px-5 py-3">Behind first</th></tr></thead><tbody>{nominees.map(nominee => <tr key={nominee.nominee_id} className="border-t border-slate-100"><td className="px-5 py-4 font-bold text-[#1e704d]">{leaderVotes > 0 ? `#${nominee.rank}` : "—"}</td><td className="min-w-40 px-5 py-4 font-semibold">{nominee.nominee_name}</td><td className="px-5 py-4">{Number(nominee.total_votes).toLocaleString()}</td><td className="px-5 py-4">{Number(category.total_votes) ? `${(Number(nominee.total_votes) / Number(category.total_votes) * 100).toFixed(1)}%` : "—"}</td><td className="px-5 py-4">{leaderVotes > 0 ? (leaderVotes - Number(nominee.total_votes)).toLocaleString() : "—"}</td></tr>)}</tbody></table></div> : <p className="p-5 text-sm text-slate-500">Add nominees to this category to get started.</p>}
        </article>;
      })}</div>{!analytics.categories.length && <p className="rounded-2xl bg-white p-6 text-slate-500">Add categories and nominees to this event to start following the results.</p>}
    </section>
    <details open={scope.days > 0} className="rounded-2xl border border-[#dce7dc] bg-white p-5"><summary className="cursor-pointer font-semibold text-[#173d32]">Explore voting activity</summary><div className="mt-5 space-y-5"><AnalyticsRange days={scope.days} event={event.id} /><p className="text-xs text-slate-500">This filter changes the activity chart only. Main standings and earnings always cover the whole event.</p><AnalyticsVisuals data={(activity?.data as OrganizerAnalytics | undefined) ?? analytics} days={scope.days} /></div></details>
    {paid && <details className="rounded-2xl border border-[#dce7dc] bg-white p-5"><summary className="cursor-pointer font-semibold text-[#173d32]">Event earnings · {money(row.net_minor)}</summary><div className="mt-4 grid gap-4 sm:grid-cols-3">{[["Collected", row.gross_minor], ["Refunded", row.refunded_minor], ["Your earnings", row.net_minor]].map(([label, value]) => <div key={label}><p className="text-sm text-slate-500">{label}</p><strong>{money(Number(value))}</strong></div>)}</div><p className="mt-4 text-xs text-slate-500">Earnings after platform fees and refunds. This is not a payout balance.</p><Link className="mt-4 inline-block text-sm text-green-800 underline" href={`/organizer/${organizationId}/payments`}>Manage payments</Link></details>}
    <details className="rounded-2xl border border-[#dce7dc] bg-white p-5"><summary className="cursor-pointer font-semibold text-[#173d32]">Save or share these results</summary><div className="mt-4"><ResultsExportActions nominees={analytics.nominees} scopeLabel={`${event.name} · ${period}`} /></div></details>
  </section></main>;
}




