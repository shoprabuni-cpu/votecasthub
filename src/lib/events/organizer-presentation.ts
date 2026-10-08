import { eventPresentation, type EventTiming } from "./presentation";

export type EventWorkspaceState = { event_id: string; has_activity: boolean; review_feedback: string | null; last_review_kind: string | null };
export function organizerEventPresentation(event: EventTiming & { last_review_kind?: string | null }, now: number) {
  const expired = Date.parse(event.ends_at) <= now;
  const returned = event.status === "draft" && event.last_review_kind === "returned";
  const label = returned ? "Changes requested" : event.status === "draft" ? "Draft" : event.status === "pending_review" ? "Awaiting approval" : eventPresentation(event, now).label;
  const warning = ["draft", "pending_review"].includes(event.status) && expired ? "Voting dates expired—update the dates before resubmitting." : returned ? "Read the review feedback, edit the event, and resubmit." : event.status === "pending_review" ? "Private while awaiting platform approval." : "";
  const action = returned ? "View feedback & edit" : event.status === "draft" ? "Edit event" : event.status === "pending_review" ? "View review status" : "Manage voting & details";
  return { label, warning, action };
}
