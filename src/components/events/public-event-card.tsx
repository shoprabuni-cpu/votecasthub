"use client";

import Image from "next/image";
import Link from "next/link";
import { eventPresentation } from "@/lib/events/presentation";
import { TicketIcon, VoteIcon } from "@/components/brand-icons";

export type PublicEventCardData = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  organization_name?: string;
  imageUrl?: string | null;
  unit_price_minor: number;
  starts_at: string;
  ends_at: string;
  status: string;
  voting_mode: "free" | "paid";
  event_type?: "voting" | "ticketing" | "hybrid";
  venue_name?: string | null;
  doors_open_time?: string | null;
};

function TicketBarcode() {
  return (
    <svg
      className="h-5 sm:h-6 w-24 sm:w-32 opacity-75 group-hover:opacity-100 transition-opacity text-stone-800 dark:text-stone-300"
      viewBox="0 0 120 28"
      fill="currentColor"
      aria-hidden="true"
    >
      <rect x="0" y="0" width="3" height="28" />
      <rect x="5" y="0" width="1" height="28" />
      <rect x="8" y="0" width="4" height="28" />
      <rect x="14" y="0" width="2" height="28" />
      <rect x="18" y="0" width="1" height="28" />
      <rect x="21" y="0" width="3" height="28" />
      <rect x="26" y="0" width="2" height="28" />
      <rect x="30" y="0" width="5" height="28" />
      <rect x="37" y="0" width="1" height="28" />
      <rect x="40" y="0" width="3" height="28" />
      <rect x="45" y="0" width="2" height="28" />
      <rect x="49" y="0" width="4" height="28" />
      <rect x="55" y="0" width="1" height="28" />
      <rect x="58" y="0" width="3" height="28" />
      <rect x="63" y="0" width="2" height="28" />
      <rect x="67" y="0" width="4" height="28" />
      <rect x="73" y="0" width="1" height="28" />
      <rect x="76" y="0" width="3" height="28" />
      <rect x="81" y="0" width="2" height="28" />
      <rect x="85" y="0" width="5" height="28" />
      <rect x="92" y="0" width="2" height="28" />
      <rect x="96" y="0" width="1" height="28" />
      <rect x="99" y="0" width="4" height="28" />
      <rect x="105" y="0" width="2" height="28" />
      <rect x="109" y="0" width="1" height="28" />
      <rect x="112" y="0" width="4" height="28" />
      <rect x="118" y="0" width="2" height="28" />
    </svg>
  );
}

function parseTicketDate(dateStr: string) {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) throw new Error("Invalid date");
    const month = new Intl.DateTimeFormat("en-GH", { month: "short", timeZone: "Africa/Accra" }).format(d).toUpperCase();
    const day = new Intl.DateTimeFormat("en-GH", { day: "2-digit", timeZone: "Africa/Accra" }).format(d);
    const weekday = new Intl.DateTimeFormat("en-GH", { weekday: "short", timeZone: "Africa/Accra" }).format(d).toUpperCase();
    const time = new Intl.DateTimeFormat("en-GH", { hour: "numeric", minute: "2-digit", timeZone: "Africa/Accra" }).format(d);
    const full = new Intl.DateTimeFormat("en-GH", { month: "short", day: "numeric", year: "numeric", timeZone: "Africa/Accra" }).format(d);
    return { month, day, weekday, time, full };
  } catch {
    return { month: "TBD", day: "--", weekday: "TBD", time: "TBD", full: dateStr };
  }
}

