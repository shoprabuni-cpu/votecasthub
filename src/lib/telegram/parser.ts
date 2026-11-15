import { normalizePhone } from "../whatsapp/sendazi";
import type { NormalizedTelegramInbound, TelegramUpdate } from "./types";

export function extractTelegramInbound(update: TelegramUpdate): NormalizedTelegramInbound | null {
  if (!update || typeof update !== "object") return null;

  // 1. Handle Callback Query (Inline Button Click)
  if (update.callback_query) {
    const cb = update.callback_query;
    return {
      chatId: cb.message?.chat.id ?? cb.from.id,
      userId: cb.from.id,
      username: cb.from.username,
      text: cb.data || "",
      isCallback: true,
      callbackQueryId: cb.id,
      messageId: cb.message?.message_id || 0,
      raw: update,
    };
  }

  // 2. Handle Direct Message
  if (update.message) {
    const msg = update.message;
    const text = (msg.text || msg.caption || "").trim();

    return {
      chatId: msg.chat.id,
      userId: msg.from?.id ?? msg.chat.id,
      username: msg.from?.username,
      text,
      isCallback: false,
      contact: msg.contact ? {
        ...msg.contact,
        phone_number: normalizePhone(msg.contact.phone_number),
      } : undefined,
      messageId: msg.message_id,
      raw: update,
    };
  }

  return null;
}
