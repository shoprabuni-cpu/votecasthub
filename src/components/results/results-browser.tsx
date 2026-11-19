"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import type { EventResultsSummary } from "@/lib/events/results";

export function ResultsBrowser({
  initialEvents,
}: {
  initialEvents: EventResultsSummary[];
}) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "live" | "ended">("all");

  const filteredEvents = useMemo(() => {
    return initialEvents.filter((ev) => {
      // Status filter
      if (filter === "live" && ev.is_ended) return false;
      if (filter === "ended" && !ev.is_ended) return false;

      // Text search
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchesName = ev.name.toLowerCase().includes(q);
        const matchesOrg = ev.organization_name.toLowerCase().includes(q);
        const matchesDesc = (ev.description || "").toLowerCase().includes(q);
        if (!matchesName && !matchesOrg && !matchesDesc) return false;
      }

      return true;
    });
  }, [initialEvents, search, filter]);

  const liveCount = useMemo(() => initialEvents.filter((e) => !e.is_ended).length, [initialEvents]);
  const endedCount = useMemo(() => initialEvents.filter((e) => e.is_ended).length, [initialEvents]);

  return (
    <div className="space-y-8">
      {/* Search and Filters Bar */}
      <div className="flex flex-col gap-4 rounded-2xl border border-stone-200/80 bg-white/70 p-4 backdrop-blur-md sm:flex-row sm:items-center sm:justify-between dark:border-[#1c2721] dark:bg-[#0c120e]/80">
        <div className="relative flex-1">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by event title, organizer or awards category..."
            className="w-full rounded-xl border border-stone-300 bg-white px-4 py-2.5 pl-10 text-sm text-stone-900 shadow-2xs placeholder:text-stone-400 focus:border-emerald-600 focus:outline-hidden focus:ring-2 focus:ring-emerald-600/20 dark:border-[#223028] dark:bg-[#121a15] dark:text-stone-100 dark:placeholder:text-stone-500"
          />
          <span className="pointer-events-none absolute left-3.5 top-3 text-stone-400 dark:text-stone-500">
            🔍
          </span>
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-2.5 text-xs text-stone-400 hover:text-stone-600 dark:hover:text-stone-300"
              title="Clear search"
            >
              ✕
            </button>
          )}
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <button
            onClick={() => setFilter("all")}
            className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
              filter === "all"
                ? "bg-emerald-900 text-white shadow-xs dark:bg-emerald-600"
                : "border border-stone-200 bg-stone-50 text-stone-600 hover:bg-stone-100 dark:border-[#223028] dark:bg-[#121a15] dark:text-stone-300 dark:hover:bg-[#18231c]"
            }`}
          >
            All Results ({initialEvents.length})
          </button>
          <button
            onClick={() => setFilter("live")}
            className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
              filter === "live"
                ? "bg-emerald-900 text-white shadow-xs dark:bg-emerald-600"
                : "border border-stone-200 bg-stone-50 text-stone-600 hover:bg-stone-100 dark:border-[#223028] dark:bg-[#121a15] dark:text-stone-300 dark:hover:bg-[#18231c]"
            }`}
          >
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            Live Standings ({liveCount})
          </button>
          <button
            onClick={() => setFilter("ended")}
            className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
              filter === "ended"
                ? "bg-emerald-900 text-white shadow-xs dark:bg-emerald-600"
                : "border border-stone-200 bg-stone-50 text-stone-600 hover:bg-stone-100 dark:border-[#223028] dark:bg-[#121a15] dark:text-stone-300 dark:hover:bg-[#18231c]"
            }`}
          >
            🏆 Certified Finals ({endedCount})
          </button>
        </div>
      </div>

      {/* Events Results Grid */}
      {filteredEvents.length === 0 ? (
        <div className="rounded-3xl border border-stone-200 bg-white p-12 text-center shadow-xs dark:border-[#1c2721] dark:bg-[#0c120e]">
          <span className="text-4xl">🏆</span>
          <h3 className="mt-3 text-lg font-serif font-bold text-stone-900 dark:text-stone-100">
            No public results found
          </h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-stone-500 dark:text-stone-400">
            {search
              ? `No competitions matching "${search}". Try searching with a different keyword.`
              : "No awards competitions currently have public results enabled. When organizers toggle Live Results Visibility to public, they will instantly appear here."}
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            {search && (
              <button
                onClick={() => setSearch("")}
                className="rounded-xl border border-stone-300 bg-white px-4 py-2 text-xs font-semibold text-stone-700 shadow-2xs hover:bg-stone-50 dark:border-[#223028] dark:bg-[#121a15] dark:text-stone-300"
              >
                Clear Search Filter
              </button>
            )}
            <Link
              href="/events"
              className="rounded-xl bg-emerald-900 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500"
            >
              Browse Active Events →
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredEvents.map((event) => (
            <Link
              key={event.id}
              href={`/results/${event.slug}`}
              className="group relative flex flex-col overflow-hidden rounded-3xl border border-stone-200/90 bg-white shadow-xs transition-all duration-300 hover:-translate-y-1 hover:border-emerald-500/50 hover:shadow-xl dark:border-[#1c2721] dark:bg-[#0c120e] dark:hover:border-emerald-500/40"
            >
              {/* Event Header Banner */}
              <div className="relative aspect-16/9 w-full overflow-hidden bg-gradient-to-br from-stone-900 via-emerald-950 to-stone-900">
                {event.image_url ? (
                  <Image
                    src={event.image_url}
                    alt={event.name}
                    fill
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center p-6 text-center">
                    <span className="font-serif text-2xl font-bold tracking-tight text-white/90">
                      {event.name}
                    </span>
                  </div>
                )}

                {/* Subtle gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                {/* Status Badge */}
                <div className="absolute top-3 right-3">
                  {!event.is_ended ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-950/80 px-2.5 py-1 text-[11px] font-bold text-emerald-300 backdrop-blur-md">
                      <span className="relative flex h-2 w-2">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                      </span>
                      Live Standings
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-stone-950/80 px-2.5 py-1 text-[11px] font-bold text-amber-300 backdrop-blur-md">
                      🏆 Certified Final
                    </span>
                  )}
                </div>

                {/* Org Tag on Image */}
                <div className="absolute bottom-3 left-3 right-3">
                  <p className="truncate text-xs font-semibold text-emerald-300">
                    {event.organization_name}
                  </p>
                  <h3 className="truncate font-serif text-lg font-bold text-white group-hover:text-emerald-200 transition-colors">
                    {event.name}
                  </h3>
                </div>
              </div>

              {/* Card Body */}
              <div className="flex flex-1 flex-col justify-between p-5">
                {/* Metrics Highlights */}
                <div className="grid grid-cols-3 gap-2 rounded-2xl bg-stone-50 p-3 text-center dark:bg-[#121a15]">
                  <div>
                    <span className="block font-mono text-base font-extrabold text-emerald-900 dark:text-emerald-400">
                      {event.total_votes.toLocaleString("en-GH")}
                    </span>
                    <span className="text-[10px] font-medium text-stone-500 dark:text-stone-400 uppercase tracking-wider">
                      Ballots
                    </span>
                  </div>
                  <div className="border-x border-stone-200/80 dark:border-[#1c2721]">
                    <span className="block font-mono text-base font-extrabold text-stone-800 dark:text-stone-200">
                      {event.category_count}
                    </span>
                    <span className="text-[10px] font-medium text-stone-500 dark:text-stone-400 uppercase tracking-wider">
                      Categories
                    </span>
                  </div>
                  <div>
                    <span className="block font-mono text-base font-extrabold text-stone-800 dark:text-stone-200">
                      {event.nominee_count}
                    </span>
                    <span className="text-[10px] font-medium text-stone-500 dark:text-stone-400 uppercase tracking-wider">
                      Nominees
                    </span>
                  </div>
                </div>

                {/* Bottom Action Row */}
                <div className="mt-5 flex items-center justify-between border-t border-stone-100 pt-3 text-xs dark:border-[#1c2721]">
                  <span className="text-stone-500 dark:text-stone-400 font-medium">
                    {!event.is_ended
                      ? `Voting ends ${new Date(event.ends_at).toLocaleDateString("en-GH", { month: "short", day: "numeric" })}`
                      : "Official outcomes recorded"}
                  </span>
                  <span className="inline-flex items-center gap-1 font-bold text-emerald-800 group-hover:text-emerald-600 dark:text-emerald-400 dark:group-hover:text-emerald-300">
                    View Standings <span className="transition-transform duration-200 group-hover:translate-x-1">→</span>
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