export function PublicEventCard({
  event,
  now,
  mode = "auto",
}: {
  event: PublicEventCardData;
  now?: number;
  mode?: "auto" | "ticketing" | "voting";
}) {
  const presentation = eventPresentation(event, now);
  const isTicketing = mode === "ticketing" || (mode !== "voting" && event.event_type === "ticketing");
  const isOpen = presentation.key === "open";
  const statusColor = isOpen ? "#10b981" : "#f59e0b";
  const dateInfo = parseTicketDate(event.starts_at);

  if (isTicketing) {
    const priceText =
      event.unit_price_minor > 0
        ? `GHS ${(event.unit_price_minor / 100).toFixed(2)}`
        : "Free Pass";
    const doorsText = event.doors_open_time
      ? `Doors ${event.doors_open_time}`
      : `Doors ${dateInfo.time}`;

    return (
      <Link
        href={`/events/${event.slug}#tickets`}
        className="group block min-w-0 focus-visible:outline-2 focus-visible:outline-amber-500 rounded-2xl sm:rounded-3xl h-full transition-all duration-300 hover:-translate-y-1"
      >
        {/* =========================================================================
            AUTHENTIC HORIZONTAL ADMISSION PASS (Landscape on both Mobile & Desktop)
            Left: Main Event Pass Body (Poster + Title + Venue + Schedule)
            Center: Vertical Perforation Tear Divider with Die-Cut Semicircular Notches
            Right: Gate Stub with Barcode, Price, and Action Button
           ========================================================================= */}
        <div className="relative flex flex-row overflow-hidden rounded-2xl sm:rounded-3xl border border-amber-900/20 bg-white shadow-xs transition-all duration-300 group-hover:border-amber-500/50 group-hover:shadow-xl dark:border-amber-900/40 dark:bg-[#0c120e] dark:group-hover:border-amber-500/40 h-full">
          {/* Left: Main Ticket Body */}
          <div className="flex-1 min-w-0 p-3 sm:p-5 flex flex-col justify-between">
            <div>
              {/* Header Ribbon / Serial Bar */}
              <div className="flex items-center justify-between gap-1 text-[9px] sm:text-[11px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-400 mb-2 sm:mb-3">
                <span className="flex items-center gap-1.5 truncate">
                  <TicketIcon size={13} className="shrink-0 text-amber-600 dark:text-amber-400" />
                  <span className="truncate">{event.event_type === "hybrid" ? "Pass + Vote" : "Official Admission Pass"}</span>
                </span>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-mono text-[8px] sm:text-[10px] text-stone-400 dark:text-stone-500">
                    № {event.id.slice(0, 8).toUpperCase()}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-2 py-0.5 text-[8px] sm:text-[9px] font-semibold text-stone-700 shadow-2xs dark:bg-[#141d18] dark:text-stone-300">
                    <span
                      className="size-1.5 rounded-full animate-pulse"
                      style={{ backgroundColor: statusColor, boxShadow: `0 0 6px ${statusColor}` }}
                    />
                    <span className="truncate">{presentation.label}</span>
                  </span>
                </div>
              </div>

              {/* Event Poster Thumbnail & Info */}
              <div className="flex items-start gap-2.5 sm:gap-4">
                {event.imageUrl ? (
                  <div className="relative size-16 sm:w-28 sm:h-24 md:w-36 md:h-24 lg:w-40 lg:h-28 rounded-xl sm:rounded-2xl overflow-hidden shrink-0 border border-stone-200/80 bg-stone-100 shadow-inner group-hover:scale-[1.02] transition-transform duration-300 dark:border-[#1c2721] dark:bg-[#151c17]">
                    <Image
                      src={event.imageUrl}
                      alt={event.name}
                      fill
                      unoptimized
                      sizes="(min-width: 640px) 160px, 80px"
                      className="object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent hidden sm:block" />
                  </div>
                ) : (
                  <div className="flex size-16 sm:w-28 sm:h-24 md:w-36 md:h-24 lg:w-40 lg:h-28 items-center justify-center rounded-xl sm:rounded-2xl border border-dashed border-amber-300/80 bg-amber-50/50 text-amber-700/60 dark:border-amber-900/40 dark:bg-amber-950/20 shrink-0">
                    <TicketIcon size={28} />
                  </div>
                )}

                <div className="min-w-0 flex-1 space-y-1">
                  {event.organization_name && (
                    <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 truncate">
                      {event.organization_name}
                    </p>
                  )}
                  <h3 className="font-serif text-xs sm:text-base md:text-lg font-bold text-stone-900 dark:text-white line-clamp-2 leading-snug group-hover:text-amber-800 dark:group-hover:text-amber-400 transition-colors">
                    {event.name}
                  </h3>
                  <p className="text-[10px] sm:text-xs text-stone-500 dark:text-stone-400 truncate flex items-center gap-1 font-medium">
                    <span className="shrink-0 text-amber-700 dark:text-amber-400">📍</span>
                    <span className="truncate">{event.venue_name || "Official Venue Announced Soon"}</span>
                  </p>
                </div>
              </div>
            </div>

            {/* Bottom Date & Doors Badge */}
            <div className="mt-3 pt-2.5 border-t border-stone-100 dark:border-[#18221b] flex flex-wrap items-center justify-between gap-1.5 text-[10px] sm:text-xs">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center rounded-lg bg-amber-500/10 px-2 py-0.5 font-bold uppercase tracking-wider text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
                  {dateInfo.month} {dateInfo.day}
                </span>
                <span className="font-semibold text-stone-800 dark:text-stone-200">
                  {dateInfo.weekday} • {dateInfo.full}
                </span>
              </div>
              <span className="text-[10px] sm:text-[11px] font-medium text-amber-700 dark:text-amber-400 truncate">
                ⏰ {doorsText}
              </span>
            </div>
          </div>

          {/* Vertical Perforation Divider with Physical Cutout Notches */}
          <div className="relative flex flex-col items-center justify-between w-0 shrink-0">
            {/* Top Cutout Notch */}
            <div
              className="absolute -top-3 -left-3 size-6 rounded-full border border-stone-300 bg-[var(--paper)] shadow-inner dark:border-[#2a3830] z-10"
              aria-hidden="true"
            />
            {/* Vertical Dashed Tear-Line */}
            <div className="h-full border-r-2 border-dashed border-stone-300/90 dark:border-stone-700/80 my-2.5" />
            {/* Bottom Cutout Notch */}
            <div
              className="absolute -bottom-3 -left-3 size-6 rounded-full border border-stone-300 bg-[var(--paper)] shadow-inner dark:border-[#2a3830] z-10"
              aria-hidden="true"
            />
          </div>

          {/* Right: Ticket Stub */}
          <div className="w-28 sm:w-36 md:w-44 shrink-0 p-3 sm:p-5 bg-stone-50/70 dark:bg-[#080d0a]/80 flex flex-col items-center justify-between text-center">
            <div>
              <span className="font-mono text-[8px] sm:text-[9px] uppercase tracking-widest text-stone-400 dark:text-stone-500 block">
                GATE PASS
              </span>
              <div className="my-1 sm:my-2 scale-90 sm:scale-100 origin-center">
                <TicketBarcode />
              </div>
              <span className="font-mono text-[7px] sm:text-[8px] uppercase tracking-wider text-stone-400 dark:text-stone-500 block hidden sm:block">
                SCAN AT GATE
              </span>
            </div>

            <div className="w-full my-1 sm:my-2">
              <span className="text-[8px] sm:text-[9px] uppercase tracking-wider text-stone-400 dark:text-stone-500 block font-semibold">
                ENTRY
              </span>
              <span className="font-bold text-xs sm:text-base text-amber-900 dark:text-amber-200 truncate block">
                {priceText}
              </span>
            </div>

            <div className="w-full py-1.5 sm:py-2 px-2 rounded-xl bg-gradient-to-r from-amber-600 via-amber-500 to-amber-600 text-white text-[10px] sm:text-xs font-bold shadow-xs transition-all group-hover:scale-105 active:scale-95 text-center flex items-center justify-center gap-1">
              <span>Get Pass</span>
              <span className="text-xs sm:text-sm">🎟️</span>
            </div>
          </div>
        </div>
      </Link>
    );
  }

  // Voting / Award Contest Card Design
  const schedule = new Intl.DateTimeFormat("en-GH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "Africa/Accra",
  });
  const formattedDate = schedule.format(new Date(event.starts_at));
  const isHybrid = event.event_type === "hybrid";
  const subtitle = isHybrid
    ? (event.voting_mode === "free" ? "Free Nominee Voting · Passes Available" : `GHS ${(event.unit_price_minor / 100).toFixed(2)} / vote · Passes Available`)
    : (event.voting_mode === "free" ? "Free Public Voting" : `GHS ${(event.unit_price_minor / 100).toFixed(2)} / vote`);

  return (
    <Link
      href={`/events/${event.slug}#ballot`}
      className="group block min-w-0 focus-visible:outline-2 focus-visible:outline-emerald-500 rounded-3xl h-full transition-all duration-300 hover:-translate-y-1"
    >
      <div className="relative flex h-full flex-col justify-between overflow-hidden rounded-3xl border border-stone-200/90 bg-white p-4 sm:p-5 shadow-xs transition-all duration-300 hover:border-emerald-300 hover:shadow-xl dark:border-[#1c2721] dark:bg-[#0c120e] dark:hover:border-emerald-800/80">
        <div>
          {/* Header Badges */}
          <div className="flex items-center justify-between gap-1 text-xs font-medium">
            <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[9px] sm:text-[11px] font-semibold truncate border bg-emerald-50 text-emerald-900 border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/50">
              <VoteIcon size={12} />
              <span className="truncate">{isHybrid ? "Contest + 🎟️ Passes" : "Official Contest"}</span>
            </span>

            <span className="inline-flex items-center gap-1.5 text-[10px] sm:text-xs font-semibold text-stone-700 dark:text-stone-300 shrink-0 bg-stone-100/80 dark:bg-[#141b16] px-2 py-0.5 rounded-full border border-stone-200/60 dark:border-[#1f2c24]">
              <span
                className="size-1.5 sm:size-2 rounded-full animate-pulse"
                style={{
                  backgroundColor: statusColor,
                  boxShadow: `0 0 8px ${statusColor}`,
                }}
              />
              <span className="truncate">{presentation.label}</span>
            </span>
          </div>

          {/* Event Flyer Window */}
          {event.imageUrl ? (
            <div className="my-3.5 relative aspect-[16/10] w-full overflow-hidden rounded-2xl border border-stone-100 bg-stone-100 shadow-inner transition-transform duration-500 group-hover:scale-[1.02] dark:border-[#1c2721] dark:bg-[#151c17]">
              <Image
                src={event.imageUrl}
                alt={event.name}
                fill
                unoptimized
                sizes="(min-width:1280px) 25vw, (min-width:768px) 33vw, 50vw"
                className="object-cover"
              />
            </div>
          ) : (
            <div className="my-3.5 flex aspect-[16/10] w-full items-center justify-center rounded-2xl border border-dashed border-stone-200 bg-stone-50 text-stone-400 dark:border-[#1f2c24] dark:bg-[#101712]">
              <VoteIcon size={32} />
            </div>
          )}

          {/* Identity: Title and Subtitle */}
          <div className="space-y-1">
            {event.organization_name && (
              <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider truncate text-emerald-700 dark:text-emerald-400">
                {event.organization_name}
              </p>
            )}
            <h3 className="text-sm sm:text-base font-serif font-bold tracking-tight text-stone-900 dark:text-white line-clamp-2 leading-snug group-hover:text-emerald-800 dark:group-hover:text-emerald-400 transition-colors">
              {event.name}
            </h3>
            <p className="text-[11px] sm:text-xs text-stone-500 dark:text-stone-400 truncate font-medium">
              {subtitle}
            </p>
          </div>
        </div>

        {/* Footer: Date & Action Button */}
        <div className="mt-4 sm:mt-5 flex items-end justify-between border-t border-stone-100 dark:border-[#1a251f] pt-3">
          <div className="min-w-0 pr-2">
            <span className="block text-[8px] sm:text-[9px] font-bold uppercase tracking-wider text-stone-400 dark:text-stone-500">
              VOTING SCHEDULE
            </span>
            <span className="font-mono text-[10px] sm:text-xs font-semibold text-stone-700 dark:text-stone-300 truncate block">
              {formattedDate}
            </span>
          </div>

          <div className="flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-bold text-emerald-900 group-hover:bg-emerald-800 group-hover:border-emerald-800 group-hover:text-white dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300 dark:group-hover:bg-emerald-600 dark:group-hover:text-white transition-all shadow-xs shrink-0">
            <span>Vote</span>
            <span className="text-[11px] transition-transform group-hover:translate-x-0.5">🗳️</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
