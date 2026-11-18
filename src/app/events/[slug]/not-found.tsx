import Link from "next/link";
import { SiteHeader } from "@/components/site-header";

export default function EventNotFound() {
  return (
    <main className="min-h-screen bg-[var(--paper)] text-[var(--ink)]">
      <SiteHeader />
      <section className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-4 py-16 text-center sm:px-6">
        <span className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-stone-200 bg-stone-100 text-xl text-stone-600 dark:border-[#1c2721] dark:bg-[#0c120e] dark:text-stone-300" aria-hidden="true">◇</span>
        <h1 className="mb-3 font-serif text-3xl sm:text-4xl font-medium tracking-tight text-stone-900 dark:text-white">This page is no longer available.</h1>
        <p className="max-w-md text-sm leading-relaxed text-stone-600 dark:text-stone-300">The organizer may have unpublished or archived the event, or the link may be out of date. No vote or payment was started from this page.</p>
        <Link className="mt-8 inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-900 bg-emerald-900 px-6 py-3 text-sm font-semibold text-white shadow-xs hover:bg-emerald-800 min-h-11 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-emerald-600 dark:hover:bg-emerald-500" href="/events">Explore available events</Link>
      </section>
    </main>
  );
}
