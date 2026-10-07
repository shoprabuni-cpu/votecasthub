"use client";
import { useEffect, useRef } from "react";
export function EventViewTracker({ eventId }: { eventId: string }) {
  const lastTracked = useRef<string | null>(null);
  useEffect(() => {
    if (lastTracked.current === eventId) return;
    let hash: string | null;
    try {
      const key = `vch-visitor:${eventId}`;
      hash = localStorage.getItem(key);
      if (!hash) { hash = crypto.randomUUID() + crypto.randomUUID(); localStorage.setItem(key, hash); }
    } catch {
      // Do not break the event page or invent new visitors when storage is blocked.
      return;
    }
    lastTracked.current = eventId;
    void fetch("/api/analytics/event-view", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ eventId, visitorHash: hash }), keepalive: true }).catch(() => undefined);
  }, [eventId]);
  return null;
}
