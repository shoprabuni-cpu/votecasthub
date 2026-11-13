import { extractInboundMessage } from "@/lib/whatsapp/parser";
import { routeInboundMessage, forwardToRabuni } from "@/lib/whatsapp/router";
import { processWhatsAppVote } from "@/lib/whatsapp/engine";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Handle GET requests for webhook registration / verification handshakes
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  const expectedToken = process.env.SENDAZI_WEBHOOK_SECRET || process.env.WHATSAPP_VERIFY_TOKEN;

  if (mode === "subscribe" && token && expectedToken && token === expectedToken) {
    return new Response(challenge || "OK", { status: 200 });
  }

  return Response.json({ status: "active", channel: "whatsapp", timestamp: Date.now() });
}

/**
 * Handle incoming WhatsApp messages from Sendazi / WhatsApp Cloud API
 */
export async function POST(request: Request) {
  let rawBody: string;
  try {
    const reader = request.body?.getReader();
    if (!reader) throw new Error("Missing request body");
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > 262144) {
          await reader.cancel();
          throw new Error("Payload too large");
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
    rawBody = Buffer.concat(chunks).toString("utf8");
  } catch {
    return new Response("Invalid body", { status: 400 });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const inbound = extractInboundMessage(parsed);

  // If this is a status update or delivery receipt, acknowledge receipt
  if (!inbound) {
    return Response.json({ received: true, ignored: "non_message_event" });
  }

  try {
    const destination = await routeInboundMessage(inbound, rawBody, request.headers);

    if (destination === "rabuni") {
      const forwardResult = await forwardToRabuni(rawBody, request.headers);
      return Response.json({
        received: true,
        routed_to: "rabuni",
        forwarded: forwardResult.forwarded,
      });
    }

    // Process vote in VoteCastHub
    await processWhatsAppVote(inbound);
    return Response.json({ received: true, routed_to: "votecasthub" });
  } catch (error) {
    console.error("[WhatsApp Webhook] Handler error", error);
    // Return 200 to prevent provider retry loops on processing errors
    return Response.json({ received: true, error: "processing_failed" });
  }
}

