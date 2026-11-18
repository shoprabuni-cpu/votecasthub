import Link from "next/link";
import { GuidesFolderShowcase } from "@/components/guides/guides-folder-showcase";

export function ResourceLinks() {
  return (
    <section
      className="mx-auto max-w-6xl px-4 py-12 sm:px-6"
      aria-labelledby="organizer-guides-title"
    >
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-stone-200 pb-6 dark:border-[#1c2721]">
        <div>
          <p className="flex items-center gap-2 text-xs font-bold tracking-widest text-emerald-800 dark:text-emerald-400 uppercase">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
            FOR ORGANIZERS &amp; VOTERS
          </p>
          <h2 id="organizer-guides-title" className="mt-2 text-2xl font-semibold tracking-tight text-stone-900 sm:text-3xl dark:text-white">
            Plan your next vote.
          </h2>
          <p className="mt-1 text-sm text-stone-600 dark:text-stone-300 max-w-xl">
            Interactive playbooks for awards, elections, offline USSD dial-in, and WhatsApp/Telegram voting bots.
          </p>
        </div>
        <Link
          href="/guides"
          className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-emerald-800 shadow-2xs transition hover:border-emerald-600 hover:bg-stone-50 hover:text-emerald-900 dark:border-[#1c2721] dark:bg-[#0c120e] dark:text-emerald-400 dark:hover:border-emerald-500/80 dark:hover:bg-[#141d18]"
        >
          All organizer guides <span>→</span>
        </Link>
      </div>

      <div className="mt-4">
        <GuidesFolderShowcase />
      </div>

      <div className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-stone-200 pt-6 text-sm text-stone-600 dark:border-[#1c2721] dark:text-stone-400">
        <p>
          Considering paid voting?{" "}
          <Link
            href="/pricing"
            className="font-semibold text-emerald-800 underline underline-offset-4 hover:text-emerald-900 dark:text-emerald-400 dark:hover:text-emerald-300"
          >
            Read how pricing works.
          </Link>
        </p>
        <p className="text-xs text-stone-500 dark:text-stone-400">
          Official VoteCastHub GH Documentation
        </p>
      </div>
    </section>
  );
}
