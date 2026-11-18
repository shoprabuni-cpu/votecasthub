import Link from "next/link";
import { GuidesFolderShowcase } from "@/components/guides/guides-folder-showcase";

export function ResourceLinks() {
  return (
    <section
      className="relative w-full overflow-hidden border-y border-emerald-950/40 bg-[#060a08] py-16 sm:py-24 text-stone-100"
      aria-labelledby="organizer-guides-title"
    >
      {/* Unique Ambient Atmospheric Background */}
      <div className="pointer-events-none absolute inset-0 select-none" aria-hidden="true">
        {/* Soft emerald radial glow on the left */}
        <div className="absolute -top-32 -left-32 h-[450px] w-[450px] rounded-full bg-emerald-600/10 blur-[120px]" />
        {/* Soft sapphire radial glow on the right */}
        <div className="absolute -bottom-32 -right-32 h-[450px] w-[450px] rounded-full bg-sky-600/10 blur-[120px]" />
        {/* Central ambient light */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[600px] w-full max-w-6xl rounded-full bg-emerald-950/20 blur-[140px]" />
        {/* Subtle architectural dot grid */}
        <div className="absolute inset-0 bg-[radial-gradient(#10b98115_1px,transparent_1px)] [background-size:24px_24px] opacity-70" />
      </div>

      <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-stone-800/80 pb-6">
          <div>
            <p className="flex items-center gap-2 text-xs font-bold tracking-widest text-emerald-400 uppercase">
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]" />
              PLATFORM GUIDES &amp; DOCUMENTATION
            </p>
            <h2 id="organizer-guides-title" className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Plan your next vote.
            </h2>
            <p className="mt-2 text-sm text-stone-400 max-w-xl">
              Interactive playbooks for awards, elections, offline USSD dial-in, and WhatsApp/Telegram voting bots.
            </p>
          </div>
          <Link
            href="/guides"
            className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-stone-700 bg-stone-900/80 px-4 py-2 text-sm font-semibold text-emerald-400 shadow-sm transition hover:border-emerald-500 hover:bg-stone-800 hover:text-emerald-300"
          >
            All organizer guides <span>→</span>
          </Link>
        </div>

        <div className="mt-8">
          <GuidesFolderShowcase />
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-stone-800/80 pt-6 text-sm text-stone-400">
          <p>
            Considering paid voting?{" "}
            <Link
              href="/pricing"
              className="font-semibold text-emerald-400 underline underline-offset-4 hover:text-emerald-300"
            >
              Read how pricing works.
            </Link>
          </p>
          <p className="text-xs text-stone-500">
            Official VoteCastHub GH Documentation • Updated for 2026
          </p>
        </div>
      </div>
    </section>
  );
}
