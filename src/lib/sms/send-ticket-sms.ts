import "server-only";

type TicketSmsParams = {
  phone: string;
  customerName: string;
  eventName: string;
  tierName: string;
  paxCode: string | string[];
  venueName?: string | null;
};

/**
 * Normalizes a Ghanaian phone number to 233XXXXXXXXX format
 */
export function normalizeGhanaPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("233") && digits.length === 12) {
    return digits;
  }
  if (digits.startsWith("0") && digits.length === 10) {
    return `233${digits.slice(1)}`;
  }
  return digits;
}

/**
 * Dispatches an instant confirmation SMS with the CODE PAX to the attendee
 */
export async function sendTicketConfirmationSms({
  phone,
  customerName,
  eventName,
  tierName,
  paxCode,
  venueName,
}: TicketSmsParams): Promise<{ success: boolean; error?: string }> {
  const apiKey = process.env.ARKESEL_API_KEY;
  const senderId = process.env.ARKESEL_SENDER_ID || "VoteCastHub";

  const normalizedPhone = normalizeGhanaPhone(phone);
  if (!normalizedPhone || normalizedPhone.length < 9) {
    return { success: false, error: "Invalid phone number." };
  }

  // Construct concise, high-impact SMS
  const shortEvent = eventName.length > 28 ? `${eventName.slice(0, 26)}…` : eventName;
  const firstName = customerName.split(" ")[0] || "Valued Guest";
  const venuePart = venueName ? ` Venue: ${venueName.length > 20 ? venueName.slice(0, 18) + "…" : venueName}.` : "";

  const codesArray = Array.isArray(paxCode) ? paxCode : [paxCode];
  const codesText = codesArray.length === 1
    ? `CODE: #${codesArray[0]}`
    : `${codesArray.length} Passes (${codesArray.map(c => '#' + c).join(', ')})`;

  const message = `VoteCastHub: Hi ${firstName}, your ${tierName} ticket for ${shortEvent} is confirmed! ${codesText}.${venuePart} Show at gate.`;

  if (!apiKey) {
    console.info(`[Ticket SMS Dev Mode] Simulated SMS to ${normalizedPhone}: "${message}"`);
    return { success: true };
  }

  try {
    const response = await fetch("https://sms.arkesel.com/api/v2/sms/send", {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sender: senderId,
        message,
        recipients: [normalizedPhone],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.warn("[Ticket SMS] Arkesel SMS send failed:", response.status, errText);
      return { success: false, error: `Arkesel returned status ${response.status}` };
    }

    return { success: true };
  } catch (err) {
    console.error("[Ticket SMS] Network error dispatching SMS:", err);
    return { success: false, error: err instanceof Error ? err.message : "SMS dispatch error" };
  }
}
