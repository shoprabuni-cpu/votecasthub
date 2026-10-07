"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import type { PublicEventCardData } from "./public-event-card";
import { eventPresentation } from "@/lib/events/presentation";

function ghDate(value: string) {
  return new Intl.DateTimeFormat("en-GH", {
    dateStyle: "medium",
    timeZone: "Africa/Accra",
  }).format(new Date(value));
}

export function PublishedEventsCarousel({ events }: { events: PublicEventCardData[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [direction, setDirection] = useState(1);

  const go = useCallback(
    (next: number) => {
      setDirection(next > index ? 1 : -1);
      setIndex(next);
    },
    [index]
  );

  useEffect(() => {
    if (paused || events.length < 2) return;
    const id = window.setInterval(() => {
      setDirection(1);
      setIndex((i) => (i + 1) % events.length);
    }, 5500);
    return () => window.clearInterval(id);
  }, [paused, events.length]);

  if (!events.length) {
    return (
      <section className="bg-stone-50/60 border-y border-stone-200/80 py-20 px-6 text-center">
        <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-700">On the platform</p>
        <h2 className="mt-3 font-serif text-3xl sm:text-4xl font-medium tracking-tight text-stone-900">
          Great events are coming.
        </h2>
        <p className="mt-3 text-sm text-stone-500 max-w-sm mx-auto leading-relaxed">
          Published awards and competitions appear here when organizers are ready to welcome voters.
        </p>
        <Link
          href="/sign-up"
          className="mt-7 inline-flex items-center gap-2 rounded-xl bg-emerald-900 px-5 py-2.5 text-xs font-semibold text-white hover:bg-emerald-800 transition-all active:scale-95"
        >
          Create an event
        </Link>
      </section>
    );
  }

  const event = events[index];
  const state = eventPresentation(event);

  const variants = {
    enter: (dir: number) => ({ x: dir > 0 ? 60 : -60, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: dir > 0 ? -60 : 60, opacity: 0 }),
  };

  return (
    <section
      className="relative overflow-hidden bg-gradient-to-br from-emerald-950 via-[#0f3325] to-emerald-950 py-16 sm:py-20"
      aria-labelledby="featured-events-title"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setPaused(false);
      }}
    >
      {/* Decorative blobs */}
      <div className="pointer-events-none absolute -top-32 -left-32 h-96 w-96 rounded-full bg-emerald-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-emerald-400/10 blur-3xl" />

      <div className="relative mx-auto max-w-6xl px-5 sm:px-8">
        {/* Header row */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-5 mb-10">
          <div>
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-300">
                Live on VotecastHub
              </p>
            </div>
            <h2 id="featured-events-title" className="mt-2 font-serif text-2xl sm:text-3xl font-medium tracking-tight text-white">
              Events worth showing up for.
            </h2>
            <p className="mt-1.5 text-xs text-emerald-100/70 max-w-sm">
              Meet the nominees, understand the rules, and make your voice count.
            </p>
          </div>

          {/* Controls */}
          {events.length > 1 && (
            <div className="flex items-center gap-3 shrink-0">
              <button
                type="button"
                aria-label="Previous event"
                onClick={() => go((index - 1 + events.length) % events.length)}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/20 text-white hover:bg-white/10 transition-all active:scale-90 cursor-pointer"
              >
                ←
              </button>
              <span className="font-mono text-xs text-emerald-200/80 tabular-nums">
                {String(index + 1).padStart(2, "0")} / {String(events.length).padStart(2, "0")}
              </span>
              <button
                type="button"
                aria-label="Next event"
                onClick={() => go((index + 1) % events.length)}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/20 text-white hover:bg-white/10 transition-all active:scale-90 cursor-pointer"
              >
                →
              </button>
            </div>
          )}
        </div>

        {/* Slide */}
        <div className="relative overflow-hidden rounded-3xl">
          <AnimatePresence custom={direction} mode="wait">
            <motion.article
              key={event.id}
              custom={direction}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.32, ease: [0.32, 0, 0.67, 0] }}
              className="grid grid-cols-1 sm:grid-cols-[1fr_1.1fr] overflow-hidden rounded-3xl border border-white/10 bg-white/5 backdrop-blur-sm"
            >
              {/* Image pane */}
              <div
                className={`relative min-h-[220px] sm:min-h-[360px] ${
                  event.imageUrl ? "bg-center bg-cover" : "bg-gradient-to-br from-emerald-800/80 to-emerald-900/80"
                }`}
                style={event.imageUrl ? { backgroundImage: `url("${event.imageUrl}")` } : undefined}
                role={event.imageUrl ? "img" : undefined}
                aria-label={event.imageUrl ? `${event.name} cover` : undefined}
              >
                {!event.imageUrl && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="font-serif text-6xl italic text-white/30">V</span>
                  </div>
                )}
                {/* Gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent sm:bg-gradient-to-r sm:from-transparent sm:to-black/20" />
                {/* Status badge */}
                <div className="absolute top-4 left-4">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider ${
                      state.key === "open"
                        ? "bg-emerald-400 text-emerald-950"
                        : state.key === "upcoming"
                        ? "bg-amber-400 text-amber-950"
                        : "bg-white/20 text-white"
                    }`}
                  >
                    {state.key === "open" && <span className="h-1.5 w-1.5 rounded-full bg-emerald-900 animate-pulse" />}
                    {state.label}
                  </span>
                </div>
              </div>

              {/* Copy pane */}
              <div className="flex flex-col justify-between p-7 sm:p-9 text-white">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-300">
                    {event.voting_mode === "paid"
                      ? `GH₵ ${(event.unit_price_minor / 100).toFixed(2)} per vote`
                      : "Free voting"}
                  </p>
                  <h3 className="mt-2.5 font-serif text-2xl sm:text-3xl font-medium leading-tight tracking-tight text-white">
                    {event.name}
                  </h3>
                  <p className="mt-3 text-sm text-white/70 leading-relaxed line-clamp-3">
                    {event.description || "Explore the nominees and support the one who inspires you."}
                  </p>

                  <div className="mt-5 flex items-center gap-2 text-xs text-emerald-200/80">
                    <span className="font-semibold uppercase tracking-wider text-[10px]">Voting window</span>
                    <span className="text-white/40">·</span>
                    <span className="font-mono">
                      {ghDate(event.starts_at)} — {ghDate(event.ends_at)}
                    </span>
                  </div>
                </div>

                <div className="mt-8 flex flex-wrap items-center gap-3">
                  <Link
                    href={`/events/${event.slug}`}
                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-400 px-5 py-2.5 text-xs font-bold text-emerald-950 hover:bg-emerald-300 transition-all active:scale-95"
                  >
                    {state.key === "open" ? "Vote now" : "Explore event"}
                    <span aria-hidden="true">↗</span>
                  </Link>
                  <span className="text-[11px] text-white/40">
                    {events.length} event{events.length !== 1 ? "s" : ""} live
                  </span>
                </div>
              </div>
            </motion.article>
          </AnimatePresence>
        </div>

        {/* Dot indicators */}
        {events.length > 1 && (
          <div className="mt-6 flex justify-center gap-1.5" aria-label="Event navigation dots">
            {events.map((item, i) => (
              <button
                key={item.id}
                type="button"
                aria-label={`Show ${item.name}`}
                onClick={() => go(i)}
                className={`rounded-full transition-all duration-300 cursor-pointer ${
                  i === index
                    ? "h-2 w-6 bg-emerald-400"
                    : "h-2 w-2 bg-white/25 hover:bg-white/50"
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
