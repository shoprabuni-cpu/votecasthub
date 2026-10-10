import Image from "next/image";
import Link from "next/link";
import { eventPresentation } from "@/lib/events/presentation";

export type PublicEventCardData = { id: string; name: string; slug: string; description: string | null; organization_name?: string; imageUrl?: string | null; unit_price_minor: number; starts_at: string; ends_at: string; status: string; voting_mode: "free" | "paid" };

export function PublicEventCard({ event, now }: { event: PublicEventCardData; now?: number }) {
  const presentation = eventPresentation(event, now);
  const schedule = new Intl.DateTimeFormat("en-GH", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Africa/Accra" });
  return <article className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm transition-shadow hover:shadow-md">
    <Link href={`/events/${event.slug}`} tabIndex={-1} aria-hidden="true" className="relative block aspect-[4/3] overflow-hidden bg-emerald-950">
      {event.imageUrl ? <Image src={event.imageUrl} alt="" fill unoptimized sizes="(min-width:1536px) 16vw, (min-width:1280px) 20vw, (min-width:1024px) 25vw, (min-width:768px) 33vw, 50vw" className="object-cover" /> : <span className="flex h-full items-center justify-center bg-gradient-to-br from-emerald-900 to-emerald-700 text-5xl font-semibold text-white/60">V</span>}
      <span className={`absolute bottom-2 left-2 rounded-md px-2 py-1 text-[10px] font-semibold sm:text-xs ${presentation.key === "open" ? "bg-emerald-50 text-emerald-900" : "bg-white text-stone-800"}`}>{presentation.label}</span>
    </Link>
    <div className="flex flex-1 flex-col gap-2 p-3 sm:p-4">
      {event.organization_name && <p className="truncate text-[11px] text-stone-500 sm:text-xs" title={event.organization_name}>{event.organization_name}</p>}
      <h3 className="line-clamp-2 min-h-10 text-sm font-semibold leading-5 text-stone-900 sm:text-base"><Link href={`/events/${event.slug}`} className="hover:text-emerald-800 focus-visible:outline-2 focus-visible:outline-emerald-700">{event.name}</Link></h3>
      <p className="text-xs font-semibold text-emerald-800">{event.voting_mode === "free" ? "Free voting" : `GHS ${(event.unit_price_minor / 100).toFixed(2)} / vote`}</p>
      <div className="space-y-1 text-[11px] leading-relaxed text-stone-600 sm:text-xs">
        <p><span className="font-semibold">Opens: </span><time dateTime={event.starts_at}>{schedule.format(new Date(event.starts_at))}</time></p>
        <p><span className="font-semibold">Ends: </span><time dateTime={event.ends_at}>{schedule.format(new Date(event.ends_at))}</time></p>
        <p className="text-[10px] text-stone-500">Ghana time (GMT)</p>
      </div>
      <Link href={`/events/${event.slug}`} className="mt-auto inline-flex min-h-11 items-center justify-between gap-2 rounded-xl border border-emerald-800 bg-emerald-800 px-4 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-emerald-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700">{presentation.key === "open" ? "Vote now" : "Explore event"}<span aria-hidden="true">↗</span></Link>
    </div>
  </article>;
}
