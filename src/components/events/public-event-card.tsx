"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { eventPresentation } from "@/lib/events/presentation";
import { Icon } from "@/components/icon";

export type PublicEventCardData = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  imageUrl?: string | null;
  unit_price_minor: number;
  starts_at: string;
  ends_at: string;
  status: string;
  voting_mode: "free" | "paid";
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GH", {
    month: "short",
    day: "numeric",
    timeZone: "Africa/Accra",
  }).format(new Date(value));
}

export function PublicEventCard({ event }: { event: PublicEventCardData }) {
  const state = eventPresentation(event);
  const isOpen = state.key === "open";
  const priceLabel =
    event.voting_mode === "paid"
      ? `GHS ${(event.unit_price_minor / 100).toFixed(2)}`
      : "Free";

  return (
    <motion.article
      layout
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.25 }}
      className="group flex flex-col rounded-2xl bg-white border border-slate-200/90 hover:border-emerald-500/50 hover:shadow-lg transition-all duration-300 overflow-hidden"
    >
      {/* Product Card Image Container */}
      <Link
        href={`/events/${event.slug}`}
        className="relative aspect-[16/10] bg-slate-900 overflow-hidden block"
      >
        {event.imageUrl ? (
          <div
            className="w-full h-full bg-cover bg-center transition-transform duration-500 group-hover:scale-105"
            style={{ backgroundImage: `url("${event.imageUrl}")` }}
            role="img"
            aria-label={`${event.name} cover image`}
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-emerald-900 via-emerald-950 to-slate-950 flex flex-col items-center justify-center text-emerald-100 select-none">
            <span className="text-4xl font-serif font-black italic">V</span>
            <span className="text-[10px] font-semibold text-emerald-300/80 uppercase tracking-widest mt-1">
              VotecastHub
            </span>
          </div>
        )}

        {/* Ambient Dark Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/60 via-transparent to-transparent pointer-events-none" />

        {/* Status Pill Badge */}
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

        {/* Price Tag Pill */}
        <div className="absolute top-3 right-3 z-10">
          <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold tracking-wide bg-emerald-900/90 text-white backdrop-blur-md border border-emerald-500/30 shadow-sm">
            {priceLabel}
          </span>
        </div>

        {/* Dates Ribbon */}
        <div className="absolute bottom-2.5 left-3 right-3 z-10 text-[11px] font-medium text-white/90 flex items-center gap-1">
          <Icon name="calendar" size={12} className="text-emerald-300" />
          <span>
            {formatDate(event.starts_at)} – {formatDate(event.ends_at)}
          </span>
        </div>
      </Link>

      {/* Card Body */}
      <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between">
        <div>
          <h2 className="text-base font-bold text-slate-900 group-hover:text-emerald-800 transition-colors line-clamp-2 leading-snug mb-1.5">
            <Link href={`/events/${event.slug}`}>{event.name}</Link>
          </h2>
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
          <Icon
            name="arrowUpRight"
            size={14}
            className={isOpen ? "text-emerald-200" : "text-slate-500"}
          />
        </Link>
      </div>
    </motion.article>
  );
}
