"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Icon } from "@/components/icon";

export type EventItem = {
  id: string;
  name: string;
  slug?: string;
  starts_at: string;
  ends_at: string;
  status: string;
  currency?: string;
  unit_price_minor?: number;
  voting_mode?: string;
};

type Props = {
  events: EventItem[];
  organizationId: string;
};

export function OrganizationEventsList({ events, organizationId }: Props) {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const publishedCount = useMemo(() => events.filter((e) => e.status === "published").length, [events]);
  const draftCount = useMemo(() => events.filter((e) => e.status === "draft").length, [events]);
  const closedCount = useMemo(() => events.filter((e) => e.status === "closed" || e.status === "archived").length, [events]);

  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      const matchesFilter =
        statusFilter === "all"
          ? true
          : statusFilter === "closed"
          ? event.status === "closed" || event.status === "archived"
          : event.status === statusFilter;
      const matchesSearch =
        searchQuery.trim() === "" ||
        event.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (event.slug && event.slug.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesFilter && matchesSearch;
    });
  }, [events, statusFilter, searchQuery]);

  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat("en-GH", {
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: "Africa/Accra",
      }),
    []
  );

  return (
    <div className="space-y-6">
      {/* Interactive Overview Stats Cards (Filter buttons) */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <button
          type="button"
          onClick={() => setStatusFilter("all")}
          className={`group flex flex-col justify-between rounded-2xl border p-4 text-left transition-all duration-200 active:scale-[0.98] ${
            statusFilter === "all"
              ? "border-emerald-500/50 bg-emerald-950/20 shadow-md shadow-emerald-950/20 ring-1 ring-emerald-500/30"
              : "border-stone-800/80 bg-stone-900/60 hover:border-stone-700 hover:bg-stone-900"
          }`}
        >
          <div className="flex items-center justify-between text-xs font-medium text-stone-400">
            <span>All Events</span>
            <span className={`h-2 w-2 rounded-full ${statusFilter === "all" ? "bg-emerald-400 animate-pulse" : "bg-stone-600"}`} />
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold font-mono text-white sm:text-3xl">{events.length}</span>
            <p className="mt-0.5 text-[11px] text-stone-400">Full workspace total</p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter("published")}
          className={`group flex flex-col justify-between rounded-2xl border p-4 text-left transition-all duration-200 active:scale-[0.98] ${
            statusFilter === "published"
              ? "border-emerald-500/50 bg-emerald-950/20 shadow-md shadow-emerald-950/20 ring-1 ring-emerald-500/30"
              : "border-stone-800/80 bg-stone-900/60 hover:border-stone-700 hover:bg-stone-900"
          }`}
        >
          <div className="flex items-center justify-between text-xs font-medium text-stone-400">
            <span>Published</span>
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold font-mono text-emerald-400 sm:text-3xl">{publishedCount}</span>
            <p className="mt-0.5 text-[11px] text-stone-400">Active and open to voters</p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter("draft")}
          className={`group flex flex-col justify-between rounded-2xl border p-4 text-left transition-all duration-200 active:scale-[0.98] ${
            statusFilter === "draft"
              ? "border-amber-500/50 bg-amber-950/20 shadow-md shadow-amber-950/20 ring-1 ring-amber-500/30"
              : "border-stone-800/80 bg-stone-900/60 hover:border-stone-700 hover:bg-stone-900"
          }`}
        >
          <div className="flex items-center justify-between text-xs font-medium text-stone-400">
            <span>Drafts</span>
            <span className="h-2 w-2 rounded-full bg-amber-400" />
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold font-mono text-amber-300 sm:text-3xl">{draftCount}</span>
            <p className="mt-0.5 text-[11px] text-stone-400">Under preparation</p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter("closed")}
          className={`group flex flex-col justify-between rounded-2xl border p-4 text-left transition-all duration-200 active:scale-[0.98] ${
            statusFilter === "closed"
              ? "border-stone-500/50 bg-stone-800/40 shadow-md ring-1 ring-stone-400/30"
              : "border-stone-800/80 bg-stone-900/60 hover:border-stone-700 hover:bg-stone-900"
          }`}
        >
          <div className="flex items-center justify-between text-xs font-medium text-stone-400">
            <span>Completed</span>
            <span className="h-2 w-2 rounded-full bg-stone-500" />
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold font-mono text-stone-300 sm:text-3xl">{closedCount}</span>
            <p className="mt-0.5 text-[11px] text-stone-400">Ended or archived</p>
          </div>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-y border-stone-800/80 py-4">
        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-64">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search events by name…"
              className="w-full rounded-xl border border-stone-800 bg-stone-950 px-3.5 py-2 pl-9 text-xs text-stone-200 placeholder:text-stone-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all"
            />
            <span className="absolute left-3 top-2.5 text-stone-500 text-xs">🔍</span>
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-2.5 text-xs text-stone-400 hover:text-white"
              >
                ✕
              </button>
            )}
          </div>

          {statusFilter !== "all" && (
            <button
              type="button"
              onClick={() => setStatusFilter("all")}
              className="rounded-lg border border-stone-800 bg-stone-900 px-2.5 py-1.5 text-xs font-medium text-stone-400 hover:text-white transition-colors"
            >
              Reset filter ✕
            </button>
          )}
        </div>

        <div className="text-xs text-stone-400 font-medium">
          Showing <span className="font-mono text-white">{filteredEvents.length}</span> of{" "}
          <span className="font-mono text-stone-300">{events.length}</span> events
        </div>
      </div>

      {/* Event Cards Grid */}
      {filteredEvents.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {filteredEvents.map((event) => {
            const isPublished = event.status === "published";
            const isDraft = event.status === "draft";
            const isClosed = event.status === "closed" || event.status === "archived";

            const startDate = new Date(event.starts_at);
            const endDate = new Date(event.ends_at);
            const now = new Date();
            const isLiveNow = isPublished && now >= startDate && now <= endDate;

            return (
              <Link
                key={event.id}
                href={`/organizer/${organizationId}/events/${event.id}`}
                className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-stone-800/80 bg-gradient-to-b from-stone-900/80 to-stone-950 p-6 transition-all duration-200 hover:border-emerald-500/40 hover:bg-stone-900/90 hover:shadow-xl hover:shadow-emerald-950/10 active:scale-[0.99]"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider ${
                          isLiveNow
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                            : isPublished
                            ? "bg-teal-500/10 text-teal-300 border border-teal-500/20"
                            : isDraft
                            ? "bg-amber-500/10 text-amber-300 border border-amber-500/20"
                            : "bg-stone-800 text-stone-400 border border-stone-700"
                        }`}
                      >
                        {isLiveNow && <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />}
                        {isLiveNow ? "Live Now" : event.status.replaceAll("_", " ")}
                      </span>

                      {event.voting_mode && (
                        <span className="rounded-md border border-stone-800 bg-stone-950/60 px-2 py-0.5 text-[10px] font-medium uppercase text-stone-400">
                          {event.voting_mode.replaceAll("_", " ")}
                        </span>
                      )}
                    </div>

                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-stone-800/40 text-stone-400 transition-all group-hover:bg-emerald-500/20 group-hover:text-emerald-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5">
                      <Icon name="arrowRight" size={14} />
                    </div>
                  </div>

                  <h3 className="mt-3.5 text-lg font-bold text-white group-hover:text-emerald-300 transition-colors line-clamp-2">
                    {event.name}
                  </h3>

                  {event.slug && (
                    <p className="mt-1 text-xs text-stone-400 font-mono">
                      /events/{event.slug}
                    </p>
                  )}
                </div>

                <div className="mt-6 border-t border-stone-800/80 pt-4">
                  <div className="flex items-center justify-between text-xs text-stone-400">
                    <div className="flex items-center gap-1.5">
                      <Icon name="calendar" size={13} className="text-stone-400" />
                      <span>
                        {dateFormatter.format(startDate)} – {dateFormatter.format(endDate)}
                      </span>
                    </div>

                    {event.unit_price_minor ? (
                      <span className="font-mono text-emerald-400/90 font-medium">
                        ₵{(event.unit_price_minor / 100).toFixed(2)}/vote
                      </span>
                    ) : (
                      <span className="text-stone-400">Free votes</span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-stone-800 bg-stone-900/30 p-12 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-stone-800/80 text-stone-400">
            <Icon name="vote" size={22} />
          </div>
          <h3 className="text-base font-semibold text-white">No matching events found</h3>
          <p className="mx-auto mt-1 max-w-sm text-xs text-stone-400">
            {searchQuery
              ? `No events matching "${searchQuery}". Try a different search term or clear the filter.`
              : "There are no events in this status category."}
          </p>
          {(searchQuery || statusFilter !== "all") && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                setStatusFilter("all");
              }}
              className="mt-4 rounded-xl border border-stone-700 bg-stone-800 px-4 py-2 text-xs font-semibold text-white hover:bg-stone-700 transition-colors"
            >
              Clear all filters
            </button>
          )}
        </div>
      )}
    </div>
  );
}
