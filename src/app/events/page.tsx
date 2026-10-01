import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { PublicEventCard, type PublicEventCardData } from "@/components/events/public-event-card";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Browse events" };

export default async function EventsPage() {
  let events: PublicEventCardData[] = [];
  let unavailable = false;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.from("events").select("id, name, slug, description, unit_price_minor, starts_at, ends_at, status, voting_mode").in("status", ["published", "paused", "closed"]).order("starts_at", { ascending: true });
    if (error) unavailable = true;
    else events = (data ?? []) as PublicEventCardData[];
  } catch {
    unavailable = true;
  }

  return <main className="public-page">
    <SiteHeader />
    <section className="public-page-heading"><p className="eyebrow">VOTECASTHUB GH EVENTS</p><h1>Find an event worth celebrating.</h1><p>Explore awards and competitions. Browse categories and meet the nominees.</p></section>
    {unavailable ? <section className="empty-state" role="status"><span className="empty-icon">↻</span><h2>Events are temporarily unavailable.</h2><p>Please refresh in a little while.</p></section> : events.length ? <section className="public-event-grid" aria-label="Published events">{events.map((event) => <PublicEventCard event={event} key={event.id} />)}</section> : <section className="empty-state"><span className="empty-icon">✦</span><h2>No events are published yet.</h2><p>Check back soon, or <Link href="/sign-up">set up an event</Link> as an organizer.</p></section>}
    <footer className="site-footer"><Link className="brand footer-brand" href="/"><span className="brand-mark">V</span><span>VotecastHub<span className="brand-accent"> GH</span></span></Link><span>Voting for events and awards.</span><span>© {new Date().getFullYear()} VotecastHub GH</span></footer>
  </main>;
}
