import Link from "next/link";
import type { ReactNode } from "react";
import { CookieSettingsLink } from "@/components/cookie-consent";

export function AuthShell({ eyebrow, title, description, children }: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <main className="auth-page">
      <Link className="brand auth-brand" href="/" aria-label="VotecastHub GH home"><span className="brand-mark">V</span><span>VotecastHub<span className="brand-accent"> GH</span></span></Link>
      <div className="auth-layout">
        <aside className="auth-visual" aria-label="VotecastHub organizer tools">
          <div className="auth-visual-orbit auth-visual-orbit-one"/><div className="auth-visual-orbit auth-visual-orbit-two"/>
          <p className="eyebrow"><span className="status-dot"/> BUILT FOR YOUR NEXT BIG EVENT</p>
          <h2>Bring your<br/><em>community</em><br/>together.</h2>
          <p className="auth-visual-copy">Plan the event, introduce your nominees, and give your audience one clear place to take part.</p>
          <div className="auth-visual-steps"><div><span>01</span><strong>Create your organization</strong><i>↗</i></div><div><span>02</span><strong>Set up awards and nominees</strong><i>↗</i></div><div><span>03</span><strong>Share your event</strong><i>↗</i></div></div>
          <span className="auth-visual-foot">VOTECASTHUB GH <span>·</span> MADE FOR GHANA</span>
        </aside>
        <section className="auth-card" aria-labelledby="auth-title">
          <p className="eyebrow">{eyebrow}</p>
          <h1 id="auth-title">{title}</h1>
          <p className="auth-description">{description}</p>
          {children}
        </section>
      </div>
      <div className="auth-footer"><span>VotecastHub GH · Voting for events and awards</span><nav aria-label="Legal links"><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link><CookieSettingsLink/></nav></div>
    </main>
  );
}
