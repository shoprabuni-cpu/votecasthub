import type { EventTiming } from "./presentation";

export function eventEditPermissions({ event, role, active, hasActivity, now }: {
  event: EventTiming; role: string; active: boolean; hasActivity: boolean | null; now: number;
}) {
  const manage = active && ["owner", "admin", "editor"].includes(role);
  const ownerOrAdmin = manage && ["owner", "admin"].includes(role);
  const publicEvent = ["published", "paused", "closed"].includes(event.status);
  const expired = Date.parse(event.ends_at) <= now;
  const locked = event.status === "closed" || Date.parse(event.starts_at) <= now || hasActivity !== false;
  return {
    manage, ownerOrAdmin, expired,
    editDraft: manage && event.status === "draft",
    editPublic: manage && publicEvent,
    editCover: manage && ["draft", "published", "paused", "closed"].includes(event.status),
    returnToDraft: manage && hasActivity === false && (event.status === "pending_review" || (ownerOrAdmin && ["published", "paused"].includes(event.status))),
    editStart: manage && publicEvent && !locked,
    editRules: manage && publicEvent && !locked,
    editDescription: manage && ["published", "paused"].includes(event.status),
    extend: manage && ["published", "paused"].includes(event.status) && !expired,
    reopen: ownerOrAdmin && ["published", "paused"].includes(event.status) && expired,
    pause: manage && event.status === "published" && !expired,
    resume: manage && event.status === "paused" && !expired,
    requestCorrection: manage && publicEvent,
  };
}

export type EventEditPermissions = ReturnType<typeof eventEditPermissions>;
