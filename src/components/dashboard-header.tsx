import Link from "next/link";
import { SignOutForm } from "@/components/auth/sign-out-form";

export function DashboardHeader() {
  return <header className="dashboard-header">
    <Link className="brand" href="/" aria-label="VotecastHub GH home"><span className="brand-mark">V</span><span>VotecastHub<span className="brand-accent"> GH</span></span></Link>
    <nav className="dashboard-nav" aria-label="Organizer navigation"><Link className="header-link" href="/events">Public events</Link><SignOutForm /></nav>
  </header>;
}
