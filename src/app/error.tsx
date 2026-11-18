"use client";

import { useEffect } from "react";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Page rendering failed", { digest: error.digest });
  }, [error.digest]);

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center px-4 py-16 text-center sm:px-6">
      <p className="flex items-center gap-2 text-xs font-bold tracking-widest text-emerald-800 uppercase dark:text-emerald-400">PAGE UNAVAILABLE</p>
      <h1 className="mt-4 mb-3 font-serif text-3xl sm:text-4xl lg:text-5xl font-medium tracking-tight text-stone-900 dark:text-white">We couldn’t load this page.</h1>
      <p className="max-w-md text-sm leading-relaxed text-stone-600 dark:text-stone-300">Please try again. Your information has not been submitted.</p>
      <button
        type="button"
        className="mt-8 inline-flex min-h-11 cursor-pointer items-center justify-center rounded-xl bg-emerald-900 px-6 py-3 text-sm font-semibold text-white shadow-xs transition hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500"
        onClick={reset}
      >
        Try again
      </button>
    </main>
  );
}
