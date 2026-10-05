import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { type PublicEventCardData } from "@/components/events/public-event-card";
import { EventBrowser } from "@/components/events/event-browser";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Browse events" };

export default async function EventsPage() {
  let events: PublicEventCardData[] = [];
  let unavailable = false;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.from("events").select("id, name, slug, description, image_path, unit_price_minor, starts_at, ends_at, status, voting_mode").in("status", ["published", "paused", "closed"]).order("starts_at", { ascending: true });
    if (error) unavailable = true;
    else {
      const imagePaths = (data ?? []).map((event) => event.image_path).filter((path): path is string => Boolean(path));
      const { data: signedImages } = imagePaths.length ? await supabase.storage.from("nominee-images").createSignedUrls(imagePaths, 3600) : { data: [] };
      const imageUrls = new Map((signedImages ?? []).flatMap((image) => image.signedUrl && image.path ? [[image.path, image.signedUrl] as const] : []));
      events = (data ?? []).map((event) => ({ ...event, imageUrl: event.image_path ? imageUrls.get(event.image_path) ?? null : null })) as PublicEventCardData[];
    }
  } catch {
    unavailable = true;
  }

  return <main className="public-page">
    <SiteHeader />
    <section className="public-page-heading"><p className="eyebrow">VOTECASTHUB GH EVENTS</p><h1>Find an event worth celebrating.</h1><p>Explore awards and competitions. Browse categories and meet the nominees.</p></section>
    {unavailable ? <section className="empty-state" role="status"><span className="empty-icon">↻</span><h2>Events are temporarily unavailable.</h2><p>Please refresh in a little while.</p></section> : events.length ? <EventBrowser events={events} /> : <section className="empty-state"><span className="empty-icon">✦</span><h2>No events are published yet.</h2><p>Check back soon, or <Link href="/sign-up">set up an event</Link> as an organizer.</p></section>}
    <footer className="site-footer"><Link className="brand footer-brand" href="/"><span className="brand-mark">V</span><span>VotecastHub<span className="brand-accent"> GH</span></span></Link><span>Voting for events and awards.</span><span>© {new Date().getFullYear()} VotecastHub GH</span><nav aria-label="Legal and company links"><Link href="/about">About</Link><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link></nav></footer>
  </main>;
}
