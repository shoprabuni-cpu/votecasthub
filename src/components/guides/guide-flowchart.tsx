type Flow = {
  title: string;
  start: string;
  steps?: string[];
  branches?: Array<{ label: string; steps: string[] }>;
  end: string;
};

export function GuideFlowchart({ flow }: { flow: Flow }) {
  return <section aria-labelledby="guide-flow-title" className="mt-8 rounded-2xl border border-emerald-100 bg-emerald-50/60 p-5 sm:p-6 dark:border-[#173b27] dark:bg-[#06120a]">
    <p className="text-xs font-semibold uppercase tracking-widest text-emerald-800 dark:text-emerald-400">At a glance</p>
    <h2 id="guide-flow-title" className="mt-1 text-xl font-semibold text-stone-900 dark:text-white">{flow.title}</h2>
    <div className="mt-5 rounded-xl border border-emerald-200 bg-white px-4 py-3 text-center font-semibold text-stone-900 shadow-sm dark:border-[#173b27] dark:bg-[#080d0a] dark:text-stone-100">{flow.start}</div>
    <div aria-hidden="true" className="py-2 text-center text-xl font-semibold text-emerald-700 dark:text-emerald-400">↓</div>
    {flow.steps ? <ol className="flex flex-col gap-2 lg:flex-row lg:items-stretch">
      {flow.steps.map((step, index) => <li key={step} className="flex min-w-0 flex-1 flex-col items-center gap-2 lg:flex-row">
        <div className="flex min-h-20 w-full flex-1 items-center gap-3 rounded-xl border border-stone-200 bg-white p-3 shadow-sm dark:border-[#1c2721] dark:bg-[#080b09]"><span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-900 dark:bg-emerald-950 dark:border dark:border-emerald-800/80 dark:text-emerald-300">{index + 1}</span><span className="text-sm font-medium leading-5 text-stone-800 dark:text-stone-200">{step}</span></div>
        {index < flow.steps!.length - 1 && <span aria-hidden="true" className="text-lg font-semibold text-emerald-700 dark:text-emerald-400 lg:px-1">{index === flow.steps!.length - 1 ? "" : <><span className="lg:hidden">↓</span><span className="hidden lg:inline">→</span></>}</span>}
      </li>)}
    </ol> : <div className="grid gap-3 sm:grid-cols-2">
      {flow.branches?.map(branch => <article key={branch.label} className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm dark:border-[#1c2721] dark:bg-[#080b09]">
        <h3 className="text-sm font-semibold text-emerald-900 dark:text-emerald-300">{branch.label}</h3>
        <ol className="mt-3 space-y-2">{branch.steps.map((step, index) => <li key={step} className="flex items-start gap-2 text-sm leading-5 text-stone-700 dark:text-stone-300"><span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-stone-100 text-[11px] font-bold text-stone-700 dark:bg-[#121915] dark:text-stone-300">{index + 1}</span><span>{step}</span></li>)}</ol>
      </article>)}
    </div>}
    <div aria-hidden="true" className="py-2 text-center text-xl font-semibold text-emerald-700 dark:text-emerald-400">↓</div>
    <div className="rounded-xl border border-emerald-700 bg-emerald-800 px-4 py-3 text-center font-semibold text-white dark:border-emerald-600 dark:bg-emerald-700">{flow.end}</div>
  </section>;
}
