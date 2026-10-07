export function AnalyticsRange({ days, event }: { days: number; event: string | null }) {
  return <form className="flex flex-wrap items-center gap-2" method="get">
    <input type="hidden" name="event" value={event ?? ""} />
    <label className="text-sm text-slate-600" htmlFor="analytics-range">Activity period</label>
    <select id="analytics-range" name="range" defaultValue={days === 0 ? "all" : String(days)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900">
      <option value="all">Whole event</option><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="365">Last 365 days</option>
    </select>
    <button className="rounded-xl bg-[#1e704d] px-4 py-2 text-sm font-bold text-white" type="submit">Explore</button>
  </form>;
}
