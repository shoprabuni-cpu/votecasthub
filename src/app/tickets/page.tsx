import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
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
    <main className="min-h-screen bg-stone-50 dark:bg-[#030504]">
      <SiteHeader />
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-16">
        <TicketLookupClient initialQuery={initialQuery} />
      </div>
    </main>
  );
}
