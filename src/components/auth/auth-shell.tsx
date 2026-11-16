import Link from "next/link";
import type { ReactNode } from "react";
import { CookieSettingsLink } from "@/components/cookie-consent";
import { BrandLogo } from "@/components/brand-logo";
import { ThemeToggle, SegmentedThemeSwitch } from "@/components/theme-toggle";

export function AuthShell({ eyebrow, title, description, children }: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <main className="auth-page">
      <div className="flex items-center justify-between w-full max-w-[1100px] mx-auto mb-3 px-2">
        <Link className="inline-flex items-center min-h-11" href="/" aria-label="VoteCastHub GH home">
          <BrandLogo height={42} priority />
        </Link>
        <ThemeToggle />
      </div>

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

      <div className="auth-footer flex flex-wrap items-center justify-between gap-3 w-full max-w-[1100px] mx-auto">
        <span>VotecastHub GH · Voting for events and awards</span>
        <SegmentedThemeSwitch />
        <nav aria-label="Legal links" className="flex items-center gap-3">
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <CookieSettingsLink/>
        </nav>
      </div>
    </main>
  );
}
