import { publicMetadata } from "@/lib/seo/metadata";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { BrandLogo } from "@/components/brand-logo";
import { ResultsBrowser } from "@/components/results/results-browser";
import { loadPublicAwardsDirectory, type EventResultsSummary } from "@/lib/events/results";

export const metadata = publicMetadata(
  "Official Awards Results & Certified Standings | VoteCastHub GH",
  "Explore live tallies, real-time standings, and certified official award results across Ghanaian competitions, university awards, and community pageants.",
  "/results"
);

export const revalidate = 60; // Revalidate results every 60 seconds

export default async function AwardsResultsPage() {
  let events: EventResultsSummary[] = [];
  try {
    events = await loadPublicAwardsDirectory();
  } catch {
    events = [];
  }

  return (
    <main className="min-h-screen bg-[var(--paper)] text-[var(--ink)]">
      <SiteHeader />

      {/* Hero Section */}
      <section className="relative overflow-hidden border-b border-stone-200/80 bg-linear-to-b from-stone-50 via-white to-stone-50/50 px-4 py-12 sm:px-6 sm:py-16 dark:border-[#1c2721] dark:from-[#060a08] dark:via-[#0c120e] dark:to-[#060a08]">
        <div className="mx-auto max-w-6xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3.5 py-1 text-xs font-bold tracking-wider text-amber-700 uppercase backdrop-blur-md dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-400">
            <span>🏆</span>
            <span>Certified Awards &amp; Election Outcomes</span>
          </div>

          <h1 className="mt-4 font-serif text-3xl font-bold tracking-tight text-stone-900 sm:text-4xl lg:text-5xl dark:text-white">
            Awards Results &amp; Certified Standings
          </h1>

          <p className="mt-3 max-w-2xl text-base text-stone-600 sm:text-lg dark:text-stone-300">
            Transparent, real-time standings and tamper-proof audit tallies for verified
            competitions, pageants, and recognition awards across Ghana.
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-6 text-xs text-stone-500 dark:text-stone-400">
            <div className="flex items-center gap-2">
              <span className="text-emerald-600 dark:text-emerald-400">✓</span>
              <span>Cryptographically verified ballots</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-emerald-600 dark:text-emerald-400">✓</span>
              <span>Direct mobile money &amp; USSD audit trail</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-emerald-600 dark:text-emerald-400">✓</span>
              <span>Official podiums &amp; category winners</span>
            </div>
          </div>
        </div>
      </section>

      {/* Results Browser Grid */}
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <ResultsBrowser initialEvents={events} />
      </div>

      {/* Legal & Brand Footer */}
      <footer className="mx-auto mt-16 max-w-6xl border-t border-stone-200 px-4 py-8 text-xs text-stone-600 sm:px-6 dark:border-[#1c2721] dark:text-stone-400 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link className="inline-flex items-center" href="/">
            <BrandLogo height={34} />
          </Link>
          <span className="text-stone-500 dark:text-stone-400">
            Official voting &amp; certified awards results for Ghana.
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
