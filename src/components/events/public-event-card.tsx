import Link from "next/link";

export type PublicEventCardData = { id: string; name: string; slug: string; description: string | null; imageUrl?: string | null; unit_price_minor: number; starts_at: string; ends_at: string; status: string; voting_mode: "free" | "paid" };

function eventStatus(event: PublicEventCardData) {
  if (event.status === "paused") return "Voting paused";
  if (event.status === "closed") return "Closed";
  return "Published event";
}

function ghRange(event: PublicEventCardData) {
  const format = new Intl.DateTimeFormat("en-GH", { dateStyle: "medium", timeZone: "Africa/Accra" });
  return `${format.format(new Date(event.starts_at))} – ${format.format(new Date(event.ends_at))}`;
}

export function PublicEventCard({ event }: { event: PublicEventCardData }) {
  return <article className="public-event-card">
    <div className={`public-event-cover${event.imageUrl ? " has-image" : ""}`} style={event.imageUrl ? { backgroundImage: `url("${event.imageUrl}")` } : undefined} role={event.imageUrl ? "img" : undefined} aria-label={event.imageUrl ? `${event.name} cover image` : undefined} aria-hidden={event.imageUrl ? undefined : true}>{!event.imageUrl && <span>V</span>}</div>
    <div className="public-event-copy">
      <div className="event-card-meta"><span className="public-status">{eventStatus(event)}</span><span className="price-pill">{event.voting_mode === "free" ? "Free voting" : `GHS ${(event.unit_price_minor / 100).toFixed(2)} per vote`}</span></div>
      <h2><Link href={`/events/${event.slug}`}>{event.name}</Link></h2>
      <p>{event.description || "Explore the categories and nominees in this event."}</p>
      <p className="event-dates">{ghRange(event)}</p>
      <Link className="text-link" href={`/events/${event.slug}`}>Explore event <span aria-hidden="true">↗</span></Link>
    </div>
  </article>;
}
