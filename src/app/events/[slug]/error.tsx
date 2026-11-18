"use client";
import Link from "next/link";

export default function EventError({ reset }: { reset: () => void }) {
  return (
    <main className="min-h-screen bg-[var(--paper)] text-[var(--ink)]">
      <section className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-4 py-16 text-center sm:px-6">
        <h1 className="mb-3 font-serif text-3xl sm:text-4xl font-medium tracking-tight text-stone-900 dark:text-white">We couldn’t load this event just now.</h1>
        <p className="max-w-md text-sm leading-relaxed text-stone-600 dark:text-stone-300">Please try again in a moment. If you recently paid, check your payment confirmation before making another payment.</p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <button type="button" className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-900 bg-emerald-900 px-5 py-3 text-sm font-semibold text-white shadow-xs hover:bg-emerald-800 min-h-11 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-50" onClick={reset}>Try again</button>
          <Link className="inline-flex items-center justify-center gap-2 rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm font-semibold text-stone-800 shadow-xs hover:bg-stone-100 min-h-11 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#1c2721] dark:bg-[#0c120e] dark:text-stone-200" href="/events">Browse other events</Link>
        </div>
      </section>
    </main>
  );
}
