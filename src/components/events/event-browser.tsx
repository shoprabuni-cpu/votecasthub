"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PublicEventCard, type PublicEventCardData } from "./public-event-card";
import { Icon } from "@/components/icon";

export function EventBrowser({ events }: { events: PublicEventCardData[] }) {
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<"all" | "free" | "paid">("all");
  const [status, setStatus] = useState<"all" | "published" | "paused" | "closed">("all");
  const [sortBy, setSortBy] = useState<"endingSoon" | "newest" | "priceAsc" | "name">("endingSoon");

  const filtered = useMemo(() => {
    const list = events.filter((e) => {
      const text = `${e.name} ${e.description ?? ""}`.toLowerCase();
      const matchesQuery = !query || text.includes(query.toLowerCase().trim());
      const matchesMode = mode === "all" || e.voting_mode === mode;
      const matchesStatus = status === "all" || e.status === status;
      return matchesQuery && matchesMode && matchesStatus;
    });

    return list.sort((a, b) => {
      if (sortBy === "endingSoon") {
        return new Date(a.ends_at).getTime() - new Date(b.ends_at).getTime();
      }
      if (sortBy === "newest") {
        return new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime();
      }
      if (sortBy === "priceAsc") {
        return a.unit_price_minor - b.unit_price_minor;
      }
      if (sortBy === "name") {
        return a.name.localeCompare(b.name);
      }
      return 0;
    });
  }, [events, mode, query, status, sortBy]);

  const hasActiveFilters = query !== "" || mode !== "all" || status !== "all";

  function clearFilters() {
    setQuery("");
    setMode("all");
    setStatus("all");
    setSortBy("endingSoon");
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      {/* Search & Filter Toolbar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-sm mb-8 space-y-4">
        <div className="flex flex-col md:flex-row gap-3.5">
          {/* Search Box */}
          <div className="relative flex-1">
            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Icon name="sparkle" size={16} />
            </span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by event name or keyword…"
              className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-700 focus:bg-white transition-all"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600"
                aria-label="Clear search query"
              >
                ✕
              </button>
            )}
          </div>

          {/* Status Dropdown */}
          <div className="flex items-center gap-2">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as typeof status)}
              className="py-2.5 px-3 rounded-xl border border-slate-200 bg-slate-50/50 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-700 cursor-pointer"
              aria-label="Filter by event status"
            >
              <option value="all">All Statuses</option>
              <option value="published">Voting Open</option>
              <option value="paused">Paused</option>
              <option value="closed">Closed</option>
            </select>

            {/* Sort Dropdown */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="py-2.5 px-3 rounded-xl border border-slate-200 bg-slate-50/50 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-700 cursor-pointer"
              aria-label="Sort events"
            >
              <option value="endingSoon">Ending Soonest</option>
              <option value="newest">Newest First</option>
              <option value="priceAsc">Price (Lowest)</option>
              <option value="name">Alphabetical</option>
            </select>
          </div>
        </div>

        {/* Filter Pills Bar & Counter */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 text-xs">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-slate-400 font-medium mr-1">Type:</span>
            <button
              type="button"
              onClick={() => setMode("all")}
              className={`px-3 py-1 rounded-lg font-semibold transition-all ${
                mode === "all"
                  ? "bg-emerald-800 text-white shadow-xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              All Types
            </button>
            <button
              type="button"
              onClick={() => setMode("paid")}
              className={`px-3 py-1 rounded-lg font-semibold transition-all ${
                mode === "paid"
                  ? "bg-emerald-800 text-white shadow-xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              MoMo Paid
            </button>
            <button
              type="button"
              onClick={() => setMode("free")}
              className={`px-3 py-1 rounded-lg font-semibold transition-all ${
                mode === "free"
                  ? "bg-emerald-800 text-white shadow-xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              Free Verified
            </button>
          </div>

          <div className="flex items-center gap-3 text-slate-500 font-medium ml-auto">
            <span>
              Showing <strong className="text-slate-900">{filtered.length}</strong> of{" "}
              {events.length} events
            </span>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="text-emerald-800 hover:underline font-semibold"
              >
                Reset filters
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Events Shelf Grid (E-Commerce Product Display: 4 Columns on Large Screens) */}
      {filtered.length > 0 ? (
        <section
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
          aria-label="Events catalog"
        >
          <AnimatePresence mode="popLayout">
            {filtered.map((event) => (
              <PublicEventCard event={event} key={event.id} />
            ))}
          </AnimatePresence>
        </section>
      ) : (
        /* Empty State */
        <div className="rounded-3xl bg-white border border-slate-200 p-8 sm:p-14 text-center max-w-lg mx-auto shadow-sm">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-800 flex items-center justify-center mx-auto mb-4">
            <Icon name="trophy" size={24} />
          </div>
          <h2 className="text-lg font-bold text-slate-900 mb-1">No matching events found</h2>
          <p className="text-xs sm:text-sm text-slate-500 mb-6">
            We couldn’t find any events matching your search or filters. Try adjusting your query or clear the filters.
          </p>
          <button
            type="button"
            onClick={clearFilters}
            className="px-5 py-2.5 rounded-xl text-xs font-bold bg-emerald-800 hover:bg-emerald-900 text-white active:scale-95 transition-all shadow-xs"
          >
            Clear All Filters
          </button>
        </div>
      )}
    </div>
  );
}
