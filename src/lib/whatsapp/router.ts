import "server-only";
import { paymentAdmin } from "@/lib/payments/admin";
import type { NormalizedInboundMessage } from "./types";

const rabuniWhatsappUrl = process.env.RABUNI_WHATSAPP_WEBHOOK_URL || "https://rabuni.shop/api/webhooks/whatsapp";

export function isVotingKeyword(text: string): boolean {
  const clean = text.trim();
  const normalized = clean.toUpperCase();

  // 1. Direct voting command prefixes or interactive button IDs
  if (
    normalized.startsWith("VOTE") ||
    normalized.startsWith("VCH") ||
    normalized.startsWith("BALLOT") ||
    normalized.startsWith("CAT") ||
    normalized.startsWith("CATEGORY") ||
    normalized.startsWith("MENU_VOTE")
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

export function isTicketingKeyword(text: string): boolean {
  const clean = text.trim();
  const normalized = clean.toUpperCase();

  // 1. Interactive button IDs and menu callbacks from VoteCastHub
  if (
    normalized.startsWith("MENU_") ||
    normalized.startsWith("TIER_") ||
    normalized.startsWith("EVT_") ||
    normalized.startsWith("TICKET_") ||
    normalized.startsWith("PASS_")
  ) {
    return true;
  }

  // 2. Direct ticket or pass keywords
  if (
    /\b(TICKET|TICKETS|PASS|PASSES|GATE|USHER|ADMISSION|SEAT|SEATS)\b/i.test(clean) ||
    /^(BUY\s+TICKETS?|GET\s+TICKETS?|MY\s+TICKETS?|MY\s+PASS(ES)?)\b/i.test(clean) ||
    /[🎟️🎫]/.test(clean)
  ) {
    return true;
  }

  // 3. PAX code queries (e.g. "PAX-1042", "#PAX-1042")
  if (/^#?PAX-?[A-Z0-9]+$/i.test(clean)) {
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
  const clean = inbound.text.trim();
  const normalized = clean.toUpperCase();

  // 1. Ticketing commands, ticket purchases, or interactive buttons -> VoteCastHub
  // (CRITICAL: Must evaluate before Rabuni shopping check so "BUY TICKETS" or "MENU_TICKETS" is never hijacked by Rabuni)
  if (isTicketingKeyword(clean)) {
    return "votecasthub";
  }

  // 2. Voting keywords, codes or interactive buttons -> VoteCastHub
  if (isVotingKeyword(clean)) {
    return "votecasthub";
  }

  // 3. Ongoing voting / ticketing session in progress -> VoteCastHub
  const activeSession = await hasActiveVotingSession(inbound.phone);
  if (activeSession) {
    return "votecasthub";
  }

  // 4. Numerical selections for main menu ("1" = Vote, "2" = Buy Tickets, "3" = My Tickets)
  if (["1", "2", "3"].includes(normalized)) {
    return "votecasthub";
  }

  // 5. General greetings or menu commands (e.g. "Hi", "Hello", "Start", "Menu") -> VoteCastHub
  if (
    normalized.startsWith("MENU") ||
    /^(HI|HELLO|HEY|YO|WASSUP|START|MENU|EVENTS|HELP|GREETINGS|GOOD\s+(MORNING|AFTERNOON|EVENING))\b/i.test(normalized)
  ) {
    return "votecasthub";
  }

  // 6. Explicit e-commerce shopping terms for Rabuni Shops
  // (Only if not a ticket or ballot interaction)
  const isShopping = /\b(ORDER|BUY|PURCHASE|PRODUCT|PRODUCTS|STORE|SHOP|SHOPS|CART|RABUNI|DELIVERY|SHIPPING|INVENTORY|CATALOG|BAG|DRESS|SHOE|PRICE|HOW\s+MUCH|LOCATED|LOCATION)\b/i.test(
    normalized,
  );
  if (isShopping) {
    return "rabuni";
  }

  // Fallback for everything else -> Rabuni
  return "rabuni";
}

