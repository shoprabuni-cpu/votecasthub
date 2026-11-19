import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { BrandLogo } from "@/components/brand-logo";
import { EventResultsView } from "@/components/results/event-results-view";
import { loadEventPublicResults } from "@/lib/events/results";

export const revalidate = 30; // Fresh results every 30 seconds

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const results = await loadEventPublicResults(slug);

  if (!results) {
    return {
      title: "Awards Results Not Found | VoteCastHub GH",
      robots: { index: false },
    };
  }

  const { event, total_ballots } = results;
  return {
    title: `${event.name} - Official Awards Results & Standings | VoteCastHub GH`,
    description: `View certified standings, recorded vote tallies (${total_ballots.toLocaleString("en-GH")} votes), and category winners for ${event.name} organized by ${event.organization_name}.`,
    openGraph: {
      title: `${event.name} - Awards Results`,
      description: `Official results, category winners, and live standings for ${event.name}.`,
      images: event.image_url ? [event.image_url] : [],
    },
  };
}

export default async function EventAwardsResultsPage({ params }: PageProps) {
  const { slug } = await params;
  const data = await loadEventPublicResults(slug);

  if (!data) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-[var(--paper)] text-[var(--ink)]">
      <SiteHeader />

      <div className="mx-auto max-w-6xl px-4 pt-8 sm:px-6">
        <EventResultsView data={data} />
      </div>

      {/* Footer */}
      <footer className="mx-auto mt-16 max-w-6xl border-t border-stone-200 px-4 py-8 text-xs text-stone-600 sm:px-6 dark:border-[#1c2721] dark:text-stone-400 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link className="inline-flex items-center" href="/">
            <BrandLogo height={34} />
          </Link>
          <span className="text-stone-500 dark:text-stone-400">
            Certified Official Audit Records · VoteCastHub GH
          </span>
        </div>
        <span>© {new Date().getFullYear()} VoteCastHub GH</span>
        <nav aria-label="Legal and company links" className="flex items-center gap-4 font-medium">
          <Link href="/about" className="hover:text-emerald-700 dark:hover:text-emerald-400">About</Link>
          <Link href="/privacy" className="hover:text-emerald-700 dark:hover:text-emerald-400">Privacy</Link>
          <Link href="/terms" className="hover:text-emerald-700 dark:hover:text-emerald-400">Terms</Link>
        </nav>
      </footer>
    </main>
  );
}
