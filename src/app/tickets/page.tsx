import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { BrandLogo } from "@/components/brand-logo";
import { TicketLookupClient } from "./ticket-lookup-client";
import { loadEventDirectory } from "@/lib/events/load-directory";
import { directoryFilters } from "@/lib/events/directory";
import { PublicEventCard, type PublicEventCardData } from "@/components/events/public-event-card";

export const metadata: Metadata = {
  title: "Find My Tickets | VoteCastHub GH",
  description: "Retrieve, print, or download your event entrance passes and CODE PAX using your phone number.",
};

export default async function FindTicketsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; phone?: string }>;
}) {
  const params = await searchParams;
  const initialQuery = params.q || params.phone || "";

  let ticketEvents: { events: PublicEventCardData[]; total: number; now: number } | null = null;
  try {
    ticketEvents = await loadEventDirectory(
      directoryFilters.parse({ event_type: "ticketing", status: "all" })
    );
  } catch {
    ticketEvents = null;
  }

  return (
    <main className="min-h-screen bg-[var(--paper)] text-[var(--ink)] flex flex-col justify-between">
      <SiteHeader />
      <div className="mx-auto w-full max-w-4xl flex-1 px-4 py-10 sm:px-6 sm:py-16">
        <TicketLookupClient initialQuery={initialQuery} />
      </div>

      {ticketEvents && ticketEvents.events && ticketEvents.events.length > 0 && (
        <section className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 border-t border-stone-200/80 dark:border-[#1c2721]">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-amber-700 dark:text-amber-400">
                Official Admission Passes &amp; Tickets
              </p>
              <h2 className="mt-1 font-serif text-2xl sm:text-3xl font-bold tracking-tight text-stone-900 dark:text-white">
                Upcoming Events in Ghana
              </h2>
              <p className="mt-1 text-xs sm:text-sm text-stone-600 dark:text-stone-300">
                Purchase authentic gate passes with instant PAX entry codes delivered via SMS &amp; WhatsApp.
              </p>
            </div>
            <Link
              href="/events"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-800 dark:text-amber-400 hover:underline"
            >
              Browse all events &rarr;
            </Link>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {ticketEvents.events.map((event) => (
              <PublicEventCard key={event.id} event={event} now={ticketEvents?.now} />
            ))}
          </div>
        </section>
      )}

      <footer className="mx-auto mt-16 w-full max-w-6xl border-t border-stone-200 px-4 py-8 sm:px-6 text-xs text-stone-600 dark:border-[#1c2721] dark:text-stone-400 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link className="inline-flex items-center" href="/">
            <BrandLogo height={34} />
          </Link>
          <span className="text-stone-500 dark:text-stone-400">Voting &amp; ticketing for live events in Ghana.</span>
        </div>
        <span>&copy; {new Date().getFullYear()} VotecastHub GH</span>
        <nav aria-label="Legal and company links" className="flex items-center gap-4 font-medium">
          <Link href="/about" className="hover:text-emerald-700 dark:hover:text-emerald-400">About</Link>
          <Link href="/privacy" className="hover:text-emerald-700 dark:hover:text-emerald-400">Privacy</Link>
          <Link href="/terms" className="hover:text-emerald-700 dark:hover:text-emerald-400">Terms</Link>
        </nav>
      </footer>
    </main>
  );
}
