"use client";
import { useEffect, useRef, useState } from "react";
import { PublicEventCard } from "./public-event-card";
import { directoryFilters, type DirectoryFilters, type EventDirectoryPage } from "@/lib/events/directory";

const defaults = directoryFilters.parse({});
const control = "min-h-11 w-full rounded-xl border border-stone-300 bg-white px-3 text-sm text-stone-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700";

export function EventBrowser({ initialPage, unavailable = false }: { initialPage: EventDirectoryPage; unavailable?: boolean }) {
  const [filters, setFilters] = useState(defaults);
  const [page, setPage] = useState(initialPage);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(unavailable ? "Events are temporarily unavailable. Please try again." : "");
  const [retry, setRetry] = useState(0);
  const request = useRef<AbortController | null>(null);
  const firstLoad = useRef(true);
  const key = JSON.stringify(filters);
  const initialKey = JSON.stringify(defaults);

  useEffect(() => {
    if (firstLoad.current) {
      firstLoad.current = false;
      if (key === initialKey && retry === 0) return;
    }
    const controller = new AbortController();
    request.current?.abort();
    request.current = controller;
    const timer = setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(`/api/events?${new URLSearchParams(Object.entries(JSON.parse(key)).map(([k, v]) => [k, String(v)]))}`, { signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Unable to load events.");
        if (!controller.signal.aborted) setPage(data);
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Unable to load events.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [key, initialKey, retry]);

  useEffect(() => () => request.current?.abort(), []);

  async function loadMore() {
    const controller = new AbortController();
    request.current?.abort();
    request.current = controller;
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams(Object.entries({ ...filters, offset: page.events.length }).map(([k, v]) => [k, String(v)]));
      const response = await fetch(`/api/events?${params}`, { signal: controller.signal });
      const data: EventDirectoryPage & { error?: string } = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to load more events.");
      if (!controller.signal.aborted) setPage(previous => ({ ...data, events: [...previous.events, ...data.events.filter(event => !previous.events.some(existing => existing.id === event.id))] }));
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Unable to load more events.");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }

  function update(name: keyof DirectoryFilters, value: string) {
    request.current?.abort();
    setLoading(true);
    setFilters(previous => directoryFilters.parse({ ...previous, [name]: value, offset: 0 }));
  }

  return <section id="events" className="mx-auto w-full max-w-[1800px] px-3 py-8 sm:px-6 lg:px-8 lg:py-12" aria-labelledby="event-directory-title">
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div><p className="mb-1 text-xs font-semibold uppercase tracking-widest text-emerald-800">Discover events</p><h2 id="event-directory-title" className="text-2xl font-semibold text-stone-900 sm:text-3xl">Find your next favourite.</h2></div>
      <p className="text-sm text-stone-600" role="status" aria-live="polite">{loading ? "Loading events…" : `${page.total} matching ${page.total === 1 ? "event" : "events"}`}</p>
    </div>
    <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-[2fr_1fr_1fr_1fr]" aria-label="Filter events">
      <label className="col-span-2 lg:col-span-1"><span className="mb-1 block text-xs font-semibold text-stone-600">Search</span><input className={control} type="search" maxLength={120} placeholder="Event or organizer" value={filters.search} onChange={event => update("search", event.target.value)} /></label>
      <label><span className="mb-1 block text-xs font-semibold text-stone-600">Status</span><select className={control} value={filters.status} onChange={event => update("status", event.target.value)}>
        <option value="active">Live & upcoming</option><option value="all">All events</option><option value="open">Voting open</option><option value="upcoming">Upcoming</option><option value="ending">Ends within 48 hours</option><option value="paused">Paused</option><option value="closed">Voting ended</option>
      </select></label>
      <label><span className="mb-1 block text-xs font-semibold text-stone-600">Voting type</span><select className={control} value={filters.mode} onChange={event => update("mode", event.target.value)}><option value="all">Free & paid</option><option value="free">Free voting</option><option value="paid">Paid voting</option></select></label>
      <label className="col-span-2 lg:col-span-1"><span className="mb-1 block text-xs font-semibold text-stone-600">Sort</span><select className={control} value={filters.sort} onChange={event => update("sort", event.target.value)}><option value="soonest">Voting soonest</option><option value="newest">Newest events</option><option value="name">Name A–Z</option></select></label>
    </div>
    {error && <div role="alert" className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">{error} <button type="button" className="min-h-11 px-3 font-semibold underline" onClick={() => setRetry(value => value + 1)}>Try again</button></div>}
    <div aria-busy={loading} className="grid grid-cols-2 items-stretch gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
      {page.events.map(event => <PublicEventCard event={event} now={page.now} key={event.id} />)}
    </div>
    {!page.events.length && !loading && !error && <div className="rounded-2xl border border-dashed border-stone-300 p-8 text-center"><h3 className="text-lg font-semibold">No matching events</h3><p className="mt-2 text-sm text-stone-600">Try another search or clear the filters.</p><button type="button" className="mt-3 min-h-11 rounded-xl bg-emerald-800 px-5 text-sm font-semibold text-white" onClick={() => { setFilters(defaults); setRetry(value => value + 1); }}>Clear filters</button></div>}
    {page.events.length < page.total && <div className="mt-6 text-center"><p className="mb-3 text-xs text-stone-600">Showing {page.events.length} of {page.total} events</p><button type="button" disabled={loading} onClick={loadMore} className="min-h-11 rounded-xl bg-emerald-800 px-7 text-sm font-semibold text-white hover:bg-emerald-900 disabled:opacity-50">{loading ? "Loading…" : "Load more events"}</button></div>}
  </section>;
}
