"use client";
import { useEffect, useRef, useState } from "react";
import { PublicEventCard } from "./public-event-card";
import { directoryFilters, type DirectoryFilters, type EventDirectoryPage } from "@/lib/events/directory";

const defaults = directoryFilters.parse({});
const control = "min-h-12 w-full min-w-0 rounded-xl border border-stone-200 bg-white px-3.5 text-sm text-stone-800 shadow-sm transition placeholder:text-stone-400 hover:border-stone-300 focus:border-emerald-700 focus:outline-none focus:ring-4 focus:ring-emerald-700/10";

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

  const hasFilters = filters.search !== defaults.search || filters.status !== defaults.status || filters.mode !== defaults.mode || filters.sort !== defaults.sort;
  function resetFilters() {
    request.current?.abort();
    setLoading(true);
    setFilters(defaults);
    setRetry(value => value + 1);
  }

  return <section id="events" className="mx-auto w-full max-w-[1800px] px-3 py-8 sm:px-6 lg:px-8 lg:py-12" aria-labelledby="event-directory-title">
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div><p className="mb-1 text-xs font-semibold uppercase tracking-widest text-emerald-800">Discover events</p><h2 id="event-directory-title" className="text-2xl font-semibold text-stone-900 sm:text-3xl">Find your next favourite.</h2></div>
      <p className="text-sm text-stone-600" role="status" aria-live="polite">{loading ? "Loading events…" : `${page.total} matching ${page.total === 1 ? "event" : "events"}`}</p>
    </div>
    <div className="mb-7 rounded-2xl border border-stone-200 bg-stone-50/80 p-4 sm:p-5 lg:p-6" role="group" aria-label="Filter events">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div><h3 className="text-sm font-semibold text-stone-900">Filter events</h3><p className="mt-0.5 text-xs text-stone-500">Search by name, then narrow by status or voting type.</p></div>
        {hasFilters && <button type="button" onClick={resetFilters} className="min-h-10 rounded-lg px-3 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-50 focus-visible:outline-2 focus-visible:outline-emerald-700">Clear filters</button>}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-12 lg:gap-4">
        <label className="col-span-2 lg:col-span-4"><span className="mb-1.5 block text-xs font-semibold text-stone-700">Search</span><input aria-label="Search events or organizers" className={control} type="search" maxLength={120} placeholder="Event or organizer name" value={filters.search} onChange={event => update("search", event.target.value)} /></label>
        <label className="col-span-1 lg:col-span-3"><span className="mb-1.5 block text-xs font-semibold text-stone-700">Event status</span><select className={control} value={filters.status} onChange={event => update("status", event.target.value)}>
          <option value="active">Live & upcoming</option><option value="all">All events</option><option value="open">Voting open</option><option value="upcoming">Upcoming</option><option value="ending">Ends within 48 hours</option><option value="paused">Paused</option><option value="closed">Voting ended</option>
        </select></label>
        <label className="col-span-1 lg:col-span-2"><span className="mb-1.5 block text-xs font-semibold text-stone-700">Voting type</span><select className={control} value={filters.mode} onChange={event => update("mode", event.target.value)}><option value="all">Free & paid</option><option value="free">Free voting</option><option value="paid">Paid voting</option></select></label>
        <label className="col-span-2 lg:col-span-3"><span className="mb-1.5 block text-xs font-semibold text-stone-700">Sort by</span><select className={control} value={filters.sort} onChange={event => update("sort", event.target.value)}><option value="soonest">Live & upcoming first</option><option value="newest">Newest events</option><option value="name">Name A–Z</option></select></label>
      </div>
    </div>
    {error && <div role="alert" className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">{error} <button type="button" className="min-h-11 px-3 font-semibold underline" onClick={() => setRetry(value => value + 1)}>Try again</button></div>}
    <div aria-busy={loading} className="grid grid-cols-2 items-stretch gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
      {page.events.map(event => <PublicEventCard event={event} now={page.now} key={event.id} />)}
    </div>
    {!page.events.length && !loading && !error && <div className="rounded-2xl border border-dashed border-stone-300 p-8 text-center"><h3 className="text-lg font-semibold">No matching events</h3><p className="mt-2 text-sm text-stone-600">Try another search or clear the filters.</p><button type="button" className="mt-3 min-h-11 rounded-xl bg-emerald-800 px-5 text-sm font-semibold text-white" onClick={() => { setFilters(defaults); setRetry(value => value + 1); }}>Clear filters</button></div>}
    {page.events.length < page.total && <div className="mt-6 text-center"><p className="mb-3 text-xs text-stone-600">Showing {page.events.length} of {page.total} events</p><button type="button" disabled={loading} onClick={loadMore} className="min-h-11 rounded-xl bg-emerald-800 px-7 text-sm font-semibold text-white hover:bg-emerald-900 disabled:opacity-50">{loading ? "Loading…" : "Load more events"}</button></div>}
  </section>;
}
