import { eventPresentation, type EventTiming } from "@/lib/events/presentation";

export function VotingNotice({
  event,
  resultsVisibility,
  resultsReleased = false,
}: {
  event: EventTiming;
  resultsVisibility?: string;
  resultsReleased?: boolean;
}) {
  const state = eventPresentation(event);
  const results =
    resultsVisibility === "live" || (resultsVisibility === "after_close" && (state.key === "closed" || resultsReleased))
      ? "Available results are shown with the nominees below."
      : resultsVisibility === "after_close"
      ? "Results will be available after voting closes."
      : "Results are not publicly displayed for this event.";

  return (
    <aside
      className={`flex items-start gap-4 my-6 p-5 rounded-2xl border text-left ${
        state.key === "open"
          ? "border-emerald-200 bg-emerald-50/60 dark:border-emerald-900/40 dark:bg-emerald-950/20"
          : state.key === "closed"
          ? "border-stone-200 bg-stone-100/70 dark:border-[#1c2721] dark:bg-[#0c120e]"
          : "border-amber-200 bg-amber-50/60 dark:border-amber-900/40 dark:bg-amber-950/20"
      }`}
      role="status"
    >
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-base font-bold ${
          state.key === "open"
            ? "bg-emerald-200/80 text-emerald-900 dark:bg-emerald-900/60 dark:text-emerald-300"
            : state.key === "closed"
            ? "bg-stone-200 text-stone-700 dark:bg-stone-800 dark:text-stone-300"
            : "bg-amber-200/80 text-amber-900 dark:bg-amber-900/60 dark:text-amber-300"
        }`}
        aria-hidden="true"
      >
        {state.key === "open" ? "✦" : state.key === "closed" ? "✓" : "◷"}
      </span>
      <div>
        <strong className="block font-serif text-lg font-medium text-stone-900 dark:text-white">{state.title}</strong>
        <p className="mt-1 text-xs leading-relaxed text-stone-600 dark:text-stone-300">{state.message}</p>
        {resultsVisibility && <small className="block mt-1 text-[11px] text-stone-500 dark:text-stone-400">{results}</small>}
      </div>
    </aside>
  );
}
