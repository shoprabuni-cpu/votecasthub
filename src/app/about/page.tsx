import { publicMetadata } from "@/lib/seo/metadata";
import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { SiteHeader } from "@/components/site-header";

export const revalidate = 3600;

export const metadata = publicMetadata("About VotecastHub", "Learn about VotecastHub GH and how it supports event organizers and voters across Ghana.", "/about");

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-[var(--paper)] text-[var(--ink)]">
      <SiteHeader />
      <article className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 sm:py-20 motion-safe:animate-[page-in_.35s_ease-out_both]">
        <p className="text-xs font-bold tracking-widest text-emerald-800 dark:text-emerald-400 uppercase">ABOUT VOTECASTHUB GH</p>
        <h1 className="mt-4 font-serif text-3xl sm:text-4xl lg:text-5xl font-medium tracking-tight text-stone-900 text-balance dark:text-white">Give every event a place to be celebrated.</h1>
        <p className="mt-6 mb-8 text-lg leading-relaxed text-stone-600 dark:text-stone-300">VotecastHub GH is a platform for organizations to publish award and competition events, introduce nominees, and share voting rules with their communities.</p>
        <section className="my-6 border-t border-stone-200 pt-6 dark:border-[#1c2721]">
          <h2 className="font-serif text-2xl font-medium text-stone-900 dark:text-white mb-2">For organizers</h2>
          <p className="text-sm leading-relaxed text-stone-600 dark:text-stone-300">Create an organization workspace, set up events and categories, add nominees, and manage your event status. Team invitations and role-based access help organizations work together.</p>
        </section>
        <section className="my-6 border-t border-stone-200 pt-6 dark:border-[#1c2721]">
          <h2 className="font-serif text-2xl font-medium text-stone-900 dark:text-white mb-2">For voters</h2>
          <p className="text-sm leading-relaxed text-stone-600 dark:text-stone-300">Browse public events, read the event details and rules, and explore nominee profiles. Voting availability depends on each event’s status and its published rules.</p>
        </section>
        <section className="my-6 border-t border-stone-200 pt-6 dark:border-[#1c2721]">
          <h2 className="font-serif text-2xl font-medium text-stone-900 dark:text-white mb-2">Built with care</h2>
          <p className="text-sm leading-relaxed text-stone-600 dark:text-stone-300">We aim to make event participation clear and accessible across Ghana. Organizers can offer website voting and request optional USSD access for voters without internet. USSD dialing instructions appear only for activated events. <Link href="/guides/vote-without-internet-ussd" className="font-semibold text-emerald-800 underline dark:text-emerald-400">Learn how USSD works.</Link></p>
        </section>
        <div className="my-8 rounded-2xl border-l-4 border-emerald-600 bg-emerald-50/60 p-5 text-sm leading-relaxed text-stone-700 dark:border-emerald-500 dark:bg-emerald-950/30 dark:text-stone-300">
          <strong className="block text-stone-900 dark:text-white font-semibold">Get in touch</strong>
          <p className="mt-1">For general enquiries, email <a href="mailto:info@votecasthub.com" className="font-semibold text-emerald-800 underline dark:text-emerald-400">info@votecasthub.com</a>. For help with your account, voting, or payments, email <a href="mailto:support@votecasthub.com" className="font-semibold text-emerald-800 underline dark:text-emerald-400">support@votecasthub.com</a>. VotecastHub GH currently identifies its operating location as Tanoso, Kumasi, Ghana.</p>
        </div>
        <p className="mt-6 text-xs text-stone-400 dark:text-stone-500">Product information last reviewed: 14 October 2026.</p>
      </article>
      <LegalFooter />
    </main>
  );
}

function LegalFooter() {
  return (
    <footer className="mx-auto mt-16 max-w-6xl border-t border-stone-200 px-4 py-8 sm:px-6 text-xs text-stone-600 dark:border-[#1c2721] dark:text-stone-400 flex flex-wrap items-center justify-between gap-4">
      <Link className="inline-flex items-center" href="/"><BrandLogo height={34} /></Link>
      <nav aria-label="Legal and company links" className="flex items-center gap-4 font-medium">
        <Link href="/about" className="hover:text-emerald-700 dark:hover:text-emerald-400">About</Link>
        <Link href="/privacy" className="hover:text-emerald-700 dark:hover:text-emerald-400">Privacy</Link>
        <Link href="/terms" className="hover:text-emerald-700 dark:hover:text-emerald-400">Terms</Link>
        <a href="mailto:support@votecasthub.com" className="hover:text-emerald-700 dark:hover:text-emerald-400">Support</a>
      </nav>
      <span>© {new Date().getFullYear()} VotecastHub GH</span>
    </footer>
  );
}
