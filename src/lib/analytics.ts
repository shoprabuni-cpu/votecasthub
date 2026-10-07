import { z } from "zod";

export function analyticsScope(query: { range?: string | string[]; event?: string | string[] }) {
  const days = Number(z.enum(["all", "7", "30", "365"]).default("30").parse(query.range).replace("all", "0"));
  if (Array.isArray(query.event)) throw new Error("Only one event may be selected");
  const event = typeof query.event === "string" && query.event ? z.string().uuid().parse(query.event) : null;
  return { days, event, params: { p_event: event, p_days: days }, query: new URLSearchParams({ range: days === 0 ? "all" : String(days), ...(event ? { event } : {}) }).toString() };
}
export type EventAnalytics = { event_id: string; event_name: string; status: string; total_votes: number; paid_votes: number; gross_minor: number; refunded_minor: number; net_minor: number };
export type NomineeAnalytics = { nominee_id: string; nominee_name: string; event_id: string; event_name: string; category_id: string; category_name: string; total_votes: number; paid_votes: number };
export type CategoryAnalytics = { category_id: string; category_name: string; event_id: string; event_name: string; total_votes: number; paid_votes: number };
export type OrganizerAnalytics = {
  as_of: string; votes_today: number; last_vote_at: string | null; pending_payments: number;
  events: { event_id: string; event_name: string }[]; rows: EventAnalytics[]; nominees: NomineeAnalytics[]; categories: CategoryAnalytics[];
  trends: { day: string; total_votes: number; paid_votes: number; free_votes: number }[];
  revenue: { day: string; gross_minor: number; refunded_minor: number; net_minor: number }[];
  views: number; event_visitors: number;
};
export function categoryStandings(nominees: NomineeAnalytics[]) {
  const rows = [...nominees].sort((a, b) => a.event_id.localeCompare(b.event_id) || a.category_id.localeCompare(b.category_id) || Number(b.total_votes) - Number(a.total_votes) || a.nominee_id.localeCompare(b.nominee_id));
  let category = "", rank = 0, position = 0, lastVotes = -1;
  return rows.map(nominee => {
    if (category !== nominee.category_id) { category = nominee.category_id; position = 0; lastVotes = -1; }
    position++;
    if (Number(nominee.total_votes) !== lastVotes) rank = position;
    lastVotes = Number(nominee.total_votes);
    return { ...nominee, rank };
  });
}
export function csvValue(value: unknown) {
  const raw = String(value ?? "");
  const text = typeof value === "string" && /^\s*[=+@-]/.test(raw) ? `'${raw}` : raw;
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function eventStage(event: { status: string; starts_at: string; ends_at: string }, now: number) {
  if (event.status === "archived") return "archived";
  if (event.status === "draft") return "draft";
  if (event.status === "closed" || Date.parse(event.ends_at) <= now) return "ended";
  if (event.status === "paused") return "paused";
  return Date.parse(event.starts_at) > now ? "upcoming" : "active";
}

export function contestSummary(nominees: NomineeAnalytics[], ended: boolean) {
  const sorted = [...nominees].sort((a, b) => Number(b.total_votes) - Number(a.total_votes));
  const top = Number(sorted[0]?.total_votes ?? 0);
  if (!top) return "No counted votes yet.";
  const leaders = sorted.filter(row => Number(row.total_votes) === top);
  if (leaders.length > 1) return `${leaders.map(row => row.nominee_name).join(" & ")} are tied for first with ${top.toLocaleString()} votes each.`;
  if (sorted.length === 1) return `${sorted[0].nominee_name} has ${top.toLocaleString()} counted votes.`;
  const gap = top - Number(sorted[1].total_votes);
  return `${sorted[0].nominee_name} ${ended ? "is ahead" : "leads"} by ${gap.toLocaleString()} ${gap === 1 ? "vote" : "votes"}.${!ended && gap <= 10 ? " A close contest." : ""}`;
}

