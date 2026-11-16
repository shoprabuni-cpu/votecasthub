"use client";
import { useContext } from "react";
import { WorkspaceShellContext } from "@/components/organizations/workspace-shell";
import Link from "next/link";
import { SignOutForm } from "@/components/auth/sign-out-form";
import { BrandLogo } from "@/components/brand-logo";
import { ThemeToggle } from "@/components/theme-toggle";

export function DashboardHeader({ organizationId }: { organizationId?: string }) {
  const inWorkspace = useContext(WorkspaceShellContext);
  if (inWorkspace) return null;
  return <header className="dashboard-header dark:border-[#1c2721] dark:bg-black">
    <div className="dashboard-header-main">
      {organizationId ? <Link className="workspace-top-title" href={`/organizer/${organizationId}/events`}><span>YOUR WORKSPACE</span><strong>Event management</strong></Link> : <Link className="brand" href="/" aria-label="VoteCastHub GH home"><BrandLogo height={38} /></Link>}
      <nav className="dashboard-nav" aria-label="Organizer navigation">
        <ThemeToggle />
        <Link className="dashboard-public-link dark:text-stone-300 dark:hover:text-emerald-400" href="/events"><span aria-hidden="true">↗</span> View public site</Link>
        <SignOutForm />
      </nav>
    </div>
  </header>;
}
