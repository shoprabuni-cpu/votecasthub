"use client";

import Image from "next/image";
import Link from "next/link";
import { eventPresentation } from "@/lib/events/presentation";
import { TicketIcon, VoteIcon } from "@/components/brand-icons";
import { ReflectiveCard } from "@/components/ui/ReflectiveCard";

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
  const statusColor = isOpen ? "#22c55e" : "#f59e0b";
  const badgeLabel = isTicketing ? "Official Tickets" : "Verified Contest";
  const subtitle = isTicketing
    ? (event.venue_name ? `📍 ${event.venue_name}` : "Passes & Entry Tickets")
    : (event.voting_mode === "free" ? "Free Public Voting" : `GHS ${(event.unit_price_minor / 100).toFixed(2)} / vote`);

  const idLabel = isTicketing ? "EVENT DATE" : "VOTING DATE";
  const idValue = formattedDate;

  return (
    <Link
      href={`/events/${event.slug}`}
      className="group block min-w-0 focus-visible:outline-2 focus-visible:outline-emerald-500 rounded-2xl sm:rounded-3xl"
    >
      <ReflectiveCard
        width="100%"
        height="100%"
        radius={20}
        theme="dark"
        tint="#ffffff"
        metalness={0.95}
        roughness={0.28}
        blurStrength={6}
        shine={1.2}
        glare={0.65}
        tiltStrength={10}
        contentPadding={0}
        className="w-full h-[375px] sm:h-[455px] transition-transform duration-300 group-hover:scale-[1.02]"
      >
        <div className="flex h-full flex-col justify-between p-3 sm:p-5 text-white">
          {/* Header */}
          <div className="flex items-center justify-between gap-1 text-xs font-medium">
            <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 sm:px-2.5 sm:py-1 text-[9px] sm:text-[11px] backdrop-blur-md border border-white/10 text-white font-medium truncate">
              <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <path d="M9 12l2 2 4-4" />
              </svg>
              <span className="truncate">{badgeLabel}</span>
            </span>

            <span className="inline-flex items-center gap-1 sm:gap-1.5 text-[10px] sm:text-xs text-white/90 font-semibold shrink-0">
              <span
                className="size-1.5 sm:size-2 rounded-full"
                style={{
                  backgroundColor: statusColor,
                  boxShadow: `0 0 8px ${statusColor}`
                }}
              />
              <span className="truncate">{presentation.label}</span>
            </span>
          </div>

          {/* Event Flyer Window */}
          {event.imageUrl ? (
            <div className="my-2 sm:my-3 relative aspect-[16/10] w-full overflow-hidden rounded-lg sm:rounded-xl border border-white/15 bg-black/40 shadow-inner group-hover:border-white/30 transition-colors">
              <Image
                src={event.imageUrl}
                alt=""
                fill
                unoptimized
                sizes="(min-width:1280px) 25vw, (min-width:768px) 33vw, 50vw"
                className="object-cover transition-transform duration-500 group-hover:scale-105"
              />
            </div>
          ) : (
            <div className="my-2 sm:my-3 flex aspect-[16/10] w-full items-center justify-center rounded-lg sm:rounded-xl border border-white/10 bg-white/5 text-white/40">
              {isTicketing ? <TicketIcon size={32} /> : <VoteIcon size={32} />}
            </div>
          )}

          {/* Identity: Title and Subtitle */}
          <div className="space-y-0.5 sm:space-y-1">
            {event.organization_name && (
              <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-emerald-400 truncate">
                {event.organization_name}
              </p>
            )}
            <h3 className="text-sm sm:text-lg font-bold tracking-tight text-white line-clamp-2 leading-tight sm:leading-snug group-hover:text-emerald-300 transition-colors">
              {event.name}
            </h3>
            <p className="text-[11px] sm:text-xs text-white/70 truncate">
              {subtitle}
            </p>
          </div>

          {/* Footer: Date & Action Tile */}
          <div className="mt-2 sm:mt-4 flex items-end justify-between border-t border-white/10 pt-2 sm:pt-3">
            <div className="min-w-0 pr-1">
              <span className="block text-[8px] sm:text-[10px] font-bold uppercase tracking-wider text-white/50">
                {idLabel}
              </span>
              <span className="font-mono text-[10px] sm:text-xs font-semibold text-white/90 truncate block">
                {idValue}
              </span>
            </div>

            <div className="flex size-7 sm:size-9 shrink-0 items-center justify-center rounded-lg sm:rounded-xl border border-white/15 bg-white/10 text-white backdrop-blur-md transition-all group-hover:bg-emerald-600 group-hover:border-emerald-500 group-hover:text-white shadow-xs">
              <span className="text-xs sm:text-sm font-bold">↗</span>
            </div>
          </div>
        </div>
      </ReflectiveCard>
    </Link>
  );
}
