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
              ? "border-emerald-600 bg-emerald-50/70 shadow-xs ring-1 ring-emerald-600/30"
              : "border-stone-200 bg-white hover:border-stone-300 hover:bg-stone-50/50 shadow-2xs"
          }`}
        >
          <div className="flex items-center justify-between text-xs font-semibold text-stone-500">
            <span>All Events</span>
            <span className={`h-2 w-2 rounded-full ${statusFilter === "all" ? "bg-emerald-600 animate-pulse" : "bg-stone-300"}`} />
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold font-mono text-stone-900 sm:text-3xl">{events.length}</span>
            <p className="mt-0.5 text-[11px] text-stone-400">Full workspace total</p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter("published")}
          className={`group flex flex-col justify-between rounded-2xl border p-4 text-left transition-all duration-200 active:scale-[0.98] ${
            statusFilter === "published"
              ? "border-emerald-600 bg-emerald-50/70 shadow-xs ring-1 ring-emerald-600/30"
              : "border-stone-200 bg-white hover:border-stone-300 hover:bg-stone-50/50 shadow-2xs"
          }`}
        >
          <div className="flex items-center justify-between text-xs font-semibold text-stone-500">
            <span>Published</span>
            <span className="h-2 w-2 rounded-full bg-emerald-600" />
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold font-mono text-emerald-800 sm:text-3xl">{publishedCount}</span>
            <p className="mt-0.5 text-[11px] text-stone-400">Active and open to voters</p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter("draft")}
          className={`group flex flex-col justify-between rounded-2xl border p-4 text-left transition-all duration-200 active:scale-[0.98] ${
            statusFilter === "draft"
              ? "border-amber-500 bg-amber-50/80 shadow-xs ring-1 ring-amber-500/30"
              : "border-stone-200 bg-white hover:border-stone-300 hover:bg-stone-50/50 shadow-2xs"
          }`}
        >
          <div className="flex items-center justify-between text-xs font-semibold text-stone-500">
            <span>Drafts</span>
            <span className="h-2 w-2 rounded-full bg-amber-500" />
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold font-mono text-amber-800 sm:text-3xl">{draftCount}</span>
            <p className="mt-0.5 text-[11px] text-stone-400">Under preparation</p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter("closed")}
          className={`group flex flex-col justify-between rounded-2xl border p-4 text-left transition-all duration-200 active:scale-[0.98] ${
            statusFilter === "closed"
              ? "border-stone-400 bg-stone-100 shadow-xs ring-1 ring-stone-400/30"
              : "border-stone-200 bg-white hover:border-stone-300 hover:bg-stone-50/50 shadow-2xs"
          }`}
        >
          <div className="flex items-center justify-between text-xs font-semibold text-stone-500">
            <span>Completed</span>
            <span className="h-2 w-2 rounded-full bg-stone-400" />
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold font-mono text-stone-700 sm:text-3xl">{closedCount}</span>
            <p className="mt-0.5 text-[11px] text-stone-400">Ended or archived</p>
          </div>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-y border-stone-200 py-4">
        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-64">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search events by name…"
              className="w-full rounded-xl border border-stone-200 bg-white px-3.5 py-2 pl-9 text-xs text-stone-900 placeholder:text-stone-400 focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600 transition-all shadow-2xs"
            />
            <span className="absolute left-3 top-2.5 text-stone-400 text-xs">🔍</span>
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-2.5 text-xs text-stone-400 hover:text-stone-700"
              >
                ✕
              </button>
            )}
          </div>

          {statusFilter !== "all" && (
            <button
              type="button"
              onClick={() => setStatusFilter("all")}
              className="rounded-lg border border-stone-200 bg-stone-100 px-2.5 py-1.5 text-xs font-semibold text-stone-600 hover:bg-stone-200 transition-colors"
            >
              Reset filter ✕
            </button>
          )}
        </div>

        <div className="text-xs text-stone-500 font-medium">
          Showing <span className="font-mono font-bold text-stone-800">{filteredEvents.length}</span> of{" "}
          <span className="font-mono text-stone-600">{events.length}</span> events
        </div>
      </div>

      {/* Event Cards Grid */}
      {filteredEvents.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {filteredEvents.map((event) => {
            const isPublished = event.status === "published";
            const isDraft = event.status === "draft";

            const startDate = new Date(event.starts_at);
            const endDate = new Date(event.ends_at);
            const now = new Date();
            const isLiveNow = isPublished && now >= startDate && now <= endDate;

            return (
              <Link
                key={event.id}
                href={`/organizer/${organizationId}/events/${event.id}`}
                className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-stone-200 bg-white p-6 shadow-xs transition-all duration-200 hover:border-emerald-600/40 hover:shadow-md hover:bg-emerald-50/10 active:scale-[0.99]"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider ${
                          isLiveNow
                            ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                            : isPublished
                            ? "bg-teal-50 text-teal-800 border border-teal-200"
                            : isDraft
                            ? "bg-amber-50 text-amber-800 border border-amber-200"
                            : "bg-stone-100 text-stone-600 border border-stone-200"
                        }`}
                      >
                        {isLiveNow && <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse" />}
                        {isLiveNow ? "Live Now" : event.status.replaceAll("_", " ")}
                      </span>

                      {event.voting_mode && (
                        <span className="rounded-md border border-stone-200 bg-stone-50 px-2 py-0.5 text-[10px] font-medium uppercase text-stone-500">
                          {event.voting_mode.replaceAll("_", " ")}
                        </span>
                      )}
                    </div>

                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-stone-100 text-stone-400 transition-all group-hover:bg-emerald-700 group-hover:text-white group-hover:translate-x-0.5">
                      <Icon name="arrowRight" size={14} />
                    </div>
                  </div>

                  <h3 className="mt-3.5 text-lg font-bold text-stone-900 group-hover:text-emerald-800 transition-colors line-clamp-2">
                    {event.name}
                  </h3>

                  {event.slug && (
                    <p className="mt-1 text-xs text-stone-400 font-mono">
                      /events/{event.slug}
                    </p>
                  )}
                </div>

                <div className="mt-6 border-t border-stone-100 pt-4">
                  <div className="flex items-center justify-between text-xs text-stone-500">
                    <div className="flex items-center gap-1.5">
                      <Icon name="calendar" size={13} className="text-stone-400" />
                      <span>
                        {dateFormatter.format(startDate)} – {dateFormatter.format(endDate)}
                      </span>
                    </div>

                    {event.unit_price_minor ? (
                      <span className="font-mono text-emerald-700 font-semibold">
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
        <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-12 text-center shadow-xs">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-stone-100 text-stone-500">
            <Icon name="vote" size={22} />
          </div>
          <h3 className="text-base font-semibold text-stone-900">No matching events found</h3>
          <p className="mx-auto mt-1 max-w-sm text-xs text-stone-500">
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
              className="mt-4 rounded-xl border border-stone-200 bg-stone-100 px-4 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-200 transition-colors"
            >
              Clear all filters
            </button>
          )}
        </div>
      )}
    </div>
  );
}
