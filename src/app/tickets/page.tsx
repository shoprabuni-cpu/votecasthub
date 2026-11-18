import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { BrandLogo } from "@/components/brand-logo";
import { TicketLookupClient } from "./ticket-lookup-client";

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

  return (
    <main className="min-h-screen bg-[var(--paper)] text-[var(--ink)] flex flex-col justify-between">
      <SiteHeader />
      <div className="mx-auto w-full max-w-4xl flex-1 px-4 py-10 sm:px-6 sm:py-16">
        <TicketLookupClient initialQuery={initialQuery} />
      </div>
      <footer className="mx-auto mt-16 w-full max-w-6xl border-t border-stone-200 px-4 py-8 sm:px-6 text-xs text-stone-600 dark:border-[#1c2721] dark:text-stone-400 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link className="inline-flex items-center" href="/">
            <BrandLogo height={34} />
          </Link>
          <span className="text-stone-500 dark:text-stone-400">Voting & ticketing for live events in Ghana.</span>
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
