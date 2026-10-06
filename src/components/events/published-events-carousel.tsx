"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import type { PublicEventCardData } from "./public-event-card";
import { eventPresentation } from "@/lib/events/presentation";
import { Icon } from "@/components/icon";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GH", {
    dateStyle: "medium",
    timeZone: "Africa/Accra",
  }).format(new Date(value));
}

export function PublishedEventsCarousel({ events }: { events: PublicEventCardData[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || events.length < 2) return;
    const interval = setInterval(() => {
      setIndex((i) => (i + 1) % events.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [paused, events.length]);

  if (!events.length) {
    return (
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="rounded-3xl bg-gradient-to-br from-emerald-950 via-emerald-900 to-emerald-950 text-white p-8 sm:p-12 border border-emerald-800/40 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="max-w-xl">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-800/80 text-emerald-300 text-xs font-semibold uppercase tracking-wider mb-3">
              <Icon name="sparkle" size={14} /> Upcoming Events
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white mb-2">
              Great Ghanaian awards are launching soon.
            </h2>
            <p className="text-sm sm:text-base text-emerald-200/80 leading-relaxed">
              Published competitions, pageants, and campus awards will appear here when organizers open voting.
            </p>
          </div>
          <Link
            href="/sign-up"
            className="px-6 py-3.5 rounded-xl bg-white text-emerald-950 font-bold text-sm hover:bg-emerald-50 active:scale-95 transition-all shadow-md shrink-0"
          >
            Create an Event ＋
          </Link>
        </div>
      </section>
    );
  }

  const event = events[index];
  const state = eventPresentation(event);

  return (
    <section
      className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12"
      aria-labelledby="featured-events-heading"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setPaused(false);
      }}
    >
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
        <div>
          <span className="text-xs font-bold tracking-widest text-emerald-800 uppercase flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
            LIVE ON VOTECASTHUB
          </span>
          <h2
            id="featured-events-heading"
            className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-slate-900 mt-1"
          >
            Events worth showing up for.
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            Meet the nominees, inspect verifiable rules, and make your vote count.
          </p>
        </div>

        {/* Carousel controls */}
        {events.length > 1 && (
          <div className="flex items-center gap-3 self-start sm:self-auto">
            <button
              type="button"
              aria-label="Previous event"
              onClick={() => setIndex((index - 1 + events.length) % events.length)}
              className="w-10 h-10 rounded-full border border-slate-200 bg-white text-slate-700 hover:bg-emerald-50 hover:border-emerald-300 flex items-center justify-center transition-all active:scale-95 shadow-sm"
            >
              ←
            </button>
            <span className="text-xs font-semibold text-slate-500 font-mono" aria-live="polite">
              {String(index + 1).padStart(2, "0")} / {String(events.length).padStart(2, "0")}
            </span>
            <button
              type="button"
              aria-label="Next event"
              onClick={() => setIndex((index + 1) % events.length)}
              className="w-10 h-10 rounded-full border border-slate-200 bg-white text-slate-700 hover:bg-emerald-50 hover:border-emerald-300 flex items-center justify-center transition-all active:scale-95 shadow-sm"
            >
              →
            </button>
          </div>
        )}
      </div>

      {/* Main Feature Showcase Card */}
      <div className="relative overflow-hidden rounded-3xl bg-white border border-slate-200 shadow-[0_16px_40px_-12px_rgba(20,50,30,0.08)]">
        <AnimatePresence mode="wait">
          <motion.article
            key={event.id}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="grid grid-cols-1 lg:grid-cols-12 min-h-[420px]"
          >
            {/* Left Cover Banner */}
            <div className="lg:col-span-5 relative min-h-[260px] lg:min-h-full bg-gradient-to-br from-emerald-900 to-emerald-950 flex items-center justify-center overflow-hidden">
              {event.imageUrl ? (
                <div
                  className="absolute inset-0 bg-cover bg-center transition-transform duration-700 hover:scale-105"
                  style={{ backgroundImage: `url("${event.imageUrl}")` }}
                  role="img"
                  aria-label={`${event.name} cover`}
                >
                  <div className="absolute inset-0 bg-gradient-to-t from-emerald-950/80 via-emerald-950/20 to-transparent" />
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center text-emerald-200/40 p-6 text-center select-none">
                  <span className="text-8xl font-black font-serif italic mb-2">V</span>
                  <span className="text-xs font-semibold tracking-wider text-emerald-300/60 uppercase">
                    VotecastHub Official Event
                  </span>
                </div>
              )}

              {/* Status Pill Badge */}
              <div className="absolute top-4 left-4 z-10">
                <span className="px-3 py-1.5 rounded-full text-xs font-bold tracking-wide bg-white/90 backdrop-blur-md text-emerald-950 shadow-md flex items-center gap-1.5">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      state.key === "open" ? "bg-emerald-500 animate-pulse" : "bg-amber-500"
                    }`}
                  />
                  {state.label}
                </span>
              </div>
            </div>

            {/* Right Event Content */}
            <div className="lg:col-span-7 p-6 sm:p-10 flex flex-col justify-between">
              <div>
                {/* Voting mode badge */}
                <div className="inline-block px-3 py-1 rounded-lg text-xs font-bold tracking-wide uppercase bg-emerald-50 text-emerald-900 border border-emerald-900/10 mb-4">
                  {event.voting_mode === "paid"
                    ? `GHS ${(event.unit_price_minor / 100).toFixed(2)} PER VOTE`
                    : "FREE VERIFIED VOTING"}
                </div>

                <h3 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-slate-900 mb-3 leading-snug">
                  {event.name}
                </h3>

                <p className="text-sm sm:text-base text-slate-600 leading-relaxed mb-6 line-clamp-3">
                  {event.description ||
                    "Explore verified nominees, learn more about categories, and cast your official vote today."}
                </p>
              </div>

              {/* Voting window & action bar */}
              <div className="pt-6 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    VOTING WINDOW
                  </span>
                  <span className="text-xs sm:text-sm font-semibold text-slate-800">
                    {formatDate(event.starts_at)} — {formatDate(event.ends_at)}
                  </span>
                </div>

                <Link
                  href={`/events/${event.slug}`}
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-emerald-800 text-white font-semibold text-sm hover:bg-emerald-900 active:scale-95 transition-all shadow-sm"
                >
                  <span>{state.key === "open" ? "Vote Now" : "Explore Event"}</span>
                  <Icon name="arrowUpRight" size={16} />
                </Link>
              </div>
            </div>
          </motion.article>
        </AnimatePresence>
      </div>

      {/* Progress Dots */}
      {events.length > 1 && (
        <div className="flex justify-center items-center gap-2 mt-6">
          {events.map((item, i) => (
            <button
              key={item.id}
              type="button"
              aria-label={`Jump to ${item.name}`}
              aria-current={i === index}
              onClick={() => setIndex(i)}
              className={`h-2 rounded-full transition-all duration-300 ${
                i === index ? "w-8 bg-emerald-800" : "w-2 bg-slate-200 hover:bg-slate-300"
              }`}
            />
          ))}
        </div>
      )}
    </section>
  );
}
