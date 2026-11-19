import "server-only";
import { reconcileUssd } from "@/lib/ussd/reconcile";
import { ussdConfiguration } from "@/lib/ussd/provider";
import { sendWhatsAppMessage, sendWhatsAppImage } from "@/lib/whatsapp/sendazi";
import { sendTelegramMessage, sendTelegramPhoto } from "@/lib/telegram/api";
import { sendTicketConfirmationSms } from "@/lib/sms/send-ticket-sms";
import { z } from "zod";
import { paymentAdmin } from "./admin";
import { paystack, siteUrl } from "./gateway";
import { paystackSecret } from "./paystack";

const txSchema = z.object({
  id: z.number().int().positive().safe(),
  reference: z.string(),
  status: z.string(),
  amount: z.number().int().positive().safe(),
  currency: z.string(),
  domain: z.enum(["live", "test"]),
  fees: z.number().int().nonnegative().safe().nullable(),
  subaccount: z.object({ subaccount_code: z.string().optional() }).nullable().optional(),
  metadata: z.record(z.string(), z.any()).nullable().optional(),
});
type Transaction = z.infer<typeof txSchema>;
async function applyTransaction(t: Transaction, allowReversed = false) {
  if (t.domain !== (paystackSecret().startsWith("sk_live_") ? "live" : "test")) throw new Error("Payment mode mismatch");
  if (t.status !== "success" && !(allowReversed && t.status === "reversed")) return;
  const db = paymentAdmin();
  if (t.reference.startsWith("VCH-VOTE-") || t.reference.startsWith("VCH-USSD-") || t.reference.startsWith("VCH-WA-") || t.reference.startsWith("VCH-TG-")) {
    const { data: p, error } = await db.from("payment_attempts").select("total_amount_minor,currency,subaccount_code,organization_id").eq("provider_reference", t.reference).eq("provider", "paystack").maybeSingle();
    if (error) throw error; if (!p) { if (t.reference.startsWith("VCH-USSD-") || t.reference.startsWith("VCH-WA-") || t.reference.startsWith("VCH-TG-")) throw new Error("Payment attempt not found"); return; }
    let subaccount = p.subaccount_code;
    if (!subaccount) { const { data: a, error: e } = await db.from("organization_paystack_accounts").select("subaccount_code").eq("organization_id", p.organization_id).single(); if (e) throw e; subaccount = a.subaccount_code; }
    if (Number(p.total_amount_minor) !== t.amount || p.currency !== t.currency || t.subaccount?.subaccount_code !== subaccount || t.fees === null) throw new Error("Payment verification mismatch");
    const { error: e } = await db.rpc("confirm_paid_vote", { p_reference: t.reference, p_transaction_id: t.id, p_paid_amount_minor: t.amount, p_provider_fee_minor: t.fees }); if (e) throw e;
    // 1. Dispatch Telegram Receipt if this was a Telegram vote
    try {
      const { data: tgSession } = await db.from("telegram_sessions").select("chat_id,quantity,nominee_id,event_id").eq("reference", t.reference).maybeSingle();
      const tgChatId = tgSession?.chat_id || (t.metadata?.channel === "telegram" ? Number(t.metadata.chat_id) : null);
      const tgNomId = tgSession?.nominee_id || (t.metadata?.channel === "telegram" ? t.metadata.nominee_id : null);
      const tgEvtId = tgSession?.event_id || (t.metadata?.channel === "telegram" ? t.metadata.event_id : null);
      const tgQty = tgSession?.quantity ?? (t.metadata?.quantity ? Number(t.metadata.quantity) : 1);
      if (tgChatId && tgNomId && tgEvtId) {
        const { data: nom } = await db.from("nominees").select("name, image_path").eq("id", tgNomId).maybeSingle();
        const { data: evt } = await db.from("events").select("name").eq("id", tgEvtId).maybeSingle();
        const safeNom = (nom?.name || "your candidate").replace(/[<>&]/g, "");
        const safeEvt = (evt?.name || "Competition").replace(/[<>&]/g, "");
        const receiptHtml = `🎉 <b>Payment Confirmed!</b> 🗳️\n\n<b>${tgQty} vote(s)</b> have been recorded for <b>${safeNom}</b> (${safeEvt}).\nReceipt Ref: <code>${t.reference}</code>.\n\nThank you for voting with VoteCastHub!`;
        let nomPhoto: string | null = null;
        if (nom?.image_path) {
          try {
            const { data: imgData } = await db.storage.from("nominee-images").createSignedUrl(nom.image_path, 86400);
            nomPhoto = imgData?.signedUrl || null;
          } catch { }
        }
        if (nomPhoto) {
          sendTelegramPhoto(tgChatId, nomPhoto, receiptHtml, { parse_mode: "HTML" }).catch(err => console.error("[Telegram] Receipt photo push failed", err));
        } else {
          sendTelegramMessage(tgChatId, receiptHtml, { parse_mode: "HTML" }).catch(err => console.error("[Telegram] Receipt push failed", err));
        }
      }
    } catch (err) { console.error("[Telegram] Receipt lookup error", err); }

    // 2. Dispatch WhatsApp Receipt if this was a WhatsApp vote
    try {
      const { data: waSession } = await db.from("whatsapp_sessions").select("phone,quantity,nominee_id,event_id").eq("reference", t.reference).maybeSingle();
      const waPhone = waSession?.phone || (t.metadata?.channel === "whatsapp" ? String(t.metadata.phone) : null);
      const waNomId = waSession?.nominee_id || (t.metadata?.channel === "whatsapp" ? t.metadata.nominee_id : null);
      const waEvtId = waSession?.event_id || (t.metadata?.channel === "whatsapp" ? t.metadata.event_id : null);
      const waQty = waSession?.quantity ?? (t.metadata?.quantity ? Number(t.metadata.quantity) : 1);
      if (waPhone && waNomId && waEvtId) {
        const { data: nom } = await db.from("nominees").select("name, image_path").eq("id", waNomId).maybeSingle();
        const { data: evt } = await db.from("events").select("name").eq("id", waEvtId).maybeSingle();
        const receiptText = `🎉 *Payment Confirmed!* 🗳️\n\n*${waQty} vote(s)* have been recorded for *${nom?.name || "your nominee"}* (${evt?.name || "Event"}).\nReceipt Ref: *${t.reference}*.\n\nThank you for voting with VoteCastHub!`;
        let nomPhoto: string | null = null;
        if (nom?.image_path) {
          try {
            const { data: imgData } = await db.storage.from("nominee-images").createSignedUrl(nom.image_path, 86400);
            nomPhoto = imgData?.signedUrl || null;
          } catch { }
        }
        if (nomPhoto) {
          sendWhatsAppImage(waPhone, nomPhoto, receiptText).catch(err => console.error("[WhatsApp] Receipt photo push failed", err));
        } else {
          sendWhatsAppMessage(waPhone, receiptText).catch(err => console.error("[WhatsApp] Receipt push failed", err));
        }
      }
    } catch (err) { console.error("[WhatsApp] Receipt lookup error", err); }
  } else if (t.reference.startsWith("VCH-ACCESS-")) {
    if (t.currency !== "GHS") throw new Error("Access currency mismatch");
    const { error: e } = await db.rpc("fulfill_ussd_access", { p_reference: t.reference, p_transaction_id: t.id, p_amount_minor: t.amount }); if (e) throw e;
  } else if (t.reference.startsWith("VCH-SMS-")) {
    const { data: p, error } = await db.from("sms_credit_purchases").select("amount_minor").eq("reference", t.reference).maybeSingle(); if (error) throw error; if (!p) return;
    if (Number(p.amount_minor) !== t.amount || t.currency !== "GHS") throw new Error("SMS payment mismatch");
    const { error: e } = await db.rpc("fulfill_sms_credit_purchase", { p_reference: t.reference, p_transaction_id: t.id }); if (e) throw e;
  } else if (t.reference.startsWith("VCH-TIK-")) {
    const { data: confirmed, error: confirmErr } = await db.rpc("confirm_paid_ticket", {
      p_order_reference: t.reference,
      p_provider_transaction_id: String(t.id),
    });
    if (confirmErr) throw confirmErr;

    const res = confirmed as Record<string, unknown> | null;
    if (res?.success && !res?.already_confirmed && res?.customer_phone && res?.pax_code) {
      const allCodes = Array.isArray(res.pax_codes)
        ? (res.pax_codes as string[])
        : [String(res.pax_code)];

      // Send SMS confirmation
      sendTicketConfirmationSms({
        phone: String(res.customer_phone),
        customerName: String(res.customer_name || "Guest"),
        eventName: String(res.event_name || "Event"),
        tierName: String(res.tier_name || "Ticket"),
        paxCode: allCodes,
        venueName: res.venue_name ? String(res.venue_name) : null,
      }).catch((err) => console.error("[Ticket Reconcile SMS] Error:", err));

      // 1. Dispatch Telegram Ticket Pass if purchased via Telegram
      try {
        const tgChatId = t.metadata?.channel === "telegram" ? Number(t.metadata.chat_id) : null;
        if (tgChatId) {
          const codesList = allCodes.length === 1
            ? `🔑 <b>CODE PAX:</b> <code>#${allCodes[0]}</code>`
            : allCodes.map((c, i) => `🔑 <b>Pass #${i + 1} CODE PAX:</b> <code>#${c}</code>`).join("\n");
          const venueLine = res.venue_name ? `📍 <b>Venue:</b> ${String(res.venue_name).replace(/[<>&]/g, "")}\n` : "";
          const ticketUrl = `${siteUrl()}/tickets?q=${encodeURIComponent(allCodes[0])}`;
          const tgTicketMsg =
            `🎉 <b>Payment Confirmed! Your Tickets Are Ready</b> 🎟️\n\n` +
            `📌 <b>${String(res.event_name || "Event").replace(/[<>&]/g, "")}</b>\n` +
            `👤 <b>Attendee:</b> ${String(res.customer_name || "Guest").replace(/[<>&]/g, "")}\n` +
            `🎫 <b>Tier:</b> ${String(res.tier_name || "Pass").replace(/[<>&]/g, "")} (${res.quantity || 1} Ticket${(Number(res.quantity) || 1) > 1 ? "s" : ""})\n` +
            `${venueLine}\n` +
            `${codesList}\n\n` +
            `🔗 <b>Digital Pass & QR Codes:</b>\n<a href="${ticketUrl}">${ticketUrl}</a>\n\n` +
            `<i>Show your CODE PAX or digital pass at the entrance gate for check-in.</i>`;

          sendTelegramMessage(tgChatId, tgTicketMsg, { parse_mode: "HTML" }).catch((err) =>
            console.error("[Telegram] Ticket push failed:", err)
          );
        }
      } catch (err) {
        console.error("[Telegram] Ticket push lookup error:", err);
      }

      // 2. Dispatch WhatsApp Ticket Pass if purchased via WhatsApp
      try {
        const waPhone = t.metadata?.channel === "whatsapp" ? String(t.metadata.phone || res.customer_phone) : null;
        if (waPhone) {
          const codesList = allCodes.length === 1
            ? `🔑 *CODE PAX:* #${allCodes[0]}`
            : allCodes.map((c, i) => `🔑 *Pass #${i + 1} CODE PAX:* #${c}`).join("\n");
          const venueLine = res.venue_name ? `📍 *Venue:* ${res.venue_name}\n` : "";
          const ticketUrl = `${siteUrl()}/tickets?q=${encodeURIComponent(allCodes[0])}`;
          const waTicketMsg =
            `🎉 *Payment Confirmed! Your Tickets Are Ready* 🎟️\n\n` +
            `📌 *${res.event_name || "Event"}*\n` +
            `👤 *Attendee:* ${res.customer_name || "Guest"}\n` +
            `🎫 *Tier:* ${res.tier_name || "Pass"} (${res.quantity || 1} Ticket${(Number(res.quantity) || 1) > 1 ? "s" : ""})\n` +
            `${venueLine}\n` +
            `${codesList}\n\n` +
            `🔗 *View Digital Pass & QR Codes:*\n👉 ${ticketUrl}\n\n` +
            `_Show your CODE PAX or QR pass at the entrance gate for check-in._`;

          sendWhatsAppMessage(waPhone, waTicketMsg).catch((err) =>
            console.error("[WhatsApp] Ticket push failed:", err)
          );
        }
      } catch (err) {
        console.error("[WhatsApp] Ticket push lookup error:", err);
      }
    }
  }
}
export async function reconcileReference(reference: string, completedJob = false) {
  const tx = txSchema.parse(await paystack(`/transaction/verify/${encodeURIComponent(reference)}`));
  if (tx.reference !== reference) throw new Error("Reference mismatch");
  if (tx.domain !== (paystackSecret().startsWith("sk_live_") ? "live" : "test")) throw new Error("Payment mode mismatch");
  if (tx.status === "failed" && (reference.startsWith("VCH-USSD-") || reference.startsWith("VCH-WA-") || reference.startsWith("VCH-TG-"))) {
    const { error } = await paymentAdmin().from("payment_attempts").update({ status: "failed" }).eq("provider_reference", reference).eq("provider", "paystack").eq("status", "pending");
    if (error) throw error;
    return false;
  }
  if (!["success", "reversed"].includes(tx.status)) return false;
  await applyTransaction(tx, tx.status === "reversed");
  if (tx.status === "reversed") await adjust(reference, `reversed:${tx.id}`, tx.amount, "reversal");
  return tx.status === "success" || completedJob;
}
async function adjust(reference: string, key: string, amount: number, kind: "refund" | "reversal") {
  const db = paymentAdmin();
  // Ignore payments belonging to other products on this Paystack integration.
  if (reference.startsWith("VCH-ACCESS-")) { const { error } = await db.rpc("refund_ussd_access", { p_reference: reference, p_key: key, p_amount: amount }); if (error) throw error; return; }
  const table = (reference.startsWith("VCH-VOTE-") || reference.startsWith("VCH-USSD-") || reference.startsWith("VCH-WA-") || reference.startsWith("VCH-TG-")) ? "payment_attempts" : reference.startsWith("VCH-SMS-") ? "sms_credit_purchases" : null;
  if (!table) return;
  const { data, error } = await db.from(table).select("id").eq(table === "payment_attempts" ? "provider_reference" : "reference", reference).maybeSingle(); if (error) throw error; if (!data) return;
  const { error: e } = await db.rpc("apply_payment_adjustment", { p_reference: reference, p_provider_key: key, p_amount_minor: amount, p_kind: kind }); if (e) throw e;
}
const adjustmentSchema = z.object({ id: z.number().int().positive().safe(), status: z.string(), amount: z.number().int().positive().safe().optional(), refund_amount: z.number().int().positive().safe().nullable().optional(), dispute: z.number().int().positive().nullable().optional(), currency: z.string().nullable().optional(), transaction: z.union([z.number().int().positive().safe(), z.object({ id: z.number().int().positive().safe() })]), resolution: z.string().nullable().optional() });
export async function processPaymentJob(kind: string, resource: string) {
  if (kind === "charge.success" && resource.startsWith("VCH-USSD-")) {
    const { data: attempt, error } = await paymentAdmin().from("payment_attempts").select("provider").eq("provider_reference", resource).maybeSingle(); if (error) throw error;
    if (attempt?.provider === "paystack") {
      if (await reconcileReference(resource, true)) return true;
      const { data: result, error: read } = await paymentAdmin().from("payment_attempts").select("status").eq("provider_reference", resource).eq("provider", "paystack").maybeSingle(); if (read) throw read;
      return result?.status === "failed" || result?.status === "refunded";
    }
    return ussdConfiguration().success ? reconcileUssd(resource) : false;
  }
  if (kind === "charge.success") return reconcileReference(resource, true);
  const isRefund = kind === "refund.processed";
  if (!isRefund && kind !== "charge.dispute.resolve") return true;
  const a = adjustmentSchema.parse(await paystack(`/${isRefund ? "refund" : "dispute"}/${encodeURIComponent(resource)}`));
  if (String(a.id) !== resource) throw new Error("Adjustment identity mismatch");
  if (isRefund ? a.status !== "processed" : a.status !== "resolved" || a.resolution !== "merchant-accepted") return false;
  const amount = a.amount ?? a.refund_amount; if (!amount) throw new Error("Missing adjustment amount");
  const id = typeof a.transaction === "number" ? a.transaction : a.transaction.id;
  const tx = txSchema.parse(await paystack(`/transaction/${id}`));
  if (tx.id !== id || amount > tx.amount || (a.currency && a.currency !== tx.currency)) throw new Error("Adjustment mismatch");
  await applyTransaction(tx, true);
  await adjust(tx.reference, `${isRefund && !a.dispute ? "refund" : "dispute"}:${a.dispute ?? a.id}`, amount, isRefund ? "refund" : "reversal");
}


