import "server-only";
import { paymentAdmin } from "@/lib/payments/admin";

/** Bounded batches commit separately, so retries resume safely after interruption. */
export async function processOrganizerEventDeletions() {
  const db = paymentAdmin();
  const started = Date.now();
  for (let batch = 0; batch < 5 && Date.now() - started < 5000; batch++) {
    const { data, error } = await db.rpc("process_organizer_event_deletions", { p_limit: 2 });
    if (error) throw error;
    const result = data as { completed: number; progressing: number; failed: number };
    if (result.failed) console.error("organizer_event_cleanup_failed");
    if (!result.completed && !result.progressing) break;
  }
}
