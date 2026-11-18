import { publicMetadata } from "@/lib/seo/metadata";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { EventBrowser } from "@/components/events/event-browser";
import { loadEventDirectory } from "@/lib/events/load-directory";
import { directoryFilters, type EventDirectoryPage } from "@/lib/events/directory";
import { BrandLogo } from "@/components/brand-logo";

export const metadata = publicMetadata("Browse awards and voting events in Ghana", "Find public awards, competitions and community voting events on VotecastHub GH. Explore nominees, voting dates and participation rules.", "/events");

export default async function EventsPage() {
  let page: EventDirectoryPage = { events: [], total: 0, now: 0 };
  let unavailable = false;
  try { page = await loadEventDirectory(directoryFilters.parse({})); }
  catch { unavailable = true; }

  return (
    <main className="min-h-screen bg-[var(--paper)] text-[var(--ink)]">
      <SiteHeader />
      <section className="mx-auto max-w-6xl px-4 pt-12 pb-6 sm:px-6 sm:pt-16">
        <p className="flex items-center gap-2 text-xs font-bold tracking-widest text-emerald-800 uppercase dark:text-emerald-400">VOTECASTHUB GH EVENTS</p>
        <h1 className="mt-3 font-serif text-3xl sm:text-4xl lg:text-5xl font-medium tracking-tight text-stone-900 dark:text-white">Find an event worth celebrating.</h1>
        <p className="mt-2 text-base text-stone-600 dark:text-stone-300">Explore awards and competitions. Browse categories and meet the nominees.</p>
      </section>
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <EventBrowser initialPage={page} unavailable={unavailable} />
      </div>
      <footer className="mx-auto mt-16 max-w-6xl border-t border-stone-200 px-4 py-8 sm:px-6 text-xs text-stone-600 dark:border-[#1c2721] dark:text-stone-400 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link className="inline-flex items-center" href="/"><BrandLogo height={34} /></Link>
          <span className="text-stone-500 dark:text-stone-400">Voting for events and awards.</span>
        </div>
        <span>© {new Date().getFullYear()} VotecastHub GH</span>
        <nav aria-label="Legal and company links" className="flex items-center gap-4 font-medium">
          <Link href="/about" className="hover:text-emerald-700 dark:hover:text-emerald-400">About</Link>
          <Link href="/privacy" className="hover:text-emerald-700 dark:hover:text-emerald-400">Privacy</Link>
          <Link href="/terms" className="hover:text-emerald-700 dark:hover:text-emerald-400">Terms</Link>
        </nav>
      </footer>
    </main>
  );
}
