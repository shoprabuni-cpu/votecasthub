import "server-only";
import { normalizeGhanaPhone } from "@/lib/sms/send-ticket-sms";

export type NominationNoticeParams = {
  nomineeName: string;
  nomineePhone: string;
  nomineeEmail?: string | null;
  eventName: string;
  eventSlug: string;
  categoryName: string;
  publicCode: string;
};

/**
 * Dispatches automated SMS (Arkesel) and Email (Resend) to approved nominees.
 * Non-blocking: logs failures gracefully without interrupting database transactions.
 */
export async function sendNominationApprovalNotifications({
  nomineeName,
  nomineePhone,
  nomineeEmail,
  eventName,
  eventSlug,
  categoryName,
  publicCode,
}: NominationNoticeParams): Promise<{ smsSent: boolean; emailSent: boolean }> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://votecasthub.com";
  const votingUrl = `${siteUrl}/events/${eventSlug}`;
  const firstName = nomineeName.split(" ")[0] || nomineeName;

  let smsSent = false;
  let emailSent = false;

  // 1. Send SMS via Arkesel
  try {
    const apiKey = process.env.ARKESEL_API_KEY;
    const senderId = process.env.ARKESEL_SENDER_ID || "VoteCastHub";
    const normalizedPhone = normalizeGhanaPhone(nomineePhone);

    const smsMessage = `VoteCastHub: Congratulations ${firstName}! Your nomination for "${eventName}" (${categoryName}) has been approved! Your official voting code is ${publicCode}. Tell your supporters to vote for you at: ${votingUrl}`;

    if (!apiKey) {
      console.info(`[Nomination SMS Dev Mode] Simulated SMS to ${normalizedPhone}: "${smsMessage}"`);
      smsSent = true;
    } else if (normalizedPhone && normalizedPhone.length >= 9) {
      const response = await fetch("https://sms.arkesel.com/api/v2/sms/send", {
        method: "POST",
        headers: {
          "api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sender: senderId,
          message: smsMessage,
          recipients: [normalizedPhone],
        }),
      });

      if (response.ok) {
        smsSent = true;
      } else {
        const errText = await response.text();
        console.warn("[Nomination SMS] Arkesel SMS send failed:", response.status, errText);
      }
    }
  } catch (err) {
    console.error("[Nomination SMS] Exception dispatching SMS:", err);
  }

  // 2. Send Email via Resend (if email was provided)
  if (nomineeEmail && nomineeEmail.includes("@")) {
    try {
      const resendKey = process.env.RESEND_API_KEY;
      const resendFrom = process.env.RESEND_FROM_EMAIL || "VoteCastHub <info@votecasthub.com>";

      const subject = `🎉 Congratulations! Your nomination for ${eventName} has been approved`;

      const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Nomination Approved - VoteCastHub</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f7f9f7; margin: 0; padding: 24px; color: #1c2721;">
  <div style="max-width: 560px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
    
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #064e3b 0%, #065f46 100%); padding: 32px 24px; text-align: center;">
      <h1 style="color: #ffffff; font-size: 24px; font-weight: 800; margin: 0; letter-spacing: -0.5px;">VoteCastHub</h1>
      <p style="color: #a7f3d0; font-size: 13px; font-weight: 500; margin: 6px 0 0 0; text-transform: uppercase; letter-spacing: 1px;">Nomination Approved</p>
    </div>

    <!-- Body -->
    <div style="padding: 32px 24px;">
      <h2 style="font-size: 20px; font-weight: 700; color: #064e3b; margin: 0 0 12px 0;">Congratulations, ${nomineeName}!</h2>
      <p style="font-size: 14px; line-height: 1.6; color: #4b5563; margin: 0 0 24px 0;">
        Your nomination entry for <strong>${eventName}</strong> has been officially vetted and approved by the event organizing committee.
      </p>

      <!-- Details Card -->
      <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
          <tr>
            <td style="color: #4b5563; padding: 6px 0;"><strong>Category:</strong></td>
            <td style="color: #064e3b; font-weight: 600; text-align: right; padding: 6px 0;">${categoryName}</td>
          </tr>
          <tr>
            <td style="color: #4b5563; padding: 6px 0;"><strong>Official Voting Code:</strong></td>
            <td style="text-align: right; padding: 6px 0;">
              <span style="background-color: #065f46; color: #ffffff; font-family: monospace; font-size: 15px; font-weight: 700; padding: 4px 10px; border-radius: 6px; letter-spacing: 1px;">
                ${publicCode}
              </span>
            </td>
          </tr>
        </table>
      </div>

      <!-- Action Button -->
      <div style="text-align: center; margin: 32px 0;">
        <a href="${votingUrl}" style="background-color: #059669; color: #ffffff; font-size: 15px; font-weight: 700; text-decoration: none; padding: 14px 28px; border-radius: 10px; display: inline-block; box-shadow: 0 2px 4px rgba(5, 150, 105, 0.2);">
          View Official Ballot Page ➔
        </a>
      </div>

      <p style="font-size: 13px; color: #6b7280; line-height: 1.5; margin: 0; text-align: center;">
        Share your unique voting code <strong>${publicCode}</strong> with your family, friends, and fans so they can easily find and vote for you.
      </p>
    </div>

    <!-- Footer -->
    <div style="background-color: #f8fafc; border-top: 1px solid #f1f5f9; padding: 16px 24px; text-align: center;">
      <p style="font-size: 11px; color: #94a3b8; margin: 0;">
        Sent automatically by VoteCastHub · Ghana's Premier Voting & Event Platform
      </p>
    </div>

  </div>
</body>
</html>
      `.trim();

      const textContent = `
Congratulations ${nomineeName}!

Your nomination for "${eventName}" under category "${categoryName}" has been approved!
Your official voting code is: ${publicCode}

View the live event and start gathering votes:
${votingUrl}

Share your code with your supporters!
- VoteCastHub Ghana
      `.trim();

      if (!resendKey) {
        console.info(`[Nomination Email Dev Mode] Simulated Email to ${nomineeEmail}: Subject "${subject}"`);
        emailSent = true;
      } else {
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: resendFrom,
            to: [nomineeEmail],
            subject,
            html: htmlContent,
            text: textContent,
          }),
        });

        if (response.ok) {
          emailSent = true;
        } else {
          const errText = await response.text();
          console.warn("[Nomination Email] Resend HTTP send failed:", response.status, errText);
        }
      }
    } catch (err) {
      console.error("[Nomination Email] Exception dispatching Email:", err);
    }
  }

  return { smsSent, emailSent };
}
