import "server-only";
import { paymentAdmin } from "@/lib/payments/admin";
import type { NormalizedInboundMessage } from "./types";

const rabuniWhatsappUrl = process.env.RABUNI_WHATSAPP_WEBHOOK_URL || "https://rabuni.shop/api/webhooks/whatsapp";

export function isVotingKeyword(text: string): boolean {
  const normalized = text.trim().toUpperCase();
  return (
    normalized.startsWith("VOTE") ||
    normalized.startsWith("VCH") ||
    normalized.startsWith("BALLOT")
  );
}

export async function hasActiveVotingSession(phone: string): Promise<boolean> {
  try {
    const db = paymentAdmin();
    const { data, error } = await db
      .from("whatsapp_sessions")
      .select("id, state, expires_at")
      .eq("phone", phone)
      .gt("expires_at", new Date().toISOString())
      .neq("state", "completed")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) return false;
    return true;
  } catch (err) {
    console.error("[WhatsApp Router] Session check error", err);
    return false;
  }
}

export async function forwardToRabuni(rawBody: string, headers: Headers): Promise<{ forwarded: boolean; status?: number; error?: string }> {
  try {
    const target = new URL(rabuniWhatsappUrl);
    if (target.protocol !== "https:" && process.env.NODE_ENV === "production") {
      throw new Error("Rabuni webhook URL must use HTTPS in production");
    }

    const forwardHeaders: Record<string, string> = {
      "content-type": "application/json",
    };

    // Forward any incoming signature or auth headers if present
    const sig = headers.get("x-sendazi-signature") || headers.get("x-hub-signature-256") || headers.get("authorization");
    if (sig) {
      forwardHeaders["x-signature"] = sig;
    }

    const response = await fetch(target, {
      method: "POST",
      headers: forwardHeaders,
      body: rawBody,
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });

    return { forwarded: true, status: response.status };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("[WhatsApp Router] Failed to forward to Rabuni", { error: msg });
    return { forwarded: false, error: msg };
  }
}

export async function routeInboundMessage(
  inbound: NormalizedInboundMessage,
  rawBody: string,
  headers: Headers,
): Promise<"votecasthub" | "rabuni"> {
  if (isVotingKeyword(inbound.text)) {
    return "votecasthub";
  }

  const activeSession = await hasActiveVotingSession(inbound.phone);
  if (activeSession) {
    return "votecasthub";
  }

  // Not a voting keyword and no active session -> Route to Rabuni Shops
  return "rabuni";
}

