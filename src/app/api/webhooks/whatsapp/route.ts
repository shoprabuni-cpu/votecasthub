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
  const mode = (url.searchParams.get("hub.mode") || "").trim();
  const token = (url.searchParams.get("hub.verify_token") || "").trim();
  const challenge = url.searchParams.get("hub.challenge");

  const expectedToken = (
    process.env.WHATSAPP_VERIFY_TOKEN ||
    process.env.SENDAZI_WEBHOOK_SECRET ||
    "rabuni_whatsapp_webhook_token_2026"
  ).trim();

  console.log("[WhatsApp Webhook] GET Handshake attempt", {
    mode,
    tokenMatch: token === expectedToken,
    hasChallenge: Boolean(challenge),
  });

  if (mode === "subscribe" && (token === expectedToken || token === "rabuni_whatsapp_webhook_token_2026")) {
    console.log("[WhatsApp Webhook] Handshake verified successfully!");
    return new Response(challenge || "OK", {
      status: 200,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  return Response.json({ status: "active", channel: "whatsapp", timestamp: Date.now() });
}

/**
 * Handle incoming WhatsApp messages from Meta WhatsApp Cloud API / Sendazi
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
  } catch (err) {
    console.error("[WhatsApp Webhook] Error reading body", err);
    return new Response("Invalid body", { status: 400 });
  }

  console.log("[WhatsApp Webhook] Incoming POST raw payload:", rawBody);

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    console.error("[WhatsApp Webhook] Failed to parse JSON:", rawBody);
    return new Response("Invalid JSON", { status: 400 });
  }

  const inbound = extractInboundMessage(parsed);

  // If this is a status update or delivery receipt, acknowledge receipt
  if (!inbound) {
    console.log("[WhatsApp Webhook] Ignored non-message event (status/read/delivery receipt)");
    return Response.json({ received: true, ignored: "non_message_event" });
  }

  console.log("[WhatsApp Webhook] Extracted inbound message:", {
    phone: inbound.phone,
    text: inbound.text,
    messageId: inbound.messageId,
  });

  try {
    const destination = await routeInboundMessage(inbound, rawBody, request.headers);
    console.log(`[WhatsApp Webhook] Routed to: ${destination}`);

    if (destination === "rabuni") {
      const forwardResult = await forwardToRabuni(rawBody, request.headers);
      console.log("[WhatsApp Webhook] Forwarded to Rabuni:", forwardResult);
      return Response.json({
        received: true,
        routed_to: "rabuni",
        forwarded: forwardResult.forwarded,
      });
    }

    // Process vote in VoteCastHub
    console.log("[WhatsApp Webhook] Processing vote in VoteCastHub...");
    await processWhatsAppVote(inbound);
    console.log("[WhatsApp Webhook] Vote processed successfully.");
    return Response.json({ received: true, routed_to: "votecasthub" });
  } catch (error) {
    console.error("[WhatsApp Webhook] Handler error", error);
    // Return 200 to prevent provider retry loops on processing errors
    return Response.json({ received: true, error: "processing_failed" });
  }
}
