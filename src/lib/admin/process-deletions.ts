import "server-only";
import { paymentAdmin } from "@/lib/payments/admin";

export async function processAdminDeletions() {
  const db = paymentAdmin();
  const started = Date.now();
  const totals = { completed: 0, failed: 0 };
  const { error: cleanupError } = await db.rpc("cleanup_expired_operational_data");
  if (cleanupError) throw cleanupError;
  // Each RPC commits one bounded batch, so retries resume after committed progress.
  for (let batch = 0; batch < 10 && Date.now() - started < 15000; batch++) {
    const { data, error } = await db.rpc("process_admin_deletions", { p_limit: 2 });
    if (error) throw error;
    const result = data as { completed: number; failed: number; progressing: number };
    totals.completed += result.completed;
    totals.failed += result.failed;
    if (!result.completed && !result.progressing) break;
  }
  return totals;
}
