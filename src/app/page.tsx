import Link from "next/link";
import Image from "next/image";
import { DevicePreview } from "@/components/events/device-preview";
import { CookieSettingsLink } from "@/components/cookie-consent";
import { Icon } from "@/components/icon";
import { SiteHeader } from "@/components/site-header";
import { EventBrowser } from "@/components/events/event-browser";
import { MessagingBotsOverview } from "@/components/events/messaging-bots-overview";
import { UssdOverview } from "@/components/events/ussd-overview";
import { BrandLogo } from "@/components/brand-logo";
import { SegmentedThemeSwitch } from "@/components/theme-toggle";
import { loadEventDirectory } from "@/lib/events/load-directory";
import { directoryFilters, type EventDirectoryPage } from "@/lib/events/directory";
import { ResourceLinks } from "@/components/seo/resource-links";
import { StructuredData } from "@/components/seo/structured-data";
import { absoluteUrl, publicMetadata, SITE_DESCRIPTION, SITE_NAME } from "@/lib/seo/metadata";

export const metadata = { ...publicMetadata("Online voting for awards and competitions in Ghana", SITE_DESCRIPTION, "/"), title: { absolute: "VotecastHub GH | Online voting for awards in Ghana" } };

export default async function HomePage() {
  let page: EventDirectoryPage = { events: [], total: 0, now: 0 };
  let unavailable = false;
  try { page = await loadEventDirectory(directoryFilters.parse({})); }
  catch { unavailable = true; }
  return (
    <main>
      <SiteHeader />

      <section className="mx-auto grid max-w-6xl min-h-[580px] items-center gap-10 px-4 py-12 sm:px-6 lg:grid-cols-2 lg:py-20" aria-labelledby="hero-title">
        <div className="max-w-xl">
          <h1 id="hero-title" className="mb-4 font-serif text-4xl sm:text-5xl lg:text-6xl font-medium tracking-tight text-stone-900 leading-[1.08] dark:text-white">Fair voting & seamless <em className="italic text-emerald-800 dark:text-emerald-400 font-serif">event ticketing.</em></h1>
          <p className="max-w-lg text-base sm:text-lg leading-relaxed text-stone-600 dark:text-stone-300">The all-in-one platform for Ghanaian awards, contests, conferences, and parties. Sell event tickets with auto-generated PAX codes or run credible nominee voting with instant Mobile Money.</p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link className="inline-flex min-h-12 items-center justify-center gap-2.5 rounded-xl bg-emerald-900 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500" href="/events">Explore events & tickets <span aria-hidden="true">↗</span></Link>
            <Link className="inline-flex min-h-12 items-center justify-center rounded-xl border border-stone-300 bg-white px-6 py-3 text-sm font-semibold text-stone-800 shadow-2xs transition hover:bg-stone-50 dark:border-[#1c2721] dark:bg-[#0c120e] dark:text-stone-200 dark:hover:bg-[#141d18]" href="/sign-up">Host an event</Link>
          </div>
          <p className="mt-6 text-xs text-stone-500 dark:text-stone-400 leading-relaxed">Vote or buy tickets via Web, WhatsApp (+233 59 299 2566), Telegram (@VotecastHubGH_bot), or USSD (*920#). <Link href="#chat-voting" className="font-semibold text-emerald-800 underline underline-offset-4 dark:text-emerald-400">Explore Chat Voting</Link></p>
        </div>
        <div className="relative min-w-0 rounded-3xl bg-gradient-to-br from-emerald-50 to-stone-100 p-2 sm:p-4 dark:from-emerald-950/20 dark:to-stone-900/40 dark:border dark:border-[#1c2721]"><DevicePreview /></div>
      </section>

      <section className="mx-auto my-6 flex max-w-6xl flex-wrap items-center justify-center gap-3 px-4 py-3.5 text-[11px] font-bold tracking-wider text-stone-600 uppercase sm:px-6 dark:text-stone-400 rounded-2xl border border-stone-200/80 bg-stone-50/70 dark:border-[#1c2721] dark:bg-[#0c120e]" aria-label="Platform principles">
        <span>VOTING & EVENT TICKETING</span>
        <span className="hidden sm:inline-block h-1 w-1 rounded-full bg-stone-300 dark:bg-stone-700" />
        <span>Instant PAX Gate Codes</span>
        <span className="hidden sm:inline-block h-1 w-1 rounded-full bg-stone-300 dark:bg-stone-700" />
        <span>Mobile Money & Cards</span>
        <span className="hidden sm:inline-block h-1 w-1 rounded-full bg-stone-300 dark:bg-stone-700" />
        <span>Organizer Control</span>
      </section>

      <div className="mx-auto max-w-6xl"><EventBrowser initialPage={page} unavailable={unavailable} compact /></div>
      
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6"><MessagingBotsOverview /></div>
      
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6"><UssdOverview /></div>

      <section className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 lg:grid-cols-[.9fr_1.1fr] lg:gap-12" id="how-it-works" aria-labelledby="features-title">
        <div className="flex flex-wrap items-center justify-between gap-6"><div><p className="flex items-center gap-2 text-xs font-bold tracking-widest text-emerald-800 dark:text-emerald-400 uppercase">THE PLATFORM</p><h2 id="features-title" className="mt-3 text-3xl font-semibold leading-tight tracking-tight text-stone-950 sm:text-4xl dark:text-white">Manage categories, nominees<br />and voting in one place.</h2></div><Image src="/images/Classic Gold Trophy on Emerald Base.png" alt="" width={1254} height={1254} sizes="160px" className="h-40 w-40 object-contain" /></div>
        <div className="space-y-4">
          <article className="grid grid-cols-[36px_1fr] items-start gap-4 rounded-2xl border border-stone-200 bg-white p-5 shadow-2xs transition hover:border-emerald-300 dark:border-[#1c2721] dark:bg-[#0c120e] dark:hover:border-emerald-800/80"><span className="flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-xs font-bold text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-400">01</span><div className="flex items-start gap-3"><Icon className="mt-0.5 shrink-0 text-emerald-800 dark:text-emerald-400" name="calendar" size={20} /><span><h3 className="font-semibold text-stone-900 dark:text-white">Create categories and add nominees</h3><p className="mt-1 text-xs text-stone-600 dark:text-stone-300">Create an event, organize categories and nominees, and choose how voting will work.</p></span></div></article>
          <article className="grid grid-cols-[36px_1fr] items-start gap-4 rounded-2xl border border-stone-200 bg-white p-5 shadow-2xs transition hover:border-emerald-300 dark:border-[#1c2721] dark:bg-[#0c120e] dark:hover:border-emerald-800/80"><span className="flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-xs font-bold text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-400">02</span><div className="flex items-start gap-3"><Icon className="mt-0.5 shrink-0 text-emerald-800 dark:text-emerald-400" name="shield" size={20} /><span><h3 className="font-semibold text-stone-900 dark:text-white">Set the voting rules</h3><p className="mt-1 text-xs text-stone-600 dark:text-stone-300">Show the vote limit before people participate and enforce it as each vote is recorded.</p></span></div></article>
          <article className="grid grid-cols-[36px_1fr] items-start gap-4 rounded-2xl border border-stone-200 bg-white p-5 shadow-2xs transition hover:border-emerald-300 dark:border-[#1c2721] dark:bg-[#0c120e] dark:hover:border-emerald-800/80"><span className="flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-xs font-bold text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-400">03</span><div className="flex items-start gap-3"><Icon className="mt-0.5 shrink-0 text-emerald-800 dark:text-emerald-400" name="users" size={20} /><span><h3 className="font-semibold text-stone-900 dark:text-white">Manage events with your team</h3><p className="mt-1 text-xs text-stone-600 dark:text-stone-300">Invite teammates and manage event setup from one organization workspace.</p></span></div></article>
        </div>
      </section>

      <ResourceLinks />
      <StructuredData data={{ "@context": "https://schema.org", "@graph": [
        { "@type": "Organization", "@id": absoluteUrl("/#organization"), name: SITE_NAME, url: absoluteUrl("/"), logo: absoluteUrl("/images/votecasthub-logo.png"), email: "info@votecasthub.com", description: SITE_DESCRIPTION },
        { "@type": "WebSite", "@id": absoluteUrl("/#website"), name: SITE_NAME, url: absoluteUrl("/"), inLanguage: "en-GH", publisher: { "@id": absoluteUrl("/#organization") } },
      ] }} />
      <footer className="mx-auto mt-16 max-w-6xl border-t border-stone-200 px-4 py-8 sm:px-6 text-xs text-stone-600 dark:border-[#1c2721] dark:text-stone-400">
        <div className="flex flex-wrap items-center justify-between gap-4 w-full">
          <div className="flex items-center gap-3">
            <Link className="inline-flex items-center" href="/"><BrandLogo height={38} /></Link>
            <span className="text-xs text-stone-500 dark:text-stone-400">Voting for events and awards in Ghana.</span>
          </div>
          <SegmentedThemeSwitch />
          <nav aria-label="Legal and company links" className="flex flex-wrap items-center gap-4 font-medium">
            <Link href="/about" className="hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors">About</Link>
            <Link href="/guides" className="hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors">Guides</Link>
            <Link href="/pricing" className="hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors">Pricing</Link>
            <Link href="/privacy" className="hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors">Terms</Link>
            <a href="mailto:support@votecasthub.com" className="hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors">Support</a>
            <CookieSettingsLink />
          </nav>
        </div>
        <div className="mt-4 pt-4 border-t border-stone-200 dark:border-[#1c2721] w-full text-center sm:text-left text-[11px] text-stone-400 dark:text-stone-500">
          © {new Date().getFullYear()} VoteCastHub GH. All rights reserved.
        </div>
      </footer>
    </main>
  );
}
