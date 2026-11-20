"use client";
import { useEffect, useRef, useState } from "react";
import { PublicEventCard } from "./public-event-card";
import { FeaturedMarqueeShowcase } from "./featured-marquee-showcase";
import { directoryFilters, type DirectoryFilters, type EventDirectoryPage } from "@/lib/events/directory";
import { TicketIcon, VoteIcon } from "@/components/brand-icons";

const defaults = directoryFilters.parse({});
const control = "min-h-12 w-full min-w-0 rounded-xl border border-stone-200 bg-white px-3.5 text-sm text-stone-800 shadow-sm transition placeholder:text-stone-400 hover:border-stone-300 focus:border-emerald-700 focus:outline-none focus:ring-4 focus:ring-emerald-700/10 dark:border-[#1e2a22] dark:bg-[#030504] dark:text-stone-100 dark:placeholder:text-stone-500 dark:hover:border-stone-700 dark:focus:border-emerald-500 dark:focus:ring-emerald-500/20";

export function EventBrowser({ initialPage, unavailable = false, compact = false }: { initialPage: EventDirectoryPage; unavailable?: boolean; compact?: boolean }) {
  const [showFilters, setShowFilters] = useState(!compact);
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

  const hasFilters = filters.search !== defaults.search || filters.status !== defaults.status || filters.mode !== defaults.mode || filters.sort !== defaults.sort || filters.event_type !== defaults.event_type;
  function resetFilters() {
    request.current?.abort();
    setLoading(true);
    setFilters(defaults);
    setRetry(value => value + 1);
  }

  return <section id="events" className="mx-auto w-full max-w-[1800px] px-3 py-6 sm:px-6 lg:px-8 lg:py-8" aria-labelledby="event-directory-title">
    {/* Featured Marquee Showcase & Quick Vote (Matching the Reference Showcase) */}
    <FeaturedMarqueeShowcase events={page.events} />

    {/* Filter & Category Switcher Bar */}
    <div className="my-6 flex flex-wrap items-center justify-between gap-3 border-b border-stone-200/80 pb-4 dark:border-[#1c2721]">
      <div className="flex items-center gap-1.5 p-1 rounded-xl bg-stone-100 dark:bg-[#0c120e] border border-stone-200/80 dark:border-[#1c2721]">
        <button
          type="button"
          onClick={() => update("event_type", "all")}
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
            filters.event_type === "all"
              ? "bg-white text-stone-900 shadow-xs dark:bg-emerald-950 dark:text-emerald-300"
              : "text-stone-600 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-200"
          }`}
        >
          All Events
        </button>
        <button
          type="button"
          onClick={() => update("event_type", "ticketing")}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
            filters.event_type === "ticketing"
              ? "bg-white text-stone-900 shadow-xs dark:bg-emerald-950 dark:text-emerald-300"
              : "text-stone-600 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-200"
          }`}
        >
          <TicketIcon size={14} />
          <span>Official Tickets</span>
        </button>
        <button
          type="button"
          onClick={() => update("event_type", "voting")}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
            filters.event_type === "voting"
              ? "bg-white text-stone-900 shadow-xs dark:bg-emerald-950 dark:text-emerald-300"
              : "text-stone-600 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-200"
          }`}
        >
          <VoteIcon size={14} />
          <span>Nominee Voting</span>
        </button>
      </div>

      <div className="flex items-center gap-2">
        {compact && (
          <button
            type="button"
            aria-expanded={showFilters}
            aria-controls="event-extra-filters"
            onClick={() => setShowFilters(value => !value)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-stone-300 bg-white px-3 py-1.5 text-xs font-semibold text-stone-800 shadow-2xs hover:bg-stone-50 dark:border-[#1e2a22] dark:bg-[#0c120e] dark:text-stone-200 cursor-pointer"
          >
            <span>{showFilters ? "Hide Search" : "Search & Filter"}</span>
            {hasFilters && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />}
          </button>
        )}
        {hasFilters && (
          <button
            type="button"
            onClick={resetFilters}
            className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-emerald-800 dark:text-emerald-400 hover:underline cursor-pointer"
          >
            Clear
          </button>
        )}
        <span className="text-xs text-stone-500 dark:text-stone-400 ml-1" role="status" aria-live="polite">
          {loading ? "Loading…" : `${page.total} active`}
        </span>
      </div>
    </div>

    {/* Expandable Search Input if toggled */}
    {showFilters && (
      <div id="event-extra-filters" className="mb-8 rounded-2xl border border-stone-200 bg-stone-50/80 p-4 dark:border-[#1c2721] dark:bg-[#070a08]">
        <input
          aria-label="Search events, venues, or organizers"
          className={control}
          type="search"
          maxLength={120}
          placeholder="Search event name, venue, or organizer..."
          value={filters.search}
          onChange={event => update("search", event.target.value)}
        />
      </div>
    )}
    {error && <div role="alert" className="mb-5 rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-900/60 dark:bg-amber-950/40 p-4 text-sm text-amber-950 dark:text-amber-200">{error} <button type="button" className="min-h-11 px-3 font-semibold border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 shadow-xs rounded-xl py-2.5 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-50" onClick={() => setRetry(value => value + 1)}>Try again</button></div>}

    {filters.event_type === "all" ? (
      <div className="space-y-12">
        {/* 1. Official Event Tickets Section */}
        {page.events.filter(e => e.event_type === "ticketing").length > 0 && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-end justify-between gap-2 border-b border-stone-200/80 pb-3 dark:border-[#1c2721]">
              <div className="flex items-center gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 shadow-xs">
                  <TicketIcon size={18} />
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-amber-700 dark:text-amber-400">
                      TICKETING &amp; PASSES
                    </span>
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-950/80 dark:text-amber-300">
                      {page.events.filter(e => e.event_type === "ticketing" || e.event_type === "hybrid").length} Available
                    </span>
                  </div>
                  <h3 className="text-lg sm:text-2xl font-bold tracking-tight text-stone-900 dark:text-white">
                    Official Event Tickets &amp; VIP Passes
                  </h3>
                  <p className="text-xs text-stone-500 dark:text-stone-400">
                    Live summits, festivals, concerts, and parties with instant Mobile Money &amp; CODE PAX
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => update("event_type", "ticketing")}
                className="hidden sm:inline-flex items-center gap-1 text-xs font-bold text-emerald-800 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 cursor-pointer"
              >
                <span>View all tickets</span>
                <span>→</span>
              </button>
            </div>

            <div aria-busy={loading} className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 items-stretch">
              {page.events
                .filter(e => e.event_type === "ticketing" || e.event_type === "hybrid")
                .map(event => (
                  <PublicEventCard
                    event={event}
                    now={page.now}
                    mode="ticketing"
                    key={`ticket-${event.id}`}
                  />
                ))}
            </div>
          </div>
        )}

        {/* 2. Nominee Voting & Awards Section */}
        {page.events.filter(e => e.event_type !== "ticketing").length > 0 && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-end justify-between gap-2 border-b border-stone-200/80 pb-3 dark:border-[#1c2721]">
              <div className="flex items-center gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 shadow-xs">
                  <VoteIcon size={18} />
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-700 dark:text-emerald-400">
                      AWARDS &amp; CONTESTS
                    </span>
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300">
                      {page.events.filter(e => e.event_type !== "ticketing").length} Active
                    </span>
                  </div>
                  <h3 className="text-lg sm:text-2xl font-bold tracking-tight text-stone-900 dark:text-white">
                    Live Awards &amp; Nominee Voting
                  </h3>
                  <p className="text-xs text-stone-500 dark:text-stone-400">
                    Cast verified votes for your favourite student leaders, church honorees, and creative talents
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => update("event_type", "voting")}
                className="hidden sm:inline-flex items-center gap-1 text-xs font-bold text-emerald-800 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 cursor-pointer"
              >
                <span>View all voting</span>
                <span>→</span>
              </button>
            </div>

            <div aria-busy={loading} className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-6 items-stretch">
              {page.events
                .filter(e => e.event_type !== "ticketing")
                .map(event => (
                  <PublicEventCard
                    event={event}
                    now={page.now}
                    mode="voting"
                    key={`vote-${event.id}`}
                  />
                ))}
            </div>
          </div>
        )}
      </div>
    ) : (
      <div aria-busy={loading} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5 sm:gap-6 items-stretch">
        {page.events.map(event => (
          <PublicEventCard
            event={event}
            now={page.now}
            mode={filters.event_type === "ticketing" ? "ticketing" : event.event_type === "ticketing" ? "ticketing" : "voting"}
            key={event.id}
          />
        ))}
      </div>
    )}
    {!page.events.length && !loading && !error && <div className="rounded-2xl border border-dashed border-stone-300 dark:border-[#1c2721] dark:bg-[#070a08] p-8 text-center"><h3 className="text-lg font-semibold text-stone-900 dark:text-white">No matching events</h3><p className="mt-2 text-sm text-stone-600 dark:text-stone-400">Try another search or clear the filters.</p><button type="button" className="mt-3 min-h-11 rounded-xl bg-emerald-800 dark:bg-emerald-600 hover:dark:bg-emerald-500 px-5 text-sm font-semibold text-white py-2.5 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-50" onClick={() => { setFilters(defaults); setRetry(value => value + 1); }}>Clear filters</button></div>}
    {page.events.length < page.total && <div className="mt-6 text-center"><p className="mb-3 text-xs text-stone-600 dark:text-stone-400">Showing {page.events.length} of {page.total} events</p><button type="button" disabled={loading} onClick={loadMore} className="min-h-11 rounded-xl bg-emerald-800 dark:bg-emerald-600 hover:dark:bg-emerald-500 px-7 text-sm font-semibold text-white hover:bg-emerald-900 disabled:opacity-50 py-2.5 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed">{loading ? "Loading…" : "Load more events"}</button></div>}
  </section>;
}
