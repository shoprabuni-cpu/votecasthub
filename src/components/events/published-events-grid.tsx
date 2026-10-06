"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import type { PublicEventCardData } from "./public-event-card";
import { eventPresentation } from "@/lib/events/presentation";
import { Icon } from "@/components/icon";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GH", {
    month: "short",
    day: "numeric",
    timeZone: "Africa/Accra",
  }).format(new Date(value));
}

export function PublishedEventsGrid({ events }: { events: PublicEventCardData[] }) {
  const [filter, setFilter] = useState<"all" | "live" | "free" | "paid">("all");

  const filteredEvents = events.filter((e) => {
    if (filter === "live") return e.status === "published";
    if (filter === "free") return e.voting_mode === "free";
    if (filter === "paid") return e.voting_mode === "paid";
    return true;
  });

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20" aria-labelledby="events-catalog-title">
      {/* Catalog Header with E-Commerce Style Controls */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8 pb-6 border-b border-slate-200/80">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold tracking-widest text-emerald-800 uppercase mb-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
            LIVE VERIFIED DIRECTORY
          </div>
          <h2 id="events-catalog-title" className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-slate-900">
            Featured Awards & Contests
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            Browse active public competitions, meet the nominees, and cast your verified vote.
          </p>
        </div>

        {/* Filter Pills + Browse All Link */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center p-1 rounded-xl bg-slate-100 border border-slate-200 text-xs font-medium">
            <button
              type="button"
              onClick={() => setFilter("all")}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                filter === "all" ? "bg-white text-emerald-950 font-bold shadow-xs" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              All ({events.length})
            </button>
            <button
              type="button"
              onClick={() => setFilter("live")}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                filter === "live" ? "bg-white text-emerald-950 font-bold shadow-xs" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Live Now
            </button>
            <button
              type="button"
              onClick={() => setFilter("paid")}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                filter === "paid" ? "bg-white text-emerald-950 font-bold shadow-xs" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              MoMo Paid
            </button>
            <button
              type="button"
              onClick={() => setFilter("free")}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                filter === "free" ? "bg-white text-emerald-950 font-bold shadow-xs" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Free
            </button>
          </div>

          <Link
            href="/events"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-emerald-800 hover:text-emerald-950 hover:bg-emerald-50 rounded-lg transition-colors ml-auto sm:ml-0"
          >
            <span>View All</span>
            <Icon name="arrowUpRight" size={14} />
          </Link>
        </div>
      </div>

      {/* Mobile Swipe Hint */}
      <div className="sm:hidden flex items-center justify-between text-[11px] text-slate-500 font-medium mb-3">
        <span>Browse {filteredEvents.length} events</span>
        <span className="flex items-center gap-1 text-emerald-800 font-semibold">Swipe to explore →</span>
      </div>

      {/* Events Shelf Grid (Mobile Horizontal Reel / Desktop E-Commerce Product Shelf) */}
      {filteredEvents.length > 0 ? (
        <div className="flex sm:grid overflow-x-auto sm:overflow-visible snap-x snap-mandatory gap-4 sm:gap-6 pb-4 sm:pb-0 -mx-4 px-4 sm:mx-0 sm:px-0 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <AnimatePresence mode="popLayout">
            {filteredEvents.map((event) => {
              const state = eventPresentation(event);
              const isOpen = state.key === "open";
              const priceLabel =
                event.voting_mode === "paid"
                  ? `GHS ${(event.unit_price_minor / 100).toFixed(2)}`
                  : "Free";

              return (
                <motion.article
                  key={event.id}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.25 }}
                  className="group flex flex-col w-[260px] xs:w-[280px] sm:w-auto shrink-0 snap-start rounded-2xl bg-white border border-slate-200/90 hover:border-emerald-500/50 hover:shadow-lg transition-all duration-300 overflow-hidden"
                >
                  {/* Card Cover (E-Commerce Product Image Aspect) */}
                  <Link href={`/events/${event.slug}`} className="relative aspect-[16/10] bg-slate-900 overflow-hidden block">
                    {event.imageUrl ? (
                      <div
                        className="w-full h-full bg-cover bg-center transition-transform duration-500 group-hover:scale-105"
                        style={{ backgroundImage: `url("${event.imageUrl}")` }}
                        role="img"
                        aria-label={`${event.name} cover`}
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-emerald-900 via-emerald-950 to-slate-950 flex flex-col items-center justify-center text-emerald-100 select-none">
                        <span className="text-4xl font-serif font-black italic">V</span>
                        <span className="text-[10px] font-semibold text-emerald-300/80 uppercase tracking-widest mt-1">
                          VotecastHub
                        </span>
                      </div>
                    )}

                    {/* Gradient Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/60 via-transparent to-transparent pointer-events-none" />

                    {/* Top Status Pill */}
                    <div className="absolute top-3 left-3 z-10">
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide bg-white/95 backdrop-blur-md text-slate-900 shadow-sm flex items-center gap-1.5">
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            isOpen ? "bg-emerald-500 animate-pulse" : "bg-amber-500"
                          }`}
                        />
                        {state.label}
                      </span>
                    </div>

                    {/* Top Price Tag */}
                    <div className="absolute top-3 right-3 z-10">
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold tracking-wide bg-emerald-900/90 text-white backdrop-blur-md border border-emerald-500/30 shadow-sm">
                        {priceLabel}
                      </span>
                    </div>

                    {/* Bottom Date Ribbon on Image */}
                    <div className="absolute bottom-2.5 left-3 right-3 z-10 text-[11px] font-medium text-white/90 flex items-center gap-1">
                      <Icon name="calendar" size={12} className="text-emerald-300" />
                      <span>
                        {formatDate(event.starts_at)} – {formatDate(event.ends_at)}
                      </span>
                    </div>
                  </Link>

                  {/* Card Content & Action Button */}
                  <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between">
                    <div>
                      <h3 className="text-base font-bold text-slate-900 group-hover:text-emerald-800 transition-colors line-clamp-2 leading-snug mb-1.5">
                        <Link href={`/events/${event.slug}`}>{event.name}</Link>
                      </h3>
                      <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed mb-4">
                        {event.description || "Discover verified nominees and cast your vote."}
                      </p>
                    </div>

                    {/* Action Button */}
                    <Link
                      href={`/events/${event.slug}`}
                      className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold text-center inline-flex items-center justify-center gap-2 transition-all active:scale-95 shadow-xs ${
                        isOpen
                          ? "bg-emerald-800 hover:bg-emerald-900 text-white"
                          : "bg-slate-100 hover:bg-slate-200 text-slate-800"
                      }`}
                    >
                      <span>{isOpen ? "Vote Now" : "Explore Event"}</span>
                      <Icon name="arrowUpRight" size={14} className={isOpen ? "text-emerald-200" : "text-slate-500"} />
                    </Link>
                  </div>
                </motion.article>
              );
            })}
          </AnimatePresence>
        </div>
      ) : (
        /* Empty State */
        <div className="rounded-3xl bg-white border border-slate-200 p-8 sm:p-12 text-center max-w-xl mx-auto shadow-sm">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-800 flex items-center justify-center mx-auto mb-4">
            <Icon name="trophy" size={24} />
          </div>
          <h3 className="text-lg font-bold text-slate-900 mb-1">No events matching this filter</h3>
          <p className="text-xs sm:text-sm text-slate-500 mb-6">
            Check back soon or create your own Ghanaian award contest to start receiving verified votes.
          </p>
          <div className="flex justify-center gap-3">
            <button
              type="button"
              onClick={() => setFilter("all")}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-800"
            >
              Reset Filter
            </button>
            <Link
              href="/sign-up"
              className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-800 hover:bg-emerald-900 text-white shadow-xs"
            >
              Host an Event ＋
            </Link>
          </div>
        </div>
      )}
    </section>
  );
}
