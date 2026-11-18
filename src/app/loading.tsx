export default function Loading() {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center px-4 py-16 text-center sm:px-6" aria-live="polite">
      <p className="flex items-center gap-2 text-xs font-bold tracking-widest text-emerald-800 uppercase dark:text-emerald-400">LOADING</p>
      <h1 className="mt-4 mb-3 font-serif text-3xl sm:text-4xl lg:text-5xl font-medium tracking-tight text-stone-900 dark:text-white">One moment.</h1>
      <p className="max-w-md text-sm leading-relaxed text-stone-600 dark:text-stone-300">We’re getting the page ready.</p>
    </main>
  );
}
