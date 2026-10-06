import Link from "next/link";
import { CookieSettingsLink } from "@/components/cookie-consent";
import { Icon } from "@/components/icon";
import { PublishedEventsCarousel } from "@/components/events/published-events-carousel";
import { createClient } from "@/lib/supabase/server";
import type { PublicEventCardData } from "@/components/events/public-event-card";

const voteFlow = [
  { number: "01", title: "Event published", detail: "Organizers set dates, nominees, and voting limits." },
  { number: "02", title: "Phone verified", detail: "Free voters verify a phone number before voting." },
  { number: "03", title: "Vote recorded", detail: "The selected rule is checked and the vote is recorded." },
];

export default async function HomePage() {
  let featured: PublicEventCardData[] = [];
  try {
    const supabase = await createClient();
    const { data } = await supabase.from("events").select("id,name,slug,description,image_path,unit_price_minor,starts_at,ends_at,status,voting_mode").in("status",["published","paused"]).order("starts_at",{ascending:true}).limit(8);
    const paths=(data??[]).map(e=>e.image_path).filter((p):p is string=>Boolean(p));
    const { data: images }=paths.length?await supabase.storage.from("nominee-images").createSignedUrls(paths,3600):{data:[]};
    const urls=new Map((images??[]).flatMap(i=>i.signedUrl&&i.path?[[i.path,i.signedUrl] as const]:[]));
    featured=(data??[]).map(e=>({...e,imageUrl:e.image_path?urls.get(e.image_path)??null:null})) as PublicEventCardData[];
  } catch { featured=[]; }
  return (
    <main>
      <header className="site-header">
        <Link className="brand" href="/" aria-label="VotecastHub GH home"><span className="brand-mark">V</span><span>VotecastHub<span className="brand-accent"> GH</span></span></Link>
        <nav className="header-nav" aria-label="Main navigation"><Link className="header-link" href="/events">Browse events</Link><Link className="header-link" href="/sign-in">Organizer sign in</Link><Link className="header-cta" href="/sign-up">Get started</Link></nav>
      </header>

      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-copy">
          <p className="eyebrow"><span className="status-dot" /> FOR GHANAIAN AWARDS & COMPETITIONS</p>
          <h1 id="hero-title">Good events deserve a <em>fair vote.</em></h1>
          <p className="hero-description">A dependable way to run voting for awards, competitions, and community events. Organizers stay in control. Confirmed votes leave a clear record.</p>
          <Link className="primary-link" href="/events">Explore events <span aria-hidden="true">↗</span></Link>
          <p className="hero-note">Web voting first. USSD is planned for a later phase.</p>
        </div>
        <div className="hero-art" aria-label="The three stages of a verified vote">
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

      <section className="trust-strip" aria-label="Platform principles"><span>DESIGNED FOR CLARITY</span><span className="trust-divider" /><span>Verified phones</span><span className="trust-divider" /><span>Rules enforced</span><span className="trust-divider" /><span>Organizer control</span></section>

      <PublishedEventsCarousel events={featured} />

      <section className="features" id="how-it-works" aria-labelledby="features-title">
        <div className="section-heading"><p className="eyebrow">THE PLATFORM</p><h2 id="features-title">Voting that makes sense<br />from setup to results.</h2></div>
        <div className="feature-list">
          <article className="feature"><span className="feature-number">01</span><div className="feature-copy"><Icon className="feature-icon" name="calendar" size={20} /><span><h3>Set up with confidence</h3><p>Create an event, organize categories and nominees, and choose how voting will work.</p></span></div><span className="feature-arrow" aria-hidden="true">↗</span></article>
          <article className="feature"><span className="feature-number">02</span><div className="feature-copy"><Icon className="feature-icon" name="shield" size={20} /><span><h3>Give voters a clear experience</h3><p>Show the vote limit before people participate and enforce it as each vote is recorded.</p></span></div><span className="feature-arrow" aria-hidden="true">↗</span></article>
          <article className="feature"><span className="feature-number">03</span><div className="feature-copy"><Icon className="feature-icon" name="users" size={20} /><span><h3>Keep your team organized</h3><p>Invite teammates and manage event setup from one organization workspace.</p></span></div><span className="feature-arrow" aria-hidden="true">↗</span></article>
        </div>
      </section>

      <footer className="site-footer"><Link className="brand footer-brand" href="/"><span className="brand-mark">V</span><span>VotecastHub<span className="brand-accent"> GH</span></span></Link><span>Voting for events and awards.</span><nav aria-label="Legal and company links"><Link href="/about">About</Link><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link><CookieSettingsLink /></nav><span>© {new Date().getFullYear()} VotecastHub GH</span></footer>
    </main>
  );
}
