import Link from "next/link";

const voteFlow = [
  { number: "01", title: "Event published", detail: "Organizers set the voting dates, categories, nominees, and rules." },
  { number: "02", title: "Payment verified", detail: "A payment counts only after the provider confirms it." },
  { number: "03", title: "Vote recorded", detail: "The confirmed payment and vote record are saved together." },
];

export default function HomePage() {
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
            <div className="flow-card-footer"><span className="lock-mark" aria-hidden="true">⌑</span> Payment verification happens on the server</div>
          </div>
          <div className="floating-note"><span className="note-icon">✓</span><span><strong>Only verified payments count</strong><small>Vote records are not client editable</small></span></div>
          <p className="art-caption">A TRACEABLE PATH FROM PAYMENT TO RESULT</p>
        </div>
      </section>

      <section className="trust-strip" aria-label="Platform principles"><span>DESIGNED FOR TRUST</span><span className="trust-divider" /><span>Clear records</span><span className="trust-divider" /><span>Verified payments</span><span className="trust-divider" /><span>Organizer control</span></section>

      <section className="features" id="how-it-works" aria-labelledby="features-title">
        <div className="section-heading"><p className="eyebrow">THE PLATFORM</p><h2 id="features-title">Voting that makes sense<br />from setup to results.</h2></div>
        <div className="feature-list">
          <article className="feature"><span className="feature-number">01</span><div><h3>Set up with confidence</h3><p>Create an event, organize categories and nominees, and publish clear voting dates and rules.</p></div><span className="feature-arrow" aria-hidden="true">↗</span></article>
          <article className="feature"><span className="feature-number">02</span><div><h3>Use one voting system</h3><p>Web voting and future USSD voting follow the same event, payment, and vote rules.</p></div><span className="feature-arrow" aria-hidden="true">↗</span></article>
          <article className="feature"><span className="feature-number">03</span><div><h3>Reconcile every cedi</h3><p>Payments, votes, platform fees, and organizer earnings are recorded for review and reporting.</p></div><span className="feature-arrow" aria-hidden="true">↗</span></article>
        </div>
      </section>

      <footer className="site-footer"><Link className="brand footer-brand" href="/"><span className="brand-mark">V</span><span>VotecastHub<span className="brand-accent"> GH</span></span></Link><span>Voting for events and awards.</span><span>© {new Date().getFullYear()} VotecastHub GH</span></footer>
    </main>
  );
}
