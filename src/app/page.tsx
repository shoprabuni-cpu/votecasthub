import Link from "next/link";
import { CookieSettingsLink } from "@/components/cookie-consent";
import { Icon } from "@/components/icon";
import { SiteHeader } from "@/components/site-header";
import { EventBrowser } from "@/components/events/event-browser";
import { loadEventDirectory } from "@/lib/events/load-directory";
import { directoryFilters, type EventDirectoryPage } from "@/lib/events/directory";
import { ResourceLinks } from "@/components/seo/resource-links";
import { StructuredData } from "@/components/seo/structured-data";
import { absoluteUrl, publicMetadata, SITE_DESCRIPTION, SITE_NAME } from "@/lib/seo/metadata";

export const metadata = { ...publicMetadata("Online voting for awards and competitions in Ghana", SITE_DESCRIPTION, "/"), title: { absolute: "VotecastHub GH | Online voting for awards in Ghana" } };

const voteFlow = [
  { number: "01", title: "Open your event", detail: "Find your event and read its voting instructions." },
  { number: "02", title: "Verify or pay", detail: "For free voting, verify your details. For paid voting, complete payment." },
  { number: "03", title: "Your vote counts", detail: "Choose your nominee and follow the event’s voting limits." },
];

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
          <p className="hero-note">Web voting first. USSD is planned for a later phase.</p>
        </div>
        <div className="hero-art overflow-clip" aria-label="How to vote in three steps">
          <div className="orbit orbit-one" /><div className="orbit orbit-two" />
          <div className="flow-card">
            <div className="flow-card-top"><span className="flow-label">THE VOTING FLOW</span><span className="flow-count">3 STEPS</span></div>
            <div className="flow-list">{voteFlow.map((step, index) => <div className="flow-step" key={step.number}><span className={`step-mark ${index === 2 ? "step-mark-final" : ""}`}>{index === 2 ? "✓" : step.number}</span><span className="step-copy"><strong>{step.title}</strong><small>{step.detail}</small></span></div>)}</div>
            <div className="flow-card-footer"><Icon name="shield" size={16} /> Voting limits are checked on the server</div>
          </div>
          <div className="floating-note"><span className="note-icon"><Icon name="check" size={14} /></span><span><strong>Clear rules for every voter</strong><small>Limits apply to every vote</small></span></div>
          <p className="art-caption">FROM EVENT SETUP TO A RECORDED VOTE</p>
        </div>
      </section>

      <section className="trust-strip" aria-label="Platform principles"><span>DESIGNED FOR CLARITY</span><span className="trust-divider" /><span>Verified voters</span><span className="trust-divider" /><span>Rules enforced</span><span className="trust-divider" /><span>Organizer control</span></section>

      <EventBrowser initialPage={page} unavailable={unavailable} />

      <section className="features" id="how-it-works" aria-labelledby="features-title">
        <div className="section-heading"><p className="eyebrow">THE PLATFORM</p><h2 id="features-title">Voting that makes sense<br />from setup to results.</h2></div>
        <div className="feature-list">
          <article className="feature"><span className="feature-number">01</span><div className="feature-copy"><Icon className="feature-icon" name="calendar" size={20} /><span><h3>Set up with confidence</h3><p>Create an event, organize categories and nominees, and choose how voting will work.</p></span></div><span className="feature-arrow" aria-hidden="true">↗</span></article>
          <article className="feature"><span className="feature-number">02</span><div className="feature-copy"><Icon className="feature-icon" name="shield" size={20} /><span><h3>Give voters a clear experience</h3><p>Show the vote limit before people participate and enforce it as each vote is recorded.</p></span></div><span className="feature-arrow" aria-hidden="true">↗</span></article>
          <article className="feature"><span className="feature-number">03</span><div className="feature-copy"><Icon className="feature-icon" name="users" size={20} /><span><h3>Keep your team organized</h3><p>Invite teammates and manage event setup from one organization workspace.</p></span></div><span className="feature-arrow" aria-hidden="true">↗</span></article>
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
