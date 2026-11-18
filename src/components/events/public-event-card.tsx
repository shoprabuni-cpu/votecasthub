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
  const schedule = new Intl.DateTimeFormat("en-GH", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Africa/Accra" });

  return (
    <ReflectiveCard
      width="100%"
      height="100%"
      radius={20}
      contentPadding={0}
      tint="#10b981"
      metalness={0.4}
      roughness={0.35}
      shine={0.9}
      glare={0.45}
      tiltStrength={8}
      className="flex h-full min-w-0 flex-col shadow-sm transition-shadow hover:shadow-md"
    >
      <article className="flex h-full min-w-0 flex-col overflow-hidden rounded-[20px] bg-white/95 backdrop-blur-xs transition-colors dark:bg-[#0a0d0b]/95">
        <Link href={`/events/${event.slug}`} tabIndex={-1} aria-hidden="true" className="relative block aspect-[4/3] overflow-hidden bg-emerald-950">
          {event.imageUrl ? (
            <Image
              src={event.imageUrl}
              alt=""
              fill
              unoptimized
              sizes="(min-width:1536px) 16vw, (min-width:1280px) 20vw, (min-width:1024px) 25vw, (min-width:768px) 33vw, 50vw"
              className="object-cover"
            />
          ) : (
            <span className="flex h-full items-center justify-center bg-gradient-to-br from-emerald-900 to-emerald-700 text-5xl font-semibold text-white/60">
              {isTicketing ? <TicketIcon size={48} /> : <VoteIcon size={48} />}
            </span>
          )}
          <div className="absolute bottom-2 left-2 flex items-center gap-1.5">
            <span className={`rounded-md px-2 py-1 text-[10px] font-semibold sm:text-xs ${presentation.key === "open" ? "bg-emerald-50 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-300" : "bg-white text-stone-800 dark:bg-black/90 dark:text-stone-200"}`}>
              {presentation.label}
            </span>
            {isTicketing && (
              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-900/90 backdrop-blur-xs px-2 py-1 text-[10px] font-bold text-amber-300">
                <TicketIcon size={11} />
                <span>Tickets</span>
              </span>
            )}
          </div>
        </Link>
        <div className="flex flex-1 flex-col gap-2 p-3 sm:p-4">
          {event.organization_name && (
            <p className="truncate text-[11px] text-stone-500 dark:text-stone-400 sm:text-xs" title={event.organization_name}>
              {event.organization_name}
            </p>
          )}
          <h3 className="line-clamp-2 min-h-10 text-sm font-semibold leading-5 text-stone-900 dark:text-white sm:text-base">
            <Link href={`/events/${event.slug}`} className="hover:text-emerald-800 dark:hover:text-emerald-400 focus-visible:outline-2 focus-visible:outline-emerald-700">
              {event.name}
            </Link>
          </h3>
          
          {isTicketing ? (
            <div className="space-y-0.5">
              <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                <TicketIcon size={14} />
                <span>Event Tickets On Sale</span>
              </p>
              {event.venue_name && (
                <p className="truncate text-[11px] text-stone-600 dark:text-stone-300">
                  📍 {event.venue_name}
                </p>
              )}
            </div>
          ) : (
            <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-400">
              {event.voting_mode === "free" ? "Free voting" : `GHS ${(event.unit_price_minor / 100).toFixed(2)} / vote`}
            </p>
          )}

          <div className="space-y-1 text-[11px] leading-relaxed text-stone-600 dark:text-stone-300 sm:text-xs">
            <p>
              <span className="font-semibold text-stone-800 dark:text-stone-200">
                {isTicketing ? "Event Date: " : "Opens: "}
              </span>
              <time dateTime={event.starts_at}>{schedule.format(new Date(event.starts_at))}</time>
            </p>
            {!isTicketing && (
              <p>
                <span className="font-semibold text-stone-800 dark:text-stone-200">Ends: </span>
                <time dateTime={event.ends_at}>{schedule.format(new Date(event.ends_at))}</time>
              </p>
            )}
            {isTicketing && event.doors_open_time && (
              <p>
                <span className="font-semibold text-stone-800 dark:text-stone-200">Doors Open: </span>
                <span>{event.doors_open_time}</span>
              </p>
            )}
            <p className="text-[10px] text-stone-500 dark:text-stone-400">Ghana time (GMT)</p>
          </div>
          <Link
            href={`/events/${event.slug}`}
            className="mt-auto inline-flex min-h-11 items-center justify-between gap-2 rounded-xl border border-emerald-800 bg-emerald-800 px-4 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-emerald-900 dark:border-emerald-600 dark:bg-emerald-600 dark:hover:bg-emerald-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
          >
            {isTicketing ? (
              presentation.key === "open" ? (
                <span className="inline-flex items-center gap-1.5">
                  <span>Get Tickets</span>
                  <TicketIcon size={14} />
                </span>
              ) : (
                "View Event"
              )
            ) : presentation.key === "open" ? (
              <span className="inline-flex items-center gap-1.5">
                <span>Vote now</span>
                <VoteIcon size={14} />
              </span>
            ) : (
              "Explore event"
            )}
            <span aria-hidden="true">↗</span>
          </Link>
        </div>
      </article>
    </ReflectiveCard>
  );
}
