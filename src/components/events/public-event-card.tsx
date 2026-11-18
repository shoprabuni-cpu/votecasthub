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

export function PublicEventCard({ event, now }: { event: PublicEventCardData; now?: number }) {
  const presentation = eventPresentation(event, now);
  const isTicketing = event.event_type === "ticketing";
  const isOpen = presentation.key === "open";
  const schedule = new Intl.DateTimeFormat("en-GH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "Africa/Accra"
  });

  const formattedDate = schedule.format(new Date(event.starts_at));
  const statusColor = isOpen ? "#10b981" : "#f59e0b";
  const badgeLabel = isTicketing ? "Official Tickets" : "Verified Contest";
  const subtitle = isTicketing
    ? (event.venue_name ? `📍 ${event.venue_name}` : "Passes & Entry Tickets")
    : (event.voting_mode === "free" ? "Free Public Voting" : `GHS ${(event.unit_price_minor / 100).toFixed(2)} / vote`);

  const idLabel = isTicketing ? "EVENT DATE" : "VOTING DATE";
  const idValue = formattedDate;

  return (
    <Link
      href={`/events/${event.slug}`}
      className="group block min-w-0 focus-visible:outline-2 focus-visible:outline-emerald-500 rounded-2xl sm:rounded-3xl h-full"
    >
      <div className="relative flex h-full flex-col justify-between overflow-hidden rounded-2xl sm:rounded-3xl border border-stone-200/90 bg-white p-3.5 sm:p-5 shadow-xs transition-all duration-300 hover:border-emerald-300 hover:shadow-xl hover:-translate-y-1 dark:border-[#1c2721] dark:bg-[#0c120e] dark:hover:border-emerald-800/80">
        <div>
          {/* Header Badges */}
          <div className="flex items-center justify-between gap-1 text-xs font-medium">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[9px] sm:text-[11px] font-semibold truncate border ${
                isTicketing
                  ? "bg-amber-50 text-amber-900 border-amber-200/80 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/50"
                  : "bg-emerald-50 text-emerald-900 border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/50"
              }`}
            >
              {isTicketing ? <TicketIcon size={12} /> : <VoteIcon size={12} />}
              <span className="truncate">{badgeLabel}</span>
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
            <div className="my-3 sm:my-4 relative aspect-[16/10] w-full overflow-hidden rounded-xl border border-stone-100 bg-stone-100 shadow-inner transition-transform duration-500 group-hover:scale-[1.02] dark:border-[#1c2721] dark:bg-[#151c17]">
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
            <div className="my-3 sm:my-4 flex aspect-[16/10] w-full items-center justify-center rounded-xl border border-dashed border-stone-200 bg-stone-50 text-stone-400 dark:border-[#1f2c24] dark:bg-[#101712]">
              {isTicketing ? <TicketIcon size={32} /> : <VoteIcon size={32} />}
            </div>
          )}

          {/* Identity: Title and Subtitle */}
          <div className="space-y-1">
            {event.organization_name && (
              <p className={`text-[10px] sm:text-[11px] font-bold uppercase tracking-wider truncate ${
                isTicketing ? "text-amber-700 dark:text-amber-400" : "text-emerald-700 dark:text-emerald-400"
              }`}>
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
          <div className="min-w-0 pr-1">
            <span className="block text-[8px] sm:text-[9px] font-bold uppercase tracking-wider text-stone-400 dark:text-stone-500">
              {idLabel}
            </span>
            <span className="font-mono text-[10px] sm:text-xs font-semibold text-stone-700 dark:text-stone-300 truncate block">
              {idValue}
            </span>
          </div>

          <div
            className={`flex size-8 sm:size-9 shrink-0 items-center justify-center rounded-xl border transition-all shadow-xs ${
              isTicketing
                ? "border-amber-200 bg-amber-50 text-amber-900 group-hover:bg-amber-500 group-hover:border-amber-500 group-hover:text-white dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300 dark:group-hover:bg-amber-500 dark:group-hover:text-black"
                : "border-emerald-200 bg-emerald-50 text-emerald-900 group-hover:bg-emerald-800 group-hover:border-emerald-800 group-hover:text-white dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300 dark:group-hover:bg-emerald-600 dark:group-hover:text-white"
            }`}
          >
            <span className="text-xs sm:text-sm font-bold transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5">
              ↗
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
