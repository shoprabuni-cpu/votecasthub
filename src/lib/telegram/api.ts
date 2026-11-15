import "server-only";
import type {
  TelegramInlineKeyboardMarkup,
  TelegramReplyKeyboardMarkup,
  TelegramReplyKeyboardRemove,
} from "./types";

function getTelegramToken(): string {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    throw new Error("TELEGRAM_BOT_TOKEN is not configured");
  }
  return token;
}

export async function sendTelegramMessage(
  chatId: number | string,
  text: string,
  options?: {
    parse_mode?: "HTML" | "Markdown" | "MarkdownV2";
    reply_markup?: TelegramInlineKeyboardMarkup | TelegramReplyKeyboardMarkup | TelegramReplyKeyboardRemove;
    disable_web_page_preview?: boolean;
  },
): Promise<{ success: boolean; error?: string; messageId?: number }> {
  try {
    const token = getTelegramToken();
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: options?.parse_mode ?? "Markdown",
        reply_markup: options?.reply_markup,
        disable_web_page_preview: options?.disable_web_page_preview ?? false,
      }),
      signal: AbortSignal.timeout(15000),
      cache: "no-store",
    });

    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.ok) {
      const err = data?.description || response.statusText || "Telegram API error";
      console.warn("[Telegram API] sendMessage rejected:", { status: response.status, err });
      return { success: false, error: err };
    }

    return { success: true, messageId: data.result?.message_id };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[Telegram API] sendMessage failed:", msg);
    return { success: false, error: msg };
  }
}

export async function sendTelegramPhoto(
  chatId: number | string,
  photoUrl: string,
  caption?: string,
  options?: {
    parse_mode?: "HTML" | "Markdown" | "MarkdownV2";
    reply_markup?: TelegramInlineKeyboardMarkup | TelegramReplyKeyboardMarkup | TelegramReplyKeyboardRemove;
  },
): Promise<{ success: boolean; error?: string; messageId?: number }> {
  try {
    const token = getTelegramToken();
    const response = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        photo: photoUrl,
        caption: caption?.slice(0, 1024),
        parse_mode: options?.parse_mode ?? "Markdown",
        reply_markup: options?.reply_markup,
      }),
      signal: AbortSignal.timeout(15000),
      cache: "no-store",
    });

    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.ok) {
      const err = data?.description || response.statusText || "Telegram photo rejected";
      console.warn("[Telegram API] sendPhoto rejected, falling back to message:", { status: response.status, err });
      if (caption) {
        return sendTelegramMessage(chatId, caption, options);
      }
      return { success: false, error: err };
    }

    return { success: true, messageId: data.result?.message_id };
  } catch (err) {
    console.warn("[Telegram API] sendPhoto error, attempting text fallback:", err);
    if (caption) {
      return sendTelegramMessage(chatId, caption, options);
    }
    return { success: false, error: String(err) };
  }
}

export async function answerTelegramCallbackQuery(
  callbackQueryId: string,
  options?: { text?: string; show_alert?: boolean },
): Promise<{ success: boolean }> {
  try {
    const token = getTelegramToken();
    await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        callback_query_id: callbackQueryId,
        text: options?.text,
        show_alert: options?.show_alert ?? false,
      }),
      signal: AbortSignal.timeout(10000),
      cache: "no-store",
    });
    return { success: true };
  } catch {
    return { success: false };
  }
}

export async function editTelegramMessageText(
  chatId: number | string,
  messageId: number,
  text: string,
  options?: {
    parse_mode?: "HTML" | "Markdown" | "MarkdownV2";
    reply_markup?: TelegramInlineKeyboardMarkup;
    disable_web_page_preview?: boolean;
  },
): Promise<{ success: boolean; error?: string }> {
  try {
    const token = getTelegramToken();
    const response = await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
        text,
        parse_mode: options?.parse_mode ?? "Markdown",
        reply_markup: options?.reply_markup,
        disable_web_page_preview: options?.disable_web_page_preview ?? false,
      }),
      signal: AbortSignal.timeout(15000),
      cache: "no-store",
    });

    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.ok) {
      return { success: false, error: data?.description || response.statusText };
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

export async function setTelegramWebhook(
  webhookUrl: string,
  secretToken?: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const token = getTelegramToken();
    const response = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: webhookUrl,
        secret_token: secretToken,
        allowed_updates: ["message", "callback_query"],
        drop_pending_updates: false,
      }),
      signal: AbortSignal.timeout(15000),
      cache: "no-store",
    });

    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.ok) {
      return { success: false, error: data?.description || response.statusText };
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}
