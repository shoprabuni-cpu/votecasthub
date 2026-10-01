import Link from "next/link";

export function SiteHeader() {
  return <header className="site-header">
    <Link className="brand" href="/" aria-label="VotecastHub GH home"><span className="brand-mark">V</span><span>VotecastHub<span className="brand-accent"> GH</span></span></Link>
    <nav className="header-nav" aria-label="Main navigation"><Link className="header-link" href="/events">Browse events</Link><Link className="header-link" href="/sign-in">Organizer sign in</Link><Link className="header-cta" href="/sign-up">Get started</Link></nav>
  </header>;
}
