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
    <main className="public-page tickets-page min-h-screen">
      <SiteHeader />
      <div className="mx-auto w-full max-w-4xl flex-1 px-4 py-10 sm:px-6 sm:py-16">
        <TicketLookupClient initialQuery={initialQuery} />
      </div>
      <footer className="site-footer">
        <Link className="inline-flex items-center" href="/">
          <BrandLogo height={34} />
        </Link>
        <span>Voting & ticketing for live events in Ghana.</span>
        <span>© {new Date().getFullYear()} VotecastHub GH</span>
        <nav aria-label="Legal and company links">
          <Link href="/about">About</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
        </nav>
      </footer>
    </main>
  );
}
