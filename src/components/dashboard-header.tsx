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
  return (
    <header className="border-b border-stone-200 bg-white dark:border-[#1c2721] dark:bg-black">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        {organizationId ? (
          <Link className="flex flex-col" href={`/organizer/${organizationId}/events`}>
            <span className="text-[10px] font-bold tracking-widest text-emerald-800 dark:text-emerald-400 uppercase">YOUR WORKSPACE</span>
            <strong className="text-sm font-semibold text-stone-900 dark:text-white">Event management</strong>
          </Link>
        ) : (
          <Link className="inline-flex items-center" href="/" aria-label="VoteCastHub GH home">
            <BrandLogo height={38} />
          </Link>
        )}
        <nav className="flex items-center gap-4" aria-label="Organizer navigation">
          <ThemeToggle />
          <Link className="inline-flex items-center gap-1.5 text-xs font-medium text-stone-600 hover:text-emerald-700 dark:text-stone-300 dark:hover:text-emerald-400" href="/events">
            <span aria-hidden="true">↗</span> View public site
          </Link>
          <SignOutForm />
        </nav>
      </div>
    </header>
  );
}
