import { extractTelegramInbound } from "@/lib/telegram/parser";
import { processTelegramVote } from "@/lib/telegram/engine";
import type { TelegramUpdate } from "@/lib/telegram/types";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  const secret = process.env.TELEGRAM_SECRET_TOKEN;
  if (secret) {
    const receivedHeader = request.headers.get("x-telegram-bot-api-secret-token");
    if (receivedHeader !== secret) {
      console.warn("[Telegram Webhook] Unauthorized request received");
      return new Response("Unauthorized", { status: 401 });
    }
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch (err) {
    console.error("[Telegram Webhook] Failed to parse JSON:", err);
    return new Response("Invalid JSON", { status: 400 });
  }

  const inbound = extractTelegramInbound(body as TelegramUpdate);
  if (!inbound) {
    return Response.json({ ok: true, ignored: "unsupported_update" });
  }

  try {
    await processTelegramVote(inbound);
    return Response.json({ ok: true });
  } catch (err) {
    console.error("[Telegram Webhook] Error processing update:", err);
    // Return 200 so Telegram does not get stuck in an endless retry loop
    return Response.json({ ok: true, error: "processing_failed" });
  }
}
