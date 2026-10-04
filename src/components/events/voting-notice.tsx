import { eventPresentation, type EventTiming } from "@/lib/events/presentation";
export function VotingNotice({ event, resultsVisibility }: { event: EventTiming; resultsVisibility?: string }) {
  const state = eventPresentation(event);
  const results = resultsVisibility === "live" || (resultsVisibility === "after_close" && state.key === "closed")
    ? "Available results are shown with the nominees below."
    : resultsVisibility === "after_close" ? "Results will be available after voting closes." : "Results are not publicly displayed for this event.";
  return <aside className={`voting-notice voting-notice-${state.key}`} role="status"><span className="voting-notice-mark" aria-hidden="true">{state.key === "open" ? "✦" : state.key === "closed" ? "✓" : "◷"}</span><div><strong>{state.title}</strong><p>{state.message}</p>{resultsVisibility && <small>{results}</small>}</div></aside>;
}
