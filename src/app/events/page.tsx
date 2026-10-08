import { publicMetadata } from "@/lib/seo/metadata";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { EventBrowser } from "@/components/events/event-browser";
import { loadEventDirectory } from "@/lib/events/load-directory";
import { directoryFilters, type EventDirectoryPage } from "@/lib/events/directory";

export const metadata = publicMetadata("Browse awards and voting events in Ghana", "Find public awards, competitions and community voting events on VotecastHub GH. Explore nominees, voting dates and participation rules.", "/events");

export default async function EventsPage() {
  let page: EventDirectoryPage = { events: [], total: 0, now: 0 };
  let unavailable = false;
  try { page = await loadEventDirectory(directoryFilters.parse({})); }
  catch { unavailable = true; }

  return <main className="public-page">
    <SiteHeader />
    <section className="public-page-heading"><p className="eyebrow">VOTECASTHUB GH EVENTS</p><h1>Find an event worth celebrating.</h1><p>Explore awards and competitions. Browse categories and meet the nominees.</p></section>
    <EventBrowser initialPage={page} unavailable={unavailable} />
    <footer className="site-footer"><Link className="brand footer-brand" href="/"><span className="brand-mark">V</span><span>VotecastHub<span className="brand-accent"> GH</span></span></Link><span>Voting for events and awards.</span><span>© {new Date().getFullYear()} VotecastHub GH</span><nav aria-label="Legal and company links"><Link href="/about">About</Link><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link></nav></footer>
  </main>;
}
