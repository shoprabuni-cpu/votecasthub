import { timingSafeEqual } from "node:crypto";
import { processNotificationEmails } from "@/lib/notifications/delivery";

export const runtime = "nodejs";
export const maxDuration = 60;
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const supplied = Buffer.from(request.headers.get("authorization") || "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (!secret || supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return new Response("Unauthorized", { status: 401 });
  try {
    const result = await processNotificationEmails();
    return Response.json(result, { status: !result.configured || result.failed ? 503 : 200 });
  } catch { return Response.json({ error: "Notification processing failed" }, { status: 503 }); }
}
