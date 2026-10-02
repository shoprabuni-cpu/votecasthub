import Link from "next/link";
import { SignOutForm } from "@/components/auth/sign-out-form";

export function DashboardHeader({ organizationId }: { organizationId?: string }) {
  return <header className="dashboard-header">
    <div className="dashboard-header-main">
      {organizationId ? <Link className="workspace-top-title" href={`/organizer/${organizationId}/events`}><span>YOUR WORKSPACE</span><strong>Event management</strong></Link> : <Link className="brand" href="/" aria-label="VotecastHub GH home"><span className="brand-mark">V</span><span>VotecastHub<span className="brand-accent"> GH</span></span></Link>}
      <nav className="dashboard-nav" aria-label="Organizer navigation">{organizationId && <><Link href={`/organizer/${organizationId}/events`}>Events</Link><Link href={`/organizer/${organizationId}/payments`}>Payment account</Link><Link href={`/organizer/${organizationId}/credits`}>SMS credits</Link><Link href={`/organizer/${organizationId}/earnings`}>Earnings</Link></>}<Link className="dashboard-public-link" href="/events"><span aria-hidden="true">↗</span> View public site</Link><SignOutForm /></nav>
    </div>
  </header>;
}
