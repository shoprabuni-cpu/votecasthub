import Link from "next/link";
import Image from "next/image";
import { DevicePreview } from "@/components/events/device-preview";
import { CookieSettingsLink } from "@/components/cookie-consent";
import { Icon } from "@/components/icon";
import { SiteHeader } from "@/components/site-header";
import { EventBrowser } from "@/components/events/event-browser";
import { UssdOverview } from "@/components/events/ussd-overview";
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

      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-copy">
          <p className="eyebrow"><span className="status-dot" /> FOR GHANAIAN AWARDS & COMPETITIONS</p>
          <h1 id="hero-title">Good events deserve a <em>fair vote.</em></h1>
          <p className="hero-description">Online voting for awards, competitions, and community events in Ghana. Set up nominees, choose voter verification, and share clear voting rules with your community.</p>
          <div className="hero-actions"><Link className="primary-link" href="/events">Browse events <span aria-hidden="true">↗</span></Link><Link className="secondary-button" href="/sign-up">Create an event</Link></div>
          <p className="hero-note">Website voting, with optional phone dialing for activated events. <Link href="#ussd" className="font-semibold text-emerald-800 underline underline-offset-4">Explore USSD</Link></p>
        </div>
        <div className="relative min-w-0 rounded-3xl bg-gradient-to-br from-emerald-50 to-stone-100 p-2 sm:p-4"><DevicePreview /></div>
      </section>

      <section className="trust-strip" aria-label="Platform principles"><span>DESIGNED FOR CLARITY</span><span className="trust-divider" /><span>Voter verification options</span><span className="trust-divider" /><span>Rules enforced</span><span className="trust-divider" /><span>Organizer control</span></section>

      <div className="mx-auto max-w-6xl"><EventBrowser initialPage={page} unavailable={unavailable} compact /></div>
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6"><UssdOverview /></div>

      <section className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 lg:grid-cols-[.9fr_1.1fr] lg:gap-12" id="how-it-works" aria-labelledby="features-title">
        <div className="flex flex-wrap items-center justify-between gap-6"><div><p className="eyebrow">THE PLATFORM</p><h2 id="features-title" className="mt-3 text-3xl font-semibold leading-tight tracking-tight text-stone-950 sm:text-4xl">Manage categories, nominees<br />and voting in one place.</h2></div><Image src="/images/Classic Gold Trophy on Emerald Base.png" alt="" width={1254} height={1254} sizes="160px" className="h-40 w-40 object-contain" /></div>
        <div className="feature-list">
          <article className="feature grid-cols-[36px_1fr]!"><span className="feature-number">01</span><div className="feature-copy"><Icon className="feature-icon" name="calendar" size={20} /><span><h3>Create categories and add nominees</h3><p>Create an event, organize categories and nominees, and choose how voting will work.</p></span></div></article>
          <article className="feature grid-cols-[36px_1fr]!"><span className="feature-number">02</span><div className="feature-copy"><Icon className="feature-icon" name="shield" size={20} /><span><h3>Set the voting rules</h3><p>Show the vote limit before people participate and enforce it as each vote is recorded.</p></span></div></article>
          <article className="feature grid-cols-[36px_1fr]!"><span className="feature-number">03</span><div className="feature-copy"><Icon className="feature-icon" name="users" size={20} /><span><h3>Manage events with your team</h3><p>Invite teammates and manage event setup from one organization workspace.</p></span></div></article>
        </div>
      </section>

      <ResourceLinks />
      <StructuredData data={{ "@context": "https://schema.org", "@graph": [
        { "@type": "Organization", "@id": absoluteUrl("/#organization"), name: SITE_NAME, url: absoluteUrl("/"), logo: absoluteUrl("/icons/icon-192.png"), email: "info@votecasthub.com", description: SITE_DESCRIPTION },
        { "@type": "WebSite", "@id": absoluteUrl("/#website"), name: SITE_NAME, url: absoluteUrl("/"), inLanguage: "en-GH", publisher: { "@id": absoluteUrl("/#organization") } },
      ] }} />
      <footer className="site-footer"><Link className="brand footer-brand" href="/"><span className="brand-mark">V</span><span>VotecastHub<span className="brand-accent"> GH</span></span></Link><span>Voting for events and awards.</span><nav aria-label="Legal and company links"><Link href="/about">About</Link><Link href="/guides">Guides</Link><Link href="/pricing">Pricing</Link><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link><a href="mailto:support@votecasthub.com">Support</a><CookieSettingsLink /></nav><span>© {new Date().getFullYear()} VotecastHub GH</span></footer>
    </main>
  );
}
