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
