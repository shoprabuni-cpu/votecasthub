import "server-only";

interface SendaziResponse {
  success?: boolean;
  status?: string;
  message?: string;
  error?: string;
  id?: string;
}

export function normalizePhone(rawPhone: string): string {
  const digits = rawPhone.replace(/\D/g, "");
  if (digits.startsWith("233") && digits.length === 12) {
    return digits;
  }
  if (digits.startsWith("0") && digits.length === 10) {
    return `233${digits.slice(1)}`;
  }
  return digits;
}

export async function sendWhatsAppMessage(
  to: string,
  message: string,
): Promise<{ success: boolean; error?: string }> {
  const normalizedTo = normalizePhone(to);

  // 1. Check for Meta WhatsApp Cloud API credentials (same as Rabuni Shops)
  const metaToken = process.env.WHATSAPP_BUSINESS_TOKEN;
  const metaPhoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (metaToken && metaPhoneId) {
    try {
      const response = await fetch(`https://graph.facebook.com/v19.0/${metaPhoneId}/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${metaToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: normalizedTo,
          type: "text",
          text: { body: message, preview_url: false },
        }),
        signal: AbortSignal.timeout(15000),
        cache: "no-store",
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        const errMsg = errData?.error?.message || `Meta API HTTP ${response.status}`;
        console.error("[Meta WhatsApp] Send error", { status: response.status, error: errMsg });
        return { success: false, error: errMsg };
      }

      return { success: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Network error";
      console.error("[Meta WhatsApp] Dispatch failed", { error: msg });
      return { success: false, error: msg };
    }
  }

  // 2. Fallback to Sendazi REST API if configured
  const apiKey = process.env.SENDAZI_API_KEY;
  const baseUrl = (process.env.SENDAZI_API_BASE_URL || "https://api.sendazi.com/v1").replace(/\/+$/, "");
  const senderNumber = normalizePhone(process.env.SENDAZI_PHONE_NUMBER || "233592992566");

  if (!apiKey) {
    console.warn("[WhatsApp] Outbound skipped: neither WHATSAPP_BUSINESS_TOKEN nor SENDAZI_API_KEY is configured.", { to: normalizedTo });
    return { success: false, error: "Neither WHATSAPP_BUSINESS_TOKEN nor SENDAZI_API_KEY is configured" };
  }

  const endpoint = `${baseUrl}/messages`;
  const payload = {
    sender: senderNumber,
    recipient: normalizedTo,
    to: normalizedTo,
    phone: normalizedTo,
    type: "text",
    message,
    text: message,
  };

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "X-API-Key": apiKey,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15000),
      cache: "no-store",
    });

    if (!response.ok) {
      const errBody = await response.text().catch(() => "");
      console.error("[Sendazi] API error response", { status: response.status, body: errBody.slice(0, 300) });
      return { success: false, error: `Sendazi API returned HTTP ${response.status}` };
    }

    const data = (await response.json().catch(() => null)) as SendaziResponse | null;
    const ok = data?.success !== false && data?.status !== "failed" && !data?.error;
    return { success: ok, error: ok ? undefined : data?.error || data?.message || "Unknown error" };
  } catch (err) {
    const messageStr = err instanceof Error ? err.message : "Network error";
    console.error("[Sendazi] Outbound dispatch failed", { error: messageStr });
    return { success: false, error: messageStr };
  }
}

