import Link from "next/link";

export type AnalyticsEventChoice = { id: string; name: string; status: string; voting_mode: string; starts_at: string; ends_at: string };

export function EventAnalyticsPicker({ events, organizationId }: { events: AnalyticsEventChoice[]; organizationId: string }) {
  return <section className="event-insights-welcome mx-auto max-w-4xl px-5 py-12 sm:py-20">
    <div className="event-insights-emblem" aria-hidden="true"><div className="event-insights-orbit" /><svg viewBox="0 0 100 100" fill="none"><rect x="20" y="20" width="60" height="64" rx="16" fill="#173d32" /><path d="M35 36h30" stroke="#a9ceac" strokeWidth="5" strokeLinecap="round" /><rect className="event-insights-bar" x="32" y="58" width="8" height="14" rx="3" fill="#c9a45c" /><rect className="event-insights-bar" x="46" y="48" width="8" height="24" rx="3" fill="#d9e9c8" /><rect className="event-insights-bar" x="60" y="40" width="8" height="32" rx="3" fill="#7dbb92" /></svg><span className="event-insights-spark">✦</span></div>
    <p className="mt-7 text-center text-xs font-bold uppercase tracking-[.22em] text-[#1e704d]">Your event, in focus</p>
    <h1 className="mt-3 text-center font-serif text-4xl tracking-tight text-[#173d32] sm:text-5xl">Every vote tells a story.</h1>
    <p className="mx-auto mt-4 max-w-md text-center leading-7 text-slate-500">Choose an event to follow the votes, see who’s leading, and explore each category.</p>
    {events.length ? <div className="mx-auto mt-9 max-w-lg"><form method="get" className="rounded-2xl border border-[#dce7dc] bg-white p-5 shadow-sm"><label className="mb-2 block text-sm font-semibold text-[#173d32]" htmlFor="choose-analytics-event">Which event would you like to explore?</label><input type="hidden" name="range" value="all" /><select required defaultValue="" name="event" id="choose-analytics-event" className="w-full rounded-xl border border-slate-200 bg-[#fafbf8] px-4 py-3"><option value="" disabled>Select your event</option>{events.map(event => <option key={event.id} value={event.id}>{event.name} · {event.status}</option>)}</select><button className="mt-4 w-full rounded-xl bg-[#1e704d] px-5 py-3 font-semibold text-white transition hover:bg-[#173d32]" type="submit">Explore event →</button></form><p className="mt-4 text-center text-xs text-slate-400">One event at a time. A clearer picture every time.</p></div> : <div className="mt-8 text-center"><p className="text-slate-500">Your first event’s story starts here.</p><Link className="mt-4 inline-block rounded-xl bg-[#1e704d] px-6 py-3 font-semibold text-white" href={`/organizer/${organizationId}/events/new`}>Create your first event</Link></div>}
  </section>;
}

