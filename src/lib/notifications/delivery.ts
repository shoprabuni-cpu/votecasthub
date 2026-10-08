import "server-only";
import { after } from "next/server";
import { paymentAdmin } from "@/lib/payments/admin";

type Job = { id: string; lease_id: string; recipient: string; subject: string; body: string; path: string; attempts: number; payload: Record<string, unknown> | null; delivery_uncertain: boolean };

export function scheduleNotificationDelivery() {
  after(async () => { await processNotificationEmails().catch(() => console.error("notification_email_worker_failed")); });
}

export async function processNotificationEmails() {
  const key = process.env.RESEND_API_KEY;
  const sender = process.env.RESEND_FROM_EMAIL;
  const site = process.env.NEXT_PUBLIC_SITE_URL;
  if (!key || !sender || !site) return { configured: false, sent: 0, failed: 0 };
  const origin = new URL(site);
  if (origin.protocol !== "https:" && process.env.NODE_ENV === "production") throw new Error("Notification site URL must use HTTPS");
  const db = paymentAdmin();
  const { data, error } = await db.rpc("claim_notification_emails", { p_limit: 5 });
  if (error) throw error;
  let sent = 0, failed = 0;
  for (const job of (data || []) as Job[]) {
    let permanent = false, uncertain = false;
    try {
      const payload = job.payload || { from: sender, to: [job.recipient], subject: job.subject, text: `${job.body}\n\n${new URL(job.path, origin).href}` };
      // Persist the exact request before sending so retries remain identical.
      if (!job.payload) {
        const saved = await db.from("notification_email_jobs").update({ payload }).eq("id", job.id).eq("lease_id", job.lease_id).select("id");
        if (saved.error || !saved.data?.length) throw new Error("Unable to persist email payload");
      }
      uncertain = true;
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "Idempotency-Key": `notification/${job.id}` },
        body: JSON.stringify(payload), signal: AbortSignal.timeout(6000),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) uncertain = job.delivery_uncertain;
      if (!response.ok || typeof result?.id !== "string") {
        permanent = response.status >= 400 && response.status < 500 && ![408,409,429].includes(response.status);
        throw new Error(`Resend HTTP ${response.status}`);
      }
      const updated = await db.from("notification_email_jobs").update({ status: "sent", provider_id: result.id, sent_at: new Date().toISOString(), lease_id: null, lease_until: null, last_error: null }).eq("id", job.id).eq("lease_id", job.lease_id);
      if (updated.error) throw new Error("Email accepted; unable to save delivery status");
      sent++;
    } catch (error) {
      failed++;
      const message = error instanceof Error ? error.message : "Email delivery failed";
      const updated = await db.from("notification_email_jobs").update({ status: permanent || job.attempts >= 8 ? "failed" : "pending", delivery_uncertain: uncertain, last_error: message, lease_id: null, lease_until: null, next_attempt_at: new Date(Date.now() + Math.min(3600000, 60000 * 2 ** job.attempts)).toISOString() }).eq("id", job.id).eq("lease_id", job.lease_id);
      if (updated.error) console.error("notification_email_retry_update_failed", { id: job.id });
      console.error("notification_email_delivery_failed", { id: job.id, attempts: job.attempts });
    }
  }
  // Keep provider receipts for 30 days, then remove them to bound storage usage.
  const cleanup = await db.from("notification_email_jobs").delete().in("status", ["sent", "cancelled"]).lt("created_at", new Date(Date.now() - 30 * 86400000).toISOString());
  if (cleanup.error) console.error("notification_email_cleanup_failed");
  return { configured: true, sent, failed };
}
