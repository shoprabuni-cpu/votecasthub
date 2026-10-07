export function AnalyticsRange({ days, event, events }: { days: number; event: string | null; events: { event_id: string; event_name: string }[] }) {
  return <form className="flex flex-wrap items-center gap-2" method="get">
    <label className="sr-only" htmlFor="analytics-event">Event</label>
    <select id="analytics-event" name="event" defaultValue={event ?? ""} className="max-w-64 rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-sm text-white">
      <option className="text-slate-900" value="" disabled>Choose an event</option>
      {events.map(row => <option className="text-slate-900" key={row.event_id} value={row.event_id}>{row.event_name}</option>)}
    </select>
    <label className="sr-only" htmlFor="analytics-range">Date range</label>
    <select id="analytics-range" name="range" defaultValue={days === 0 ? "all" : String(days)} className="rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-sm text-white">
      <option className="text-slate-900" value="all">Whole event</option>
      <option className="text-slate-900" value="7">Last 7 days</option><option className="text-slate-900" value="30">Last 30 days</option><option className="text-slate-900" value="365">Last 365 days</option>
    </select>
    <button className="rounded-xl bg-[#f07b4f] px-4 py-2 text-sm font-bold text-white" type="submit">Update</button>
  </form>;
}
