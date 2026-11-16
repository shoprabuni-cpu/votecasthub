import "server-only";
import { paymentAdmin } from "@/lib/payments/admin";
import type { NormalizedInboundMessage } from "./types";

const rabuniWhatsappUrl = process.env.RABUNI_WHATSAPP_WEBHOOK_URL || "https://rabuni.shop/api/webhooks/whatsapp";

export function isVotingKeyword(text: string): boolean {
  const clean = text.trim();
  const normalized = clean.toUpperCase();

  // 1. Direct voting command prefixes
  if (
    normalized.startsWith("VOTE") ||
    normalized.startsWith("VCH") ||
    normalized.startsWith("BALLOT") ||
    normalized.startsWith("CAT") ||
    normalized.startsWith("CATEGORY")
  ) {
    return true;
  }

  // 2. Contains voting or competition keywords or emojis
  if (
    /\b(VOTE|VOTING|VOTES|BALLOT|NOMINEE|CANDIDATE|CONTESTANT|CONTEST|COMPETITION|ELECTION|POLL|AWARDS|AWARD|PAGEANT)\b/i.test(
      clean,
    ) ||
    /[🗳🏆🥇🥈🥉]/.test(clean)
  ) {
    return true;
  }

  // 3. Numeric USSD-style event codes (e.g. "1000", "1000 01")
  if (/^\d{3,6}(\s+\w+)?$/.test(clean)) {
    return true;
  }

  return false;
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
  const normalized = inbound.text.trim().toUpperCase();

  // 1. Explicit e-commerce shopping terms for Rabuni Shops
  const isShopping = /\b(ORDER|BUY|PURCHASE|PRODUCT|PRODUCTS|STORE|SHOP|SHOPS|CART|RABUNI|DELIVERY|SHIPPING|INVENTORY|CATALOG|BAG|DRESS|SHOE|PRICE|HOW\s+MUCH|LOCATED|LOCATION)\b/i.test(
    normalized,
  );
  if (isShopping) {
    return "rabuni";
  }

  // 2. Voting keywords or event codes -> VoteCastHub
  if (isVotingKeyword(inbound.text)) {
    return "votecasthub";
  }

  // 3. Ongoing voting session -> VoteCastHub
  const activeSession = await hasActiveVotingSession(inbound.phone);
  if (activeSession) {
    return "votecasthub";
  }

  // 4. General greetings (e.g. "Hi", "Hello", "Start", "Menu") -> VoteCastHub
  if (/^(HI|HELLO|HEY|YO|WASSUP|START|MENU|EVENTS|HELP|GREETINGS|GOOD\s+(MORNING|AFTERNOON|EVENING))\b/i.test(normalized)) {
    return "votecasthub";
  }

  // Fallback for everything else -> Rabuni
  return "rabuni";
}

