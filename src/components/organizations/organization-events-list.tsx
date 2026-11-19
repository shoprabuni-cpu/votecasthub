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

type FolderType = "all" | "voting" | "ticketing";
type ViewMode = "list" | "grid";

export function OrganizationEventsList({ events, organizationId, now }: Props) {
  const [activeFolder, setActiveFolder] = useState<FolderType>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("list");

  // Folder Counts
  const ticketCount = useMemo(
    () => events.filter((e) => e.event_type === "ticketing" || e.event_type === "hybrid").length,
    [events]
  );
  const votingCount = useMemo(
    () => events.filter((e) => e.event_type !== "ticketing").length,
    [events]
  );

  // Status Counts
  const publishedCount = useMemo(() => events.filter((e) => e.status === "published").length, [events]);
  const draftCount = useMemo(() => events.filter((e) => e.status === "draft").length, [events]);
  const closedCount = useMemo(() => events.filter((e) => e.status === "closed" || e.status === "archived").length, [events]);

  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      // Folder type match
      const matchesFolder =
        activeFolder === "all"
          ? true
          : activeFolder === "ticketing"
            ? event.event_type === "ticketing" || event.event_type === "hybrid"
            : event.event_type !== "ticketing";

      // Status match
      const matchesStatus =
        statusFilter === "all"
          ? true
          : statusFilter === "closed"
            ? event.status === "closed" || event.status === "archived"
            : event.status === statusFilter;

      // Search match
      const query = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !query ||
        event.name.toLowerCase().includes(query) ||
        (event.venue_name && event.venue_name.toLowerCase().includes(query)) ||
        (event.slug && event.slug.toLowerCase().includes(query));

      return matchesFolder && matchesStatus && matchesSearch;
    });
  }, [events, activeFolder, statusFilter, searchQuery]);

  const dateFormatter = new Intl.DateTimeFormat("en-GH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "Africa/Accra",
  });

  return (
    <div className="space-y-4">
      {/* =========================================================================
          FOLDER UI DIRECTORY TABS
          Organizes events into discrete folders: Voting, Ticketing, and All.
          Minimizes visual clutter with compact folder cards.
          ========================================================================= */}
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
        {/* Voting Contests Folder */}
        <button
          type="button"
          onClick={() => setActiveFolder("voting")}
          className={`group relative flex items-center justify-between rounded-xl border p-3 text-left transition-all cursor-pointer ${
            activeFolder === "voting"
              ? "border-emerald-600 bg-emerald-50/70 shadow-xs ring-2 ring-emerald-600/10 dark:border-emerald-500/80 dark:bg-emerald-950/40"
              : "border-stone-200/90 bg-white hover:border-emerald-300 hover:bg-stone-50/60 dark:border-[#1c2721] dark:bg-[#0c120e] dark:hover:border-stone-700"
          }`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-colors ${
                activeFolder === "voting"
                  ? "border-emerald-500 bg-emerald-600 text-white dark:bg-emerald-500"
                  : "border-stone-200 bg-stone-100 text-stone-600 group-hover:border-emerald-300 dark:border-[#1c2721] dark:bg-[#141d18] dark:text-stone-300"
              }`}
            >
              {activeFolder === "voting" ? (
                <Icon name="folderOpen" size={17} />
              ) : (
                <Icon name="folder" size={17} />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-stone-900 dark:text-white truncate">
                  Voting Contests
                </span>
                <span
                  className={`inline-flex items-center rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                    activeFolder === "voting"
                      ? "bg-emerald-600 text-white dark:bg-emerald-500"
                      : "bg-stone-200/80 text-stone-700 dark:bg-[#1c2721] dark:text-stone-300"
                  }`}
                >
                  {votingCount}
                </span>
              </div>
              <p className="text-[11px] text-stone-500 dark:text-stone-400 truncate">
                Elections, awards &amp; polls
              </p>
            </div>
          </div>
          {activeFolder === "voting" && (
            <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500 animate-pulse" />
          )}
        </button>

        {/* Ticketed Events Folder */}
        <button
          type="button"
          onClick={() => setActiveFolder("ticketing")}
          className={`group relative flex items-center justify-between rounded-xl border p-3 text-left transition-all cursor-pointer ${
            activeFolder === "ticketing"
              ? "border-amber-500 bg-amber-50/70 shadow-xs ring-2 ring-amber-500/10 dark:border-amber-500/80 dark:bg-amber-950/40"
              : "border-stone-200/90 bg-white hover:border-amber-300 hover:bg-stone-50/60 dark:border-[#1c2721] dark:bg-[#0c120e] dark:hover:border-stone-700"
          }`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-colors ${
                activeFolder === "ticketing"
                  ? "border-amber-500 bg-amber-500 text-white dark:bg-amber-600"
                  : "border-stone-200 bg-stone-100 text-stone-600 group-hover:border-amber-300 dark:border-[#1c2721] dark:bg-[#141d18] dark:text-stone-300"
              }`}
            >
              {activeFolder === "ticketing" ? (
                <Icon name="folderOpen" size={17} />
              ) : (
                <Icon name="folder" size={17} />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-stone-900 dark:text-white truncate">
                  Ticketed &amp; Passes
                </span>
                <span
                  className={`inline-flex items-center rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                    activeFolder === "ticketing"
                      ? "bg-amber-600 text-white dark:bg-amber-500"
                      : "bg-stone-200/80 text-stone-700 dark:bg-[#1c2721] dark:text-stone-300"
                  }`}
                >
                  {ticketCount}
                </span>
              </div>
              <p className="text-[11px] text-stone-500 dark:text-stone-400 truncate">
                Concerts, galas &amp; summits
              </p>
            </div>
          </div>
          {activeFolder === "ticketing" && (
            <span className="h-2 w-2 shrink-0 rounded-full bg-amber-500 animate-pulse" />
          )}
        </button>

        {/* All Events Folder */}
        <button
          type="button"
          onClick={() => setActiveFolder("all")}
          className={`group relative flex items-center justify-between rounded-xl border p-3 text-left transition-all cursor-pointer ${
            activeFolder === "all"
              ? "border-stone-900 bg-stone-100 shadow-xs ring-2 ring-stone-900/10 dark:border-stone-300 dark:bg-[#141d18]"
              : "border-stone-200/90 bg-white hover:border-stone-400 hover:bg-stone-50/60 dark:border-[#1c2721] dark:bg-[#0c120e] dark:hover:border-stone-700"
          }`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-colors ${
                activeFolder === "all"
                  ? "border-stone-900 bg-stone-900 text-white dark:bg-white dark:text-stone-900"
                  : "border-stone-200 bg-stone-100 text-stone-600 group-hover:border-stone-400 dark:border-[#1c2721] dark:bg-[#141d18] dark:text-stone-300"
              }`}
            >
              {activeFolder === "all" ? (
                <Icon name="folderOpen" size={17} />
              ) : (
                <Icon name="folder" size={17} />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-stone-900 dark:text-white truncate">
                  All Files &amp; Events
                </span>
                <span
                  className={`inline-flex items-center rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                    activeFolder === "all"
                      ? "bg-stone-900 text-white dark:bg-white dark:text-stone-900"
                      : "bg-stone-200/80 text-stone-700 dark:bg-[#1c2721] dark:text-stone-300"
                  }`}
                >
                  {events.length}
                </span>
              </div>
              <p className="text-[11px] text-stone-500 dark:text-stone-400 truncate">
                Complete directory
              </p>
            </div>
          </div>
          {activeFolder === "all" && (
            <span className="h-2 w-2 shrink-0 rounded-full bg-stone-900 dark:bg-white animate-pulse" />
          )}
        </button>
      </div>

      {/* =========================================================================
          DIRECTORY TOOLBAR
          Breadcrumb, Status Filter Chips, Search, and View Mode Toggle
          ========================================================================= */}
      <div className="flex flex-col gap-3 rounded-xl border border-stone-200/90 bg-white p-3 shadow-2xs sm:flex-row sm:items-center sm:justify-between dark:border-[#1c2721] dark:bg-[#0c120e]">
        {/* Left: Breadcrumb + Search */}
        <div className="flex flex-1 flex-col gap-2.5 sm:flex-row sm:items-center">
          {/* Breadcrumb Path */}
          <div className="inline-flex items-center gap-1.5 text-xs text-stone-500 dark:text-stone-400 shrink-0">
            <Icon name="folder" size={14} className="text-stone-400" />
            <span className="text-stone-400 dark:text-stone-600">/</span>
            <span className="font-semibold text-stone-800 dark:text-stone-200">
              {activeFolder === "voting"
                ? "Voting Contests"
                : activeFolder === "ticketing"
                ? "Ticketed Events"
                : "All Events"}
            </span>
            <span className="font-mono text-[11px] text-stone-400">
              ({filteredEvents.length})
            </span>
          </div>

          {/* Search Field */}
          <div className="relative flex-1 max-w-sm">
            <Icon
              name="search"
              size={14}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400"
            />
            <input
              type="text"
              placeholder="Filter by title, venue or slug..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-stone-200 bg-stone-50/70 py-1.5 pl-8 pr-7 text-xs font-medium text-stone-900 placeholder:text-stone-400 focus:border-emerald-600 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-600/20 dark:border-[#1c2721] dark:bg-[#141d18] dark:text-white dark:placeholder:text-stone-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200"
              >
                <Icon name="close" size={12} />
              </button>
            )}
          </div>
        </div>

        {/* Right: Status Filter Pills + View Switcher */}
        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          {/* Status Pills */}
          <div className="inline-flex items-center gap-1 rounded-lg bg-stone-100 p-0.5 dark:bg-[#141d18] border border-stone-200/80 dark:border-[#1c2721]">
            <button
              type="button"
              onClick={() => setStatusFilter("all")}
              className={`rounded-md px-2 py-1 text-[11px] font-semibold transition cursor-pointer ${
                statusFilter === "all"
                  ? "bg-white text-stone-900 shadow-2xs dark:bg-stone-900 dark:text-white"
                  : "text-stone-600 hover:text-stone-900 dark:text-stone-400 dark:hover:text-white"
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("published")}
              className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold transition cursor-pointer ${
                statusFilter === "published"
                  ? "bg-emerald-600 text-white shadow-2xs dark:bg-emerald-600"
                  : "text-emerald-800 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/40"
              }`}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              <span>Published ({publishedCount})</span>
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("draft")}
              className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold transition cursor-pointer ${
                statusFilter === "draft"
                  ? "bg-amber-600 text-white shadow-2xs dark:bg-amber-600"
                  : "text-amber-800 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950/40"
              }`}
            >
              <span>Draft ({draftCount})</span>
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("closed")}
              className={`rounded-md px-2 py-1 text-[11px] font-semibold transition cursor-pointer ${
                statusFilter === "closed"
                  ? "bg-stone-700 text-white shadow-2xs dark:bg-stone-600"
                  : "text-stone-600 hover:text-stone-900 dark:text-stone-400 dark:hover:text-white"
              }`}
            >
              Closed ({closedCount})
            </button>
          </div>

          {/* View Mode Switcher */}
          <div className="inline-flex items-center rounded-lg border border-stone-200/80 bg-stone-100 p-0.5 dark:border-[#1c2721] dark:bg-[#141d18]">
            <button
              type="button"
              onClick={() => setViewMode("list")}
              title="Compact List View"
              className={`rounded-md p-1.5 transition cursor-pointer ${
                viewMode === "list"
                  ? "bg-white text-emerald-800 shadow-2xs dark:bg-stone-900 dark:text-emerald-400"
                  : "text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-white"
              }`}
            >
              <Icon name="list" size={14} />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              title="Compact Folder Grid"
              className={`rounded-md p-1.5 transition cursor-pointer ${
                viewMode === "grid"
                  ? "bg-white text-emerald-800 shadow-2xs dark:bg-stone-900 dark:text-emerald-400"
                  : "text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-white"
              }`}
            >
              <Icon name="grid" size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* =========================================================================
          DIRECTORY CONTENTS
          Compact List (Default) or Compact Folder Grid
          ========================================================================= */}
      {filteredEvents.length > 0 ? (
        viewMode === "list" ? (
          /* ================= COMPACT LIST VIEW (~54px per row) ================= */
          <div className="overflow-hidden rounded-xl border border-stone-200/90 bg-white shadow-2xs dark:border-[#1c2721] dark:bg-[#0c120e]">
            {/* Table Header */}
            <div className="hidden grid-cols-12 items-center gap-3 border-b border-stone-200/80 bg-stone-50/80 px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-stone-500 md:grid dark:border-[#1c2721] dark:bg-[#141d18] dark:text-stone-400">
              <div className="col-span-5">Event / Workspace</div>
              <div className="col-span-2">Type</div>
              <div className="col-span-2">Status</div>
              <div className="col-span-1">Rate / Info</div>
              <div className="col-span-2 text-right">Actions</div>
            </div>

            {/* List Rows */}
            <div className="divide-y divide-stone-100 dark:divide-[#1c2721]">
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
                    className="group flex flex-col gap-3 p-3 transition-colors hover:bg-stone-50/70 md:grid md:grid-cols-12 md:items-center md:gap-3 md:px-4 md:py-2.5 dark:hover:bg-[#141d18]/60"
                  >
                    {/* Col 1: Thumbnail + Title + Venue (Span 5) */}
                    <div className="col-span-5 flex items-center gap-3 min-w-0">
                      {/* Mini Thumbnail or Folder Icon */}
                      <Link
                        href={`/organizer/${organizationId}/events/${event.id}`}
                        className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-stone-200 bg-stone-100 dark:border-[#1c2721] dark:bg-[#141b16]"
                      >
                        {event.imageUrl ? (
                          <Image
                            src={event.imageUrl}
                            alt={event.name}
                            fill
                            unoptimized
                            sizes="40px"
                            className="object-cover transition-transform duration-300 group-hover:scale-110"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-stone-400 dark:text-stone-500">
                            {isTicketing ? (
                              <TicketIcon size={16} />
                            ) : (
                              <VoteIcon size={16} />
                            )}
                          </div>
                        )}
                      </Link>

                      {/* Title & Subtitle */}
                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/organizer/${organizationId}/events/${event.id}`}
                          className="block truncate text-xs font-bold text-stone-900 group-hover:text-emerald-700 dark:text-white dark:group-hover:text-emerald-400 transition-colors"
                        >
                          {event.name}
                        </Link>
                        <div className="flex items-center gap-2 text-[11px] text-stone-500 dark:text-stone-400 truncate">
                          {event.venue_name ? (
                            <span className="truncate">📍 {event.venue_name}</span>
                          ) : event.slug ? (
                            <span className="font-mono text-stone-400">/{event.slug}</span>
                          ) : (
                            <span>{dateFormatter.format(startDate)}</span>
                          )}
                          {event.review_feedback && (
                            <span
                              title={`Platform feedback: ${event.review_feedback}`}
                              className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-0.2 text-[10px] font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                            >
                              Notice
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Col 2: Type Pill (Span 2) */}
                    <div className="col-span-2 flex items-center">
                      {isTicketing ? (
                        <span className="inline-flex items-center gap-1 rounded-md border border-amber-300/80 bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/60 dark:text-amber-300">
                          <TicketIcon size={11} />
                          <span>Ticketed</span>
                        </span>
                      ) : isHybrid ? (
                        <span className="inline-flex items-center gap-1 rounded-md border border-purple-300/80 bg-purple-50 px-2 py-0.5 text-[10px] font-bold uppercase text-purple-900 dark:border-purple-900/60 dark:bg-purple-950/60 dark:text-purple-300">
                          <TicketIcon size={10} />
                          <VoteIcon size={10} />
                          <span>Hybrid</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-md border border-emerald-300/80 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/60 dark:text-emerald-300">
                          <VoteIcon size={10} />
                          <span>Voting</span>
                        </span>
                      )}
                    </div>

                    {/* Col 3: Status Badge + Live indicator (Span 2) */}
                    <div className="col-span-2 flex items-center">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold border ${
                          isLiveNow
                            ? "bg-emerald-50 text-emerald-900 border-emerald-300 dark:bg-emerald-950/70 dark:text-emerald-300 dark:border-emerald-800"
                            : isPublished
                            ? "bg-teal-50 text-teal-900 border-teal-300 dark:bg-teal-950/60 dark:text-teal-300 dark:border-teal-800"
                            : isDraft
                            ? "bg-amber-50 text-amber-900 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800"
                            : "bg-stone-100 text-stone-600 border-stone-200 dark:bg-stone-900 dark:text-stone-400 dark:border-stone-800"
                        }`}
                      >
                        {isLiveNow && (
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        )}
                        {presentation.label}
                      </span>
                    </div>

                    {/* Col 4: Pricing / Unit Info (Span 1) */}
                    <div className="col-span-1 text-[11px] font-medium text-stone-600 dark:text-stone-300">
                      {isTicketing ? (
                        <span className="font-mono text-amber-800 dark:text-amber-300 font-semibold">
                          Passes
                        </span>
                      ) : event.unit_price_minor ? (
                        <span className="font-mono text-emerald-800 dark:text-emerald-300 font-semibold">
                          ₵{(event.unit_price_minor / 100).toFixed(2)}
                        </span>
                      ) : (
                        <span className="text-stone-400">Free</span>
                      )}
                    </div>

                    {/* Col 5: Actions (Span 2) */}
                    <div className="col-span-2 flex items-center justify-end gap-1.5">
                      {/* Gate Scanner link for ticketed/hybrid */}
                      {(isTicketing || isHybrid) && (
                        <Link
                          href="/gate"
                          title="Open Gate Check-in Scanner"
                          className="inline-flex items-center gap-1 rounded-md border border-amber-300/80 bg-amber-50/80 px-2 py-1 text-[11px] font-semibold text-amber-800 hover:bg-amber-100 transition-colors dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300"
                        >
                          <span>Scanner</span>
                        </Link>
                      )}

                      {/* Public Preview */}
                      <Link
                        href={`/organizer/${organizationId}/events/${event.id}/preview`}
                        title="View Public Preview"
                        className="inline-flex items-center gap-1 rounded-md border border-stone-200 bg-white p-1 text-stone-600 hover:border-stone-300 hover:text-stone-900 transition-colors dark:border-[#1c2721] dark:bg-[#141d18] dark:text-stone-400 dark:hover:text-white"
                      >
                        <Icon name="externalLink" size={13} />
                      </Link>

                      {/* Manage Workspace */}
                      <Link
                        href={`/organizer/${organizationId}/events/${event.id}`}
                        className="inline-flex items-center gap-1 rounded-md bg-stone-900 px-2.5 py-1 text-[11px] font-semibold text-white shadow-2xs hover:bg-emerald-800 transition-colors dark:bg-emerald-600 dark:hover:bg-emerald-500"
                      >
                        <span>Manage</span>
                        <Icon name="arrowRight" size={11} />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* ================= COMPACT FOLDER GRID VIEW ================= */
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
                  className="group relative flex flex-col justify-between overflow-hidden rounded-xl border border-stone-200/90 bg-white p-3.5 shadow-2xs transition-all hover:border-emerald-300 hover:shadow-sm dark:border-[#1c2721] dark:bg-[#0c120e] dark:hover:border-emerald-800/80"
                >
                  {/* Top folder bar: thumbnail + status */}
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-lg border border-stone-200 bg-stone-100 dark:border-[#1c2721] dark:bg-[#141b16]">
                        {event.imageUrl ? (
                          <Image
                            src={event.imageUrl}
                            alt={event.name}
                            fill
                            unoptimized
                            sizes="36px"
                            className="object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-stone-400">
                            {isTicketing ? <TicketIcon size={15} /> : <VoteIcon size={15} />}
                          </div>
                        )}
                      </div>

                      <div className="min-w-0">
                        <Link
                          href={`/organizer/${organizationId}/events/${event.id}`}
                          className="block truncate text-xs font-bold text-stone-900 group-hover:text-emerald-700 dark:text-white dark:group-hover:text-emerald-400 transition-colors"
                        >
                          {event.name}
                        </Link>
                        <p className="truncate text-[11px] text-stone-400 dark:text-stone-500">
                          {event.venue_name ? `📍 ${event.venue_name}` : `/events/${event.slug || event.id}`}
                        </p>
                      </div>
                    </div>

                    <span
                      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold border ${
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
                  </div>

                  {/* Middle Info & Badges */}
                  <div className="mt-3 flex items-center justify-between border-t border-stone-100 pt-2.5 text-[11px] text-stone-500 dark:border-[#1c2721] dark:text-stone-400">
                    <div className="flex items-center gap-1.5">
                      {isTicketing ? (
                        <span className="inline-flex items-center gap-1 font-semibold text-amber-800 dark:text-amber-300">
                          <TicketIcon size={12} />
                          <span>Tickets</span>
                        </span>
                      ) : isHybrid ? (
                        <span className="inline-flex items-center gap-1 font-semibold text-purple-800 dark:text-purple-300">
                          <span>Hybrid</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 font-semibold text-emerald-800 dark:text-emerald-300">
                          <VoteIcon size={12} />
                          <span>Voting</span>
                        </span>
                      )}
                      <span>•</span>
                      <span>{dateFormatter.format(startDate)}</span>
                    </div>

                    <Link
                      href={`/organizer/${organizationId}/events/${event.id}`}
                      className="inline-flex items-center gap-1 font-semibold text-emerald-800 hover:underline dark:text-emerald-400"
                    >
                      <span>Open</span>
                      <Icon name="arrowRight" size={11} />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : (
        /* Empty Folder Directory State */
        <div className="rounded-xl border border-dashed border-stone-300 bg-white p-8 text-center shadow-2xs dark:border-[#1c2721] dark:bg-[#0c120e]">
          <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-stone-100 text-stone-400 dark:bg-[#141d18] dark:text-stone-500">
            <Icon name="folderOpen" size={20} />
          </div>
          <h3 className="text-xs font-bold text-stone-900 dark:text-white">
            {searchQuery
              ? "No files match your search"
              : activeFolder === "ticketing"
              ? "No Ticketed Events in this folder"
              : activeFolder === "voting"
              ? "No Voting Contests in this folder"
              : "No events in this folder"}
          </h3>
          <p className="mx-auto mt-1 max-w-xs text-[11px] text-stone-500 dark:text-stone-400">
            {searchQuery
              ? `No items found matching "${searchQuery}". Clear your search or check another folder.`
              : activeFolder !== "all"
              ? "Switch to 'All Files & Events' or create a new event in this workspace."
              : "You haven't created any events in this organization yet."}
          </p>

          <div className="mt-3.5 flex items-center justify-center gap-2">
            {(searchQuery || statusFilter !== "all" || activeFolder !== "all") && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setStatusFilter("all");
                  setActiveFolder("all");
                }}
                className="rounded-lg border border-stone-200 bg-stone-100 px-3 py-1.5 text-xs font-semibold text-stone-700 hover:bg-stone-200 transition-colors dark:border-[#1c2721] dark:bg-[#141d18] dark:text-stone-300 dark:hover:bg-[#1c2721] cursor-pointer"
              >
                Reset folder view
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
