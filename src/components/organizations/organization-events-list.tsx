"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { organizerEventPresentation } from "@/lib/events/organizer-presentation";
import { Icon } from "@/components/icon";
import { TicketIcon, VoteIcon } from "@/components/brand-icons";

export type EventItem = {
  id: string;
  name: string;
  slug?: string;
  starts_at: string;
  ends_at: string;
  status: string;
  review_feedback?: string | null;
  last_review_kind?: string | null;
  has_activity?: boolean;
  currency?: string;
  unit_price_minor?: number;
  voting_mode?: string;
  event_type?: string;
  venue_name?: string | null;
  doors_open_time?: string | null;
  imageUrl?: string | null;
};

type Props = {
  events: EventItem[];
  organizationId: string;
  now: number;
};

export function OrganizationEventsList({ events, organizationId, now }: Props) {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<"all" | "voting" | "ticketing">("all");
  const [searchQuery, setSearchQuery] = useState("");

  const publishedCount = useMemo(() => events.filter((e) => e.status === "published").length, [events]);
  const draftCount = useMemo(() => events.filter((e) => e.status === "draft").length, [events]);
  const closedCount = useMemo(() => events.filter((e) => e.status === "closed" || e.status === "archived").length, [events]);

  const ticketCount = useMemo(
    () => events.filter((e) => e.event_type === "ticketing" || e.event_type === "hybrid").length,
    [events]
  );
  const votingCount = useMemo(
    () => events.filter((e) => e.event_type !== "ticketing").length,
    [events]
  );

  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      const matchesStatus =
        statusFilter === "all"
          ? true
          : statusFilter === "closed"
            ? event.status === "closed" || event.status === "archived"
            : event.status === statusFilter;

      const matchesType =
        typeFilter === "all"
          ? true
          : typeFilter === "ticketing"
            ? event.event_type === "ticketing" || event.event_type === "hybrid"
            : event.event_type !== "ticketing";

      const query = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !query ||
        event.name.toLowerCase().includes(query) ||
        (event.venue_name && event.venue_name.toLowerCase().includes(query)) ||
        (event.slug && event.slug.toLowerCase().includes(query));

      return matchesStatus && matchesType && matchesSearch;
    });
  }, [events, statusFilter, typeFilter, searchQuery]);

  const dateFormatter = new Intl.DateTimeFormat("en-GH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "Africa/Accra",
  });

  return (
    <div className="space-y-6">
      {/* Search and Filters Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Icon
            name="search"
            size={16}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 dark:text-stone-500"
          />
          <input
            type="text"
            placeholder="Search events by name, venue or slug..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-stone-200 bg-white py-2 pl-9 pr-4 text-xs font-medium text-stone-900 placeholder:text-stone-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/10 dark:border-[#1c2721] dark:bg-[#0c120e] dark:text-white dark:placeholder:text-stone-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200"
            >
              <Icon name="x" size={14} />
            </button>
          )}
        </div>

        {/* View/Type Switcher Pills */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-stone-100 dark:bg-[#0c120e] border border-stone-200/80 dark:border-[#1c2721] self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setTypeFilter("all")}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
              typeFilter === "all"
                ? "bg-white text-stone-900 shadow-xs dark:bg-emerald-950 dark:text-emerald-300"
                : "text-stone-600 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-200"
            }`}
          >
            All ({events.length})
          </button>
          <button
            type="button"
            onClick={() => setTypeFilter("ticketing")}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
              typeFilter === "ticketing"
                ? "bg-white text-stone-900 shadow-xs dark:bg-emerald-950 dark:text-emerald-300"
                : "text-stone-600 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-200"
            }`}
          >
            <TicketIcon size={12} />
            <span>Ticketing ({ticketCount})</span>
          </button>
          <button
            type="button"
            onClick={() => setTypeFilter("voting")}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
              typeFilter === "voting"
                ? "bg-white text-stone-900 shadow-xs dark:bg-emerald-950 dark:text-emerald-300"
                : "text-stone-600 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-200"
            }`}
          >
            <VoteIcon size={12} />
            <span>Voting ({votingCount})</span>
          </button>
        </div>
      </div>

      {/* Status Segment Filter Pills */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200/80 pb-3 dark:border-[#1c2721]">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setStatusFilter("all")}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors cursor-pointer ${
              statusFilter === "all"
                ? "bg-stone-900 text-white dark:bg-white dark:text-stone-900"
                : "bg-stone-100 text-stone-600 hover:bg-stone-200 dark:bg-[#141d18] dark:text-stone-400 dark:hover:bg-[#1c2721]"
            }`}
          >
            All Statuses ({events.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("published")}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-colors cursor-pointer ${
              statusFilter === "published"
                ? "bg-emerald-800 text-white dark:bg-emerald-600"
                : "bg-emerald-50 text-emerald-900 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-950/70"
            }`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            <span>Published ({publishedCount})</span>
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("draft")}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-colors cursor-pointer ${
              statusFilter === "draft"
                ? "bg-amber-800 text-white dark:bg-amber-600"
                : "bg-amber-50 text-amber-900 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300 dark:hover:bg-amber-950/70"
            }`}
          >
            <span>Drafts ({draftCount})</span>
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("closed")}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors cursor-pointer ${
              statusFilter === "closed"
                ? "bg-stone-700 text-white dark:bg-stone-600"
                : "bg-stone-100 text-stone-600 hover:bg-stone-200 dark:bg-[#141d18] dark:text-stone-400 dark:hover:bg-[#1c2721]"
            }`}
          >
            Ended / Closed ({closedCount})
          </button>
        </div>

        <div className="text-xs text-stone-500 dark:text-stone-400">
          Showing <span className="font-mono font-bold text-stone-800 dark:text-white">{filteredEvents.length}</span> of{" "}
          <span className="font-mono text-stone-600 dark:text-stone-300">{events.length}</span> events
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
            const presentation = organizerEventPresentation(event, now);
            const isLiveNow = isPublished && now >= startDate.getTime() && now < endDate.getTime();
            const isTicketing = event.event_type === "ticketing";
            const isHybrid = event.event_type === "hybrid";

            return (
              <div
                key={event.id}
                className="group relative flex h-full min-w-0 flex-col justify-between overflow-hidden rounded-2xl border border-stone-200/90 bg-white shadow-xs transition-all duration-300 hover:border-emerald-300 hover:shadow-lg dark:border-[#1c2721] dark:bg-[#0c120e] dark:hover:border-emerald-800/80"
              >
                <Link
                  href={`/organizer/${organizationId}/events/${event.id}`}
                  className="flex h-full w-full min-w-0 flex-col justify-between p-5 sm:p-6"
                >
                  <div>
                    {/* Top Badges & Arrow */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider border ${
                            isLiveNow
                              ? "bg-emerald-50 text-emerald-900 border-emerald-300 dark:bg-emerald-950/70 dark:text-emerald-300 dark:border-emerald-800"
                              : isPublished
                              ? "bg-teal-50 text-teal-900 border-teal-300 dark:bg-teal-950/60 dark:text-teal-300 dark:border-teal-800"
                              : isDraft
                              ? "bg-amber-50 text-amber-900 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800"
                              : "bg-stone-100 text-stone-600 border-stone-200 dark:bg-stone-900 dark:text-stone-400 dark:border-stone-800"
                          }`}
                        >
                          {isLiveNow && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />}
                          {presentation.label}
                        </span>

                        {isTicketing ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-[10px] font-bold uppercase text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/60 dark:text-amber-300">
                            <TicketIcon size={12} />
                            <span>Ticketed Event</span>
                          </span>
                        ) : isHybrid ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-purple-300 bg-purple-50 px-2.5 py-0.5 text-[10px] font-bold uppercase text-purple-900 dark:border-purple-900/60 dark:bg-purple-950/60 dark:text-purple-300">
                            <TicketIcon size={11} />
                            <VoteIcon size={11} />
                            <span>Hybrid</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold uppercase text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/60 dark:text-emerald-300">
                            <VoteIcon size={11} />
                            <span>Voting Contest</span>
                          </span>
                        )}
                      </div>

                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-stone-200 bg-stone-50 text-stone-500 transition-all group-hover:bg-emerald-800 group-hover:border-emerald-800 group-hover:text-white dark:border-[#1c2721] dark:bg-[#141b16] dark:text-stone-400">
                        <Icon name="arrowRight" size={14} />
                      </div>
                    </div>

                    {/* Flyer Image Preview if exists */}
                    {event.imageUrl ? (
                      <div className="mt-4 relative aspect-[16/9] w-full overflow-hidden rounded-xl border border-stone-100 bg-stone-100 shadow-inner dark:border-[#1c2721] dark:bg-[#141b16]">
                        <Image
                          src={event.imageUrl}
                          alt={event.name}
                          fill
                          unoptimized
                          sizes="(min-width:768px) 50vw, 100vw"
                          className="object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      </div>
                    ) : null}

                    {/* Title & Venue */}
                    <h3 className="mt-3.5 text-lg font-serif font-bold text-stone-900 group-hover:text-emerald-800 dark:text-white dark:group-hover:text-emerald-400 transition-colors line-clamp-2">
                      {event.name}
                    </h3>

                    {event.venue_name && (
                      <p className="mt-1 text-xs font-medium text-stone-600 dark:text-stone-300 flex items-center gap-1">
                        <span>📍</span>
                        <span className="truncate">{event.venue_name}</span>
                      </p>
                    )}

                    {event.slug && (
                      <p className="mt-1 text-xs text-stone-400 dark:text-stone-500 font-mono">
                        /events/{event.slug}
                      </p>
                    )}
                  </div>

                  {/* Feedback / Warning / Schedule */}
                  <div className="mt-4 space-y-3">
                    {presentation.warning && (
                      <p className="rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
                        {presentation.warning}
                      </p>
                    )}
                    {event.review_feedback && (
                      <p className="line-clamp-2 text-xs text-stone-600 dark:text-stone-300 bg-stone-50 dark:bg-[#141b16] p-2 rounded-lg border border-stone-200/80 dark:border-[#1c2721]">
                        <strong>Platform feedback: </strong>{event.review_feedback}
                      </p>
                    )}
                    
                    <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-400">
                      {presentation.action} →
                    </p>

                    <div className="border-t border-stone-100 dark:border-[#1c2721] pt-3">
                      <div className="flex items-center justify-between text-xs text-stone-500 dark:text-stone-400">
                        <div className="flex items-center gap-1.5">
                          <Icon name="calendar" size={13} className="text-stone-400" />
                          <span>
                            {dateFormatter.format(startDate)} – {dateFormatter.format(endDate)}
                          </span>
                        </div>

                        {isTicketing ? (
                          <span className="inline-flex items-center gap-1 font-mono text-emerald-800 dark:text-emerald-300 font-semibold text-[11px]">
                            <TicketIcon size={13} />
                            <span>Passes &amp; Tickets</span>
                          </span>
                        ) : event.unit_price_minor ? (
                          <span className="inline-flex items-center gap-1 font-mono text-emerald-800 dark:text-emerald-300 font-semibold">
                            <VoteIcon size={12} />
                            <span>₵{(event.unit_price_minor / 100).toFixed(2)}/vote</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 font-mono text-stone-500 dark:text-stone-400 text-[11px]">
                            <VoteIcon size={12} />
                            <span>Free ballot</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-12 text-center shadow-xs dark:border-[#1c2721] dark:bg-[#0c120e]">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-stone-100 text-stone-500 dark:bg-[#141d18] dark:text-stone-400">
            <Icon name="vote" size={22} />
          </div>
          <h3 className="text-base font-semibold text-stone-900 dark:text-white">No matching events found</h3>
          <p className="mx-auto mt-1 max-w-sm text-xs text-stone-500 dark:text-stone-400">
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
              className="mt-4 rounded-xl border border-stone-200 bg-stone-100 px-4 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-200 transition-colors dark:border-[#1c2721] dark:bg-[#141d18] dark:text-stone-300 dark:hover:bg-[#1c2721] cursor-pointer"
            >
              Clear all filters
            </button>
          )}
        </div>
      )}
    </div>
  );
}
