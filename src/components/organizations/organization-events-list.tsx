"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { organizerEventPresentation } from "@/lib/events/organizer-presentation";
import { Icon } from "@/components/icon";
import { TicketIcon, VoteIcon } from "@/components/brand-icons";
import { ReflectiveCard } from "@/components/ui/ReflectiveCard";

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

      const matchesSearch =
        searchQuery.trim() === "" ||
        event.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (event.slug && event.slug.toLowerCase().includes(searchQuery.toLowerCase()));

      return matchesStatus && matchesType && matchesSearch;
    });
  }, [events, statusFilter, typeFilter, searchQuery]);

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
          className={`group flex flex-col justify-between rounded-2xl border p-4 text-left transition-all duration-200 active:scale-[0.98] cursor-pointer ${statusFilter === "all"
              ? "border-emerald-600 bg-emerald-50/70 shadow-xs ring-1 ring-emerald-600/30 dark:border-emerald-500/50 dark:bg-emerald-950/40 dark:ring-emerald-500/20"
              : "border-stone-200 bg-white hover:border-stone-300 hover:bg-stone-50/50 shadow-2xs dark:border-[#1c2721] dark:bg-[#0c120e] dark:hover:border-stone-800 dark:hover:bg-[#121914]"
            }`}
        >
          <div className="flex items-center justify-between text-xs font-semibold text-stone-500 dark:text-stone-400">
            <span>All Events</span>
            <span className={`h-2 w-2 rounded-full ${statusFilter === "all" ? "bg-emerald-600 animate-pulse" : "bg-stone-300 dark:bg-stone-700"}`} />
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold font-mono text-stone-900 sm:text-3xl dark:text-white">{events.length}</span>
            <p className="mt-0.5 text-[11px] text-stone-400 dark:text-stone-500">Full workspace total</p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter("published")}
          className={`group flex flex-col justify-between rounded-2xl border p-4 text-left transition-all duration-200 active:scale-[0.98] cursor-pointer ${statusFilter === "published"
              ? "border-emerald-600 bg-emerald-50/70 shadow-xs ring-1 ring-emerald-600/30 dark:border-emerald-500/50 dark:bg-emerald-950/40 dark:ring-emerald-500/20"
              : "border-stone-200 bg-white hover:border-stone-300 hover:bg-stone-50/50 shadow-2xs dark:border-[#1c2721] dark:bg-[#0c120e] dark:hover:border-stone-800 dark:hover:bg-[#121914]"
            }`}
        >
          <div className="flex items-center justify-between text-xs font-semibold text-stone-500 dark:text-stone-400">
            <span>Published</span>
            <span className="h-2 w-2 rounded-full bg-emerald-600" />
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold font-mono text-emerald-800 sm:text-3xl dark:text-emerald-400">{publishedCount}</span>
            <p className="mt-0.5 text-[11px] text-stone-400 dark:text-stone-500">Approved public events</p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter("draft")}
          className={`group flex flex-col justify-between rounded-2xl border p-4 text-left transition-all duration-200 active:scale-[0.98] cursor-pointer ${statusFilter === "draft"
              ? "border-amber-500 bg-amber-50/80 shadow-xs ring-1 ring-amber-500/30 dark:border-amber-500/40 dark:bg-amber-950/30 dark:ring-amber-500/20"
              : "border-stone-200 bg-white hover:border-stone-300 hover:bg-stone-50/50 shadow-2xs dark:border-[#1c2721] dark:bg-[#0c120e] dark:hover:border-stone-800 dark:hover:bg-[#121914]"
            }`}
        >
          <div className="flex items-center justify-between text-xs font-semibold text-stone-500 dark:text-stone-400">
            <span>Not published</span>
            <span className="h-2 w-2 rounded-full bg-amber-500" />
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold font-mono text-amber-800 sm:text-3xl dark:text-amber-400">{draftCount}</span>
            <p className="mt-0.5 text-[11px] text-stone-400 dark:text-stone-500">Under preparation</p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter("closed")}
          className={`group flex flex-col justify-between rounded-2xl border p-4 text-left transition-all duration-200 active:scale-[0.98] cursor-pointer ${statusFilter === "closed"
              ? "border-stone-400 bg-stone-100 shadow-xs ring-1 ring-stone-400/30 dark:border-stone-700 dark:bg-stone-900 dark:ring-stone-600/20"
              : "border-stone-200 bg-white hover:border-stone-300 hover:bg-stone-50/50 shadow-2xs dark:border-[#1c2721] dark:bg-[#0c120e] dark:hover:border-stone-800 dark:hover:bg-[#121914]"
            }`}
        >
          <div className="flex items-center justify-between text-xs font-semibold text-stone-500 dark:text-stone-400">
            <span>Completed</span>
            <span className="h-2 w-2 rounded-full bg-stone-400 dark:bg-stone-600" />
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold font-mono text-stone-700 sm:text-3xl dark:text-stone-200">{closedCount}</span>
            <p className="mt-0.5 text-[11px] text-stone-400 dark:text-stone-500">Finished events</p>
          </div>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-y border-stone-200 py-4 dark:border-[#1c2721]">
        <div className="flex flex-wrap items-center gap-2">
          {/* Search box */}
          <div className="relative flex-1 sm:w-64">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search events by name…"
              className="w-full rounded-xl border border-stone-200 bg-white px-3.5 py-2 pl-9 text-xs text-stone-900 placeholder:text-stone-400 focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600 transition-all shadow-2xs dark:border-[#1c2721] dark:bg-[#0c120e] dark:text-stone-100 dark:placeholder:text-stone-500 dark:focus:border-emerald-500"
            />
            <span className="absolute left-3 top-2.5 text-stone-400 text-xs">🔍</span>
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-2.5 text-xs text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          {/* Event Type Filter Tabs */}
          <div className="flex items-center rounded-xl border border-stone-200 bg-stone-100/80 p-1 dark:border-[#1c2721] dark:bg-[#0a0d0b]">
            <button
              type="button"
              onClick={() => setTypeFilter("all")}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer ${typeFilter === "all"
                  ? "bg-white text-stone-900 shadow-2xs dark:bg-[#121914] dark:text-white"
                  : "text-stone-600 hover:text-stone-900 dark:text-stone-400 dark:hover:text-white"
                }`}
            >
              All Types
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter("voting")}
              className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer ${typeFilter === "voting"
                  ? "bg-white text-emerald-900 shadow-2xs dark:bg-[#121914] dark:text-emerald-300"
                  : "text-stone-600 hover:text-stone-900 dark:text-stone-400 dark:hover:text-white"
                }`}
            >
              <VoteIcon size={12} />
              <span>Voting ({votingCount})</span>
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter("ticketing")}
              className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer ${typeFilter === "ticketing"
                  ? "bg-white text-amber-900 shadow-2xs dark:bg-[#121914] dark:text-amber-300"
                  : "text-stone-600 hover:text-stone-900 dark:text-stone-400 dark:hover:text-white"
                }`}
            >
              <TicketIcon size={12} />
              <span>Tickets ({ticketCount})</span>
            </button>
          </div>

          {(statusFilter !== "all" || typeFilter !== "all") && (
            <button
              type="button"
              onClick={() => {
                setStatusFilter("all");
                setTypeFilter("all");
              }}
              className="rounded-lg border border-stone-200 bg-stone-100 px-2.5 py-1.5 text-xs font-semibold text-stone-600 hover:bg-stone-200 transition-colors dark:border-[#1c2721] dark:bg-[#121914] dark:text-stone-300 dark:hover:bg-[#18221c] cursor-pointer"
            >
              Reset filters ✕
            </button>
          )}
        </div>

        <div className="text-xs text-stone-500 font-medium dark:text-stone-400">
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
              <ReflectiveCard
                key={event.id}
                width="100%"
                height="100%"
                radius={24}
                theme="dark"
                tint="#ffffff"
                metalness={0.95}
                roughness={0.28}
                blurStrength={6}
                shine={1.2}
                glare={0.65}
                tiltStrength={10}
                contentPadding={0}
                className="flex h-full min-w-0 flex-col transition-transform duration-300 hover:scale-[1.01]"
              >
                <Link
                  href={`/organizer/${organizationId}/events/${event.id}`}
                  className="group relative flex h-full w-full min-w-0 flex-col justify-between p-6 text-white"
                >
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider backdrop-blur-md border ${
                            isLiveNow
                              ? "bg-emerald-950/80 text-emerald-300 border-emerald-500/50"
                              : isPublished
                              ? "bg-teal-950/70 text-teal-300 border-teal-500/40"
                              : isDraft
                              ? "bg-amber-950/70 text-amber-300 border-amber-500/40"
                              : "bg-white/10 text-white/70 border-white/10"
                          }`}
                        >
                          {isLiveNow && <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />}
                          {presentation.label}
                        </span>

                        {isTicketing ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/40 bg-amber-950/60 px-2.5 py-0.5 text-[10px] font-bold uppercase text-amber-300 backdrop-blur-md">
                            <TicketIcon size={12} />
                            <span>Ticketed Event</span>
                          </span>
                        ) : isHybrid ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-purple-400/40 bg-purple-950/60 px-2.5 py-0.5 text-[10px] font-bold uppercase text-purple-300 backdrop-blur-md">
                            <TicketIcon size={11} />
                            <VoteIcon size={11} />
                            <span>Hybrid</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/40 bg-emerald-950/60 px-2.5 py-0.5 text-[10px] font-bold uppercase text-emerald-300 backdrop-blur-md">
                            <VoteIcon size={11} />
                            <span>Voting Contest</span>
                          </span>
                        )}
                      </div>

                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/15 bg-white/10 text-white transition-all group-hover:bg-emerald-600 group-hover:border-emerald-500 group-hover:translate-x-0.5">
                        <Icon name="arrowRight" size={14} />
                      </div>
                    </div>

                    <h3 className="mt-3.5 text-xl font-bold text-white group-hover:text-emerald-300 transition-colors line-clamp-2">
                      {event.name}
                    </h3>

                    {event.venue_name && (
                      <p className="mt-1 text-xs font-medium text-white/80 flex items-center gap-1">
                        <span>📍</span>
                        <span className="truncate">{event.venue_name}</span>
                      </p>
                    )}

                    {event.slug && (
                      <p className="mt-1 text-xs text-white/50 font-mono">
                        /events/{event.slug}
                      </p>
                    )}
                  </div>

                  {presentation.warning && <p className="mt-3 rounded-lg border border-amber-500/30 bg-amber-950/60 p-3 text-xs text-amber-200">{presentation.warning}</p>}
                  {event.review_feedback && <p className="mt-3 line-clamp-3 text-sm text-white/80"><strong>Platform feedback: </strong>{event.review_feedback}</p>}
                  <p className="mt-3 text-xs font-semibold text-emerald-400">{presentation.action} →</p>
                  <div className="mt-6 border-t border-white/10 pt-4">
                    <div className="flex items-center justify-between text-xs text-white/60">
                      <div className="flex items-center gap-1.5">
                        <Icon name="calendar" size={13} className="text-white/40" />
                        <span>
                          {dateFormatter.format(startDate)} – {dateFormatter.format(endDate)}
                        </span>
                      </div>

                      {isTicketing ? (
                        <span className="inline-flex items-center gap-1 font-mono text-emerald-300 font-semibold text-[11px]">
                          <TicketIcon size={13} />
                          <span>Passes &amp; Tickets</span>
                        </span>
                      ) : event.unit_price_minor ? (
                        <span className="inline-flex items-center gap-1 font-mono text-emerald-300 font-semibold">
                          <VoteIcon size={12} />
                          <span>₵{(event.unit_price_minor / 100).toFixed(2)}/vote</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 font-mono text-white/60 text-[11px]">
                          <VoteIcon size={12} />
                          <span>Free ballot</span>
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              </ReflectiveCard>
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
