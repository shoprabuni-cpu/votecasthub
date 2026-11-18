import Link from "next/link";
import { GuidesFolderShowcase } from "@/components/guides/guides-folder-showcase";

export function ResourceLinks() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6" aria-labelledby="organizer-guides-title">
      <p className="text-xs font-semibold uppercase tracking-widest text-emerald-800 dark:text-emerald-400">For organizers</p>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-4">
        <h2 id="organizer-guides-title" className="text-2xl font-semibold text-stone-900 dark:text-white">Plan your next vote.</h2>
        <Link href="/guides" className="inline-flex min-h-11 items-center text-sm font-semibold text-emerald-800 dark:text-emerald-400 hover:underline">
          All organizer guides →
        </Link>
      </div>

      <div className="mt-6">
        <GuidesFolderShowcase />
      </div>

      <p className="mt-6 text-sm text-stone-600 dark:text-stone-400">
        Considering paid voting?{" "}
        <Link href="/pricing" className="inline-flex min-h-11 items-center font-semibold text-emerald-800 dark:text-emerald-400 underline">
          Read how pricing works.
        </Link>
      </p>
    </section>
  );
}
