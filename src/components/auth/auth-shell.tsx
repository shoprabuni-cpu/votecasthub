import Link from "next/link";
import type { ReactNode } from "react";
import { CookieSettingsLink } from "@/components/cookie-consent";
import { BrandLogo } from "@/components/brand-logo";
import { ThemeToggle, SegmentedThemeSwitch } from "@/components/theme-toggle";

export function AuthShell({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <main className="min-h-screen bg-[var(--paper)] text-[var(--ink)] flex flex-col justify-between p-4 sm:p-6 lg:p-8">
      <div className="flex items-center justify-between w-full max-w-[1100px] mx-auto mb-3 px-2">
        <Link className="inline-flex items-center min-h-11" href="/" aria-label="VoteCastHub GH home">
          <BrandLogo height={42} priority />
        </Link>
        <ThemeToggle />
      </div>

      <div className="mx-auto grid w-full max-w-[1100px] grid-cols-1 gap-8 lg:grid-cols-2 items-center my-auto py-6">
        <aside className="hidden lg:flex flex-col justify-between relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-950 via-emerald-900 to-stone-950 p-10 text-white min-h-[580px] shadow-2xl border border-emerald-900/50" aria-label="VotecastHub organizer tools">
          <div>
            <p className="flex items-center gap-2 text-[10px] font-bold tracking-widest text-emerald-400 uppercase">
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" /> BUILT FOR YOUR NEXT BIG EVENT
            </p>
            <h2 className="mt-4 mb-3 font-serif text-4xl sm:text-5xl font-medium tracking-tight text-white leading-[1.1]">
              Bring your<br /><em className="italic text-emerald-300 font-serif">community</em><br />together.
            </h2>
            <p className="text-sm text-emerald-100/80 leading-relaxed max-w-sm">
              Plan the event, introduce your nominees, and give your audience one clear place to take part.
            </p>
          </div>

          <div className="space-y-3 my-6">
            <div className="flex items-center justify-between rounded-xl border border-emerald-800/60 bg-emerald-900/40 px-4 py-3 text-xs">
              <div className="flex items-center gap-3">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-800 text-[11px] font-bold text-white">01</span>
                <strong>Create your organization</strong>
              </div>
              <span className="text-emerald-300">↗</span>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-emerald-800/60 bg-emerald-900/40 px-4 py-3 text-xs">
              <div className="flex items-center gap-3">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-800 text-[11px] font-bold text-white">02</span>
                <strong>Set up awards and nominees</strong>
              </div>
              <span className="text-emerald-300">↗</span>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-emerald-800/60 bg-emerald-900/40 px-4 py-3 text-xs">
              <div className="flex items-center gap-3">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-800 text-[11px] font-bold text-white">03</span>
                <strong>Share your event</strong>
              </div>
              <span className="text-emerald-300">↗</span>
            </div>
          </div>

          <span className="text-[10px] tracking-widest uppercase font-bold text-emerald-400/80">
            VOTECASTHUB GH <span className="opacity-40">·</span> MADE FOR GHANA
          </span>
        </aside>

        <section className="mx-auto w-full max-w-md rounded-3xl border border-stone-200 bg-white p-8 sm:p-10 shadow-xl dark:border-[#1c2721] dark:bg-[#0c120e]" aria-labelledby="auth-title">
          <p className="text-xs font-bold tracking-widest text-emerald-800 uppercase dark:text-emerald-400">{eyebrow}</p>
          <h1 id="auth-title" className="mt-3 font-serif text-2xl sm:text-3xl font-medium tracking-tight text-stone-900 dark:text-white">{title}</h1>
          <p className="mt-2 text-sm text-stone-600 dark:text-stone-300 leading-relaxed">{description}</p>
          {children}
        </section>
      </div>

      <div className="mx-auto mt-8 flex flex-wrap items-center justify-between gap-4 text-xs text-stone-500 dark:text-stone-400 w-full max-w-[1100px] pt-4 border-t border-stone-200/60 dark:border-[#1c2721]">
        <span>VotecastHub GH · Voting for events and awards</span>
        <SegmentedThemeSwitch />
        <nav aria-label="Legal links" className="flex items-center gap-4 font-medium">
          <Link href="/privacy" className="hover:text-emerald-700 dark:hover:text-emerald-400">Privacy</Link>
          <Link href="/terms" className="hover:text-emerald-700 dark:hover:text-emerald-400">Terms</Link>
          <CookieSettingsLink />
        </nav>
      </div>
    </main>
  );
}
