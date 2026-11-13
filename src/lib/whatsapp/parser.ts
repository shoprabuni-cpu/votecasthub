import { normalizePhone } from "./sendazi";
import type { NormalizedInboundMessage } from "./types";

export function extractInboundMessage(raw: unknown): NormalizedInboundMessage | null {
  if (!raw || typeof raw !== "object") return null;

  const payload = raw as Record<string, unknown>;

  // 1. Sendazi / Direct Webhook format
  if (typeof payload.message === "string" || typeof payload.text === "string" || typeof payload.body === "string") {
    const rawPhone = String(payload.phone || payload.from || payload.sender || payload.msisdn || "");
    const text = String(payload.message || payload.text || payload.body || "").trim();
    if (rawPhone && text) {
      return {
        phone: normalizePhone(rawPhone),
        text,
        messageId: typeof payload.id === "string" ? payload.id : undefined,
        timestamp: typeof payload.timestamp === "number" ? payload.timestamp : Date.now(),
        rawPayload: raw,
      };
    }
  }

  // 2. Nested Sendazi 'data' or 'entry' format
  if (payload.data && typeof payload.data === "object") {
    const data = payload.data as Record<string, unknown>;
    const rawPhone = String(data.phone || data.from || data.sender || data.msisdn || "");
    const text = String(data.message || data.text || data.body || "").trim();
    if (rawPhone && text) {
      return {
        phone: normalizePhone(rawPhone),
        text,
        messageId: typeof data.id === "string" ? data.id : undefined,
        timestamp: typeof data.timestamp === "number" ? data.timestamp : Date.now(),
        rawPayload: raw,
      };
    }
  }

  // 3. Meta WhatsApp Cloud API format: entry -> changes -> value -> messages
  if (Array.isArray(payload.entry) && payload.entry.length > 0) {
    const firstEntry = payload.entry[0] as Record<string, unknown>;
    if (Array.isArray(firstEntry?.changes) && firstEntry.changes.length > 0) {
      const firstChange = firstEntry.changes[0] as Record<string, unknown>;
      const value = firstChange?.value as Record<string, unknown> | undefined;
      if (Array.isArray(value?.messages) && value.messages.length > 0) {
        const msg = value.messages[0] as Record<string, unknown>;
        const rawPhone = String(msg.from || "");
        let text = "";
        if (msg.type === "text" && msg.text && typeof msg.text === "object") {
          text = String((msg.text as Record<string, unknown>).body || "").trim();
        } else if (msg.type === "interactive" && msg.interactive && typeof msg.interactive === "object") {
          const interactive = msg.interactive as Record<string, unknown>;
          if (interactive.button_reply && typeof interactive.button_reply === "object") {
            text = String((interactive.button_reply as Record<string, unknown>).id || (interactive.button_reply as Record<string, unknown>).title || "").trim();
          } else if (interactive.list_reply && typeof interactive.list_reply === "object") {
            text = String((interactive.list_reply as Record<string, unknown>).id || (interactive.list_reply as Record<string, unknown>).title || "").trim();
          }
        } else if (typeof msg.body === "string") {
          text = msg.body.trim();
        }

        if (rawPhone && text) {
          return {
            phone: normalizePhone(rawPhone),
            text,
            messageId: typeof msg.id === "string" ? msg.id : undefined,
            timestamp: typeof msg.timestamp === "string" ? parseInt(msg.timestamp, 10) * 1000 : Date.now(),
            rawPayload: raw,
          };
        }
      }
    }
  }

  return null;
}

