import "server-only";
import { randomUUID, createHmac } from "node:crypto";
import { z } from "zod";
import { paymentAdmin } from "@/lib/payments/admin";
import { paystack } from "@/lib/payments/gateway";
import { sendWhatsAppMessage } from "./sendazi";
import type { NormalizedInboundMessage } from "./types";

function getSharedSecret(): string {
  return process.env.SENDAZI_WEBHOOK_SECRET || process.env.ARKESEL_USSD_SHARED_SECRET || "vch-whatsapp-secret-default-seed-32char";
}

function hashPhone(phone: string): string {
  return createHmac("sha256", getSharedSecret()).update(`wa:${phone}`).digest("hex");
}

interface NomineeWithCategory {
  id: string;
  name: string;
  public_code: string | null;
  display_order: number;
  category_id: string;
  category: {
    id: string;
    name: string;
    event_id: string;
  };
}

export async function processWhatsAppVote(inbound: NormalizedInboundMessage): Promise<void> {
  const db = paymentAdmin();
  const phone = inbound.phone;
  const phoneHash = hashPhone(phone);
  const text = inbound.text.trim();
  const upperText = text.toUpperCase();

  // Cancel / Exit
  if (["0", "EXIT", "CANCEL", "STOP"].includes(upperText)) {
    await db
      .from("whatsapp_sessions")
      .update({ state: "completed", updated_at: new Date().toISOString() })
      .eq("phone", phone);
    await sendWhatsAppMessage(phone, "Vote session cancelled. You can type VOTE anytime to start a new vote.");
    return;
  }

  const isExplicitVoteCommand = /^(VOTE|VCH|BALLOT)\b/i.test(text);

  // If not an explicit new command, check for an active ongoing conversational session
  if (!isExplicitVoteCommand) {
    const { data: activeSession } = await db
      .from("whatsapp_sessions")
      .select("*")
      .eq("phone", phone)
      .gt("expires_at", new Date().toISOString())
      .neq("state", "completed")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // If active session is awaiting quantity and user sends a number
    if (activeSession && activeSession.state === "awaiting_quantity" && activeSession.event_id && activeSession.nominee_id && activeSession.category_id) {
      const qtyParsed = parseInt(text.replace(/\D/g, ""), 10);
      if (!qtyParsed || qtyParsed < 1 || qtyParsed > 10000) {
        await sendWhatsAppMessage(phone, "Please enter a valid number of votes between 1 and 10,000 (or reply 0 to cancel):");
        return;
      }

      await handlePaidVoteCheckout({
        phone,
        phoneHash,
        eventId: activeSession.event_id,
        categoryId: activeSession.category_id,
        nomineeId: activeSession.nominee_id,
        quantity: qtyParsed,
        existingSessionId: activeSession.id,
      });
      return;
    }
  }

  // Help / Menu prompt
  if (["VOTE", "HELP", "MENU", "VOTEHUB", "VOTECASTHUB"].includes(upperText)) {
    await sendWhatsAppMessage(
      phone,
      "👋 Welcome to *VoteCastHub*! 🗳️\n\nTo vote for your candidate, send:\n*VOTE [Event Code] [Nominee Code]*\n\n_Example:_\n*VOTE 1000 01*\n\n(You can find the Event Code and Nominee Code on the campaign flyer or candidate webpage).",
    );
    return;
  }

  // Parse command syntax: VOTE [EVENT_CODE] [NOMINEE_CODE] [OPTIONAL_QUANTITY]
  const cleaned = text.replace(/^(VOTE|VCH|BALLOT)\s+/i, "");
  const parts = cleaned.split(/\s+/).filter(Boolean);

  if (parts.length === 0) {
    await sendWhatsAppMessage(
      phone,
      "⚠️ Incomplete voting command.\nPlease use the format:\n*VOTE [Event Code] [Nominee Code]*\n\n_Example:_\n*VOTE 1000 01*",
    );
    return;
  }

  const eventIdentifier = parts[0];
  const nomineeIdentifier = parts[1];
  const quantityInput = parts[2] ? parseInt(parts[2].replace(/\D/g, ""), 10) : undefined;

  // Resolve Event
  let eventId: string | null = null;

  // 1. Check numeric event_code from event_ussd_requests
  if (/^\d+$/.test(eventIdentifier)) {
    const { data: ussdReq } = await db
      .from("event_ussd_requests")
      .select("event_id")
      .eq("event_code", parseInt(eventIdentifier, 10))
      .maybeSingle();
    if (ussdReq?.event_id) {
      eventId = ussdReq.event_id;
    }
  }

  // 2. Check event slug or ID
  if (!eventId) {
    const { data: eventBySlug } = await db
      .from("events")
      .select("id")
      .or(`slug.eq.${eventIdentifier.toLowerCase()},id.eq.${eventIdentifier.length === 36 ? eventIdentifier : '00000000-0000-0000-0000-000000000000'}`)
      .maybeSingle();
    if (eventBySlug?.id) {
      eventId = eventBySlug.id;
    }
  }

  if (!eventId) {
    await sendWhatsAppMessage(
      phone,
      `❌ Event code *${eventIdentifier}* was not found.\nPlease double check the event flyer and try again.`,
    );
    return;
  }

  // Load event details
  const { data: event, error: eventErr } = await db
    .from("events")
    .select("id, name, slug, voting_mode, unit_price_minor, free_vote_limit_per_phone, verification_method, starts_at, ends_at, status")
    .eq("id", eventId)
    .single();

  if (eventErr || !event) {
    await sendWhatsAppMessage(phone, "❌ Event details unavailable. Please try again later.");
    return;
  }

  const now = new Date();
  if (event.status !== "published" || now < new Date(event.starts_at) || now >= new Date(event.ends_at)) {
    await sendWhatsAppMessage(phone, `⏳ Voting for *${event.name}* is currently closed.`);
    return;
  }

  // Find nominee in event
  const { data: rawNominees, error: nomErr } = await db
    .from("nominees")
    .select("id, name, public_code, display_order, category_id, categories!inner(id, name, event_id, is_active)")
    .eq("categories.event_id", event.id)
    .eq("is_active", true)
    .order("display_order");

  if (nomErr || !rawNominees || rawNominees.length === 0) {
    await sendWhatsAppMessage(phone, "❌ No active nominees found for this event.");
    return;
  }

  const nominees: NomineeWithCategory[] = rawNominees.map((n: Record<string, unknown>) => ({
    id: String(n.id),
    name: String(n.name),
    public_code: n.public_code ? String(n.public_code) : null,
    display_order: Number(n.display_order ?? 0),
    category_id: String(n.category_id),
    category: {
      id: String((n.categories as Record<string, unknown>).id),
      name: String((n.categories as Record<string, unknown>).name),
      event_id: String((n.categories as Record<string, unknown>).event_id),
    },
  }));

  // If voter specified event but no nominee code, show candidates menu
  if (!nomineeIdentifier) {
    const list = nominees.slice(0, 15).map((n, idx) => {
      const code = n.public_code || String(idx + 1).padStart(2, "0");
      return `• *${code}*: ${n.name} (${n.category.name})`;
    }).join("\n");

    const priceText = event.voting_mode === "paid"
      ? `\n💰 Cost: GH₵${(Number(event.unit_price_minor) / 100).toFixed(2)} per vote`
      : "\n🎟️ Free voting";

    const moreText = nominees.length > 15 ? `\n_...and ${nominees.length - 15} more candidates._` : "";

    await sendWhatsAppMessage(
      phone,
      `🗳️ *${event.name}*${priceText}\n\nTo vote, reply with:\n*VOTE ${eventIdentifier} <CODE>*\n\n*Candidates:*\n${list}${moreText}\n\n_Example:_\n*VOTE ${eventIdentifier} ${nominees[0]?.public_code || "01"}*`,
    );
    return;
  }

  const matched = nominees.find((n) => {
    const rawNomCode = (n.public_code || "").trim().toUpperCase();
    const targetCode = nomineeIdentifier.trim().toUpperCase();
    if (rawNomCode && rawNomCode === targetCode) return true;

    // Numerical equality (e.g. "01" == "1", "02" == "2")
    const targetNum = parseInt(targetCode, 10);
    const nomCodeNum = parseInt(rawNomCode, 10);
    if (!isNaN(targetNum) && !isNaN(nomCodeNum) && targetNum === nomCodeNum) return true;

    // Display order fallback (1-based, with or without leading zero)
    const orderNum = n.display_order + 1;
    if (!isNaN(targetNum) && targetNum === orderNum) return true;
    if (String(orderNum).padStart(2, "0") === targetCode) return true;
    if (String(orderNum) === targetCode) return true;

    // Name or UUID prefix fallback
    if (n.name.toLowerCase() === nomineeIdentifier.toLowerCase()) return true;
    if (n.id.toLowerCase().startsWith(nomineeIdentifier.toLowerCase())) return true;
    return false;
  });

  if (!matched) {
    await sendWhatsAppMessage(
      phone,
      `❌ Nominee code *${nomineeIdentifier}* was not found in *${event.name}*.\nPlease check the flyer for the correct code.`,
    );
    return;
  }

  // Route based on voting mode: Free vs Paid
  if (event.voting_mode === "free") {
    await handleFreeVote({
      phone,
      event,
      category: matched.category,
      nominee: matched,
      quantity: quantityInput || 1,
    });
  } else {
    // Paid voting
    if (quantityInput && quantityInput >= 1 && quantityInput <= 10000) {
      await handlePaidVoteCheckout({
        phone,
        phoneHash,
        eventId: event.id,
        categoryId: matched.category_id,
        nomineeId: matched.id,
        quantity: quantityInput,
      });
    } else {
      // Prompt for quantity and record state
      const voteRequest = randomUUID();
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

      await db.from("whatsapp_sessions").insert({
        phone,
        phone_hash: phoneHash,
        event_id: event.id,
        category_id: matched.category_id,
        nominee_id: matched.id,
        state: "awaiting_quantity",
        vote_request: voteRequest,
        expires_at: expiresAt,
      });

      const priceGhs = (event.unit_price_minor / 100).toFixed(2);
      await sendWhatsAppMessage(
        phone,
        `You are voting for *${matched.name}* in *${matched.category.name}* (${event.name}).\nPrice: *GH₵${priceGhs} per vote*.\n\nHow many votes would you like to cast? Reply with a number (e.g. 5, 10, 50, 100):`,
      );
    }
  }
}

async function handleFreeVote(params: {
  phone: string;
  event: { id: string; name: string; free_vote_limit_per_phone: number | null };
  category: { id: string; name: string };
  nominee: { id: string; name: string };
  quantity: number;
}): Promise<void> {
  const db = paymentAdmin();
  const { phone, event, category, nominee, quantity } = params;

  // 1. Resolve or create verified phone user
  const found = await db.rpc("find_ussd_voter", { p_phone: phone });
  let userId = found.data;

  if (!userId) {
    const created = await db.auth.admin.createUser({ phone, phone_confirm: true });
    if (created.data?.user?.id) {
      userId = created.data.user.id;
    } else {
      const retry = await db.rpc("find_ussd_voter", { p_phone: phone });
      userId = retry.data;
    }
  }

  if (!userId) {
    await sendWhatsAppMessage(phone, "❌ Unable to verify voter identity. Please try voting via the website.");
    return;
  }

  // 2. Cast verified free vote via Supabase RPC
  const voteRequest = randomUUID();
  const { error: voteErr } = await db.rpc("cast_verified_whatsapp_vote", {
    p_user: userId,
    p_event: event.id,
    p_category: category.id,
    p_nominee: nominee.id,
    p_quantity: quantity,
    p_request: voteRequest,
  });

  if (voteErr) {
    const errText = voteErr.message.toLowerCase();
    if (errText.includes("limit")) {
      await sendWhatsAppMessage(
        phone,
        `⚠️ You have already reached your free vote limit for *${category.name}*. Each voter is allowed ${event.free_vote_limit_per_phone ?? 1} free vote(s).`,
      );
    } else if (errText.includes("open") || errText.includes("closed")) {
      await sendWhatsAppMessage(phone, "⏳ Voting has ended for this event. Your vote was not recorded.");
    } else {
      await sendWhatsAppMessage(phone, "❌ Your vote could not be recorded. Please check event rules or try later.");
    }
    return;
  }

  // Success message
  await sendWhatsAppMessage(
    phone,
    `✅ *Vote Cast Successfully!* 🎉\n\nYou voted for *${nominee.name}* in *${category.name}* (${event.name}).\nQuantity: *${quantity} vote(s)*.\n\nThank you for making your voice count!`,
  );
}

async function handlePaidVoteCheckout(params: {
  phone: string;
  phoneHash: string;
  eventId: string;
  categoryId: string;
  nomineeId: string;
  quantity: number;
  existingSessionId?: string;
}): Promise<void> {
  const db = paymentAdmin();
  const { phone, phoneHash, eventId, categoryId, nomineeId, quantity, existingSessionId } = params;

  // Fetch event and nominee details for display
  const { data: event } = await db.from("events").select("id, name, unit_price_minor").eq("id", eventId).single();
  const { data: nominee } = await db.from("nominees").select("id, name").eq("id", nomineeId).single();

  if (!event || !nominee) {
    await sendWhatsAppMessage(phone, "❌ Selection unavailable. Please send VOTE to start over.");
    return;
  }

  const voteRequest = randomUUID();

  // 1. Reserve Paystack attempt in database
  const { data: attempt, error: reserveErr } = await db.rpc("reserve_paystack_whatsapp_payment", {
    p_phone: phone,
    p_event: eventId,
    p_category: categoryId,
    p_nominee: nomineeId,
    p_quantity: quantity,
    p_vote_request: voteRequest,
  });

  if (reserveErr || !attempt) {
    console.error("[WhatsApp] Reserve payment error", reserveErr);
    await sendWhatsAppMessage(
      phone,
      "❌ Unable to initiate payment checkout. The organizer's payout account may need verification.",
    );
    return;
  }

  // 2. Initialize Paystack checkout session
  const totalAmountMinor = Number(attempt.total_amount_minor);
  const totalGhs = (totalAmountMinor / 100).toFixed(2);
  const subaccount = attempt.subaccount_code;

  let authUrl = "";
  try {
    const paystackRes = await paystack<{ authorization_url: string }>("/transaction/initialize", {
      reference: attempt.provider_reference,
      amount: totalAmountMinor,
      currency: "GHS",
      email: `${phone}@votecasthub.com`,
      subaccount,
      bearer: "account",
      transaction_charge: Math.floor(totalAmountMinor / 10),
      channels: ["mobile_money", "card"],
      metadata: {
        channel: "whatsapp",
        phone,
        event_id: eventId,
        nominee_id: nomineeId,
        quantity,
      },
    });

    const parsedUrl = new URL(paystackRes.authorization_url);
    if (parsedUrl.protocol !== "https:" || parsedUrl.hostname !== "checkout.paystack.com") {
      throw new Error("Invalid checkout domain returned by Paystack");
    }
    authUrl = parsedUrl.href;
  } catch (err) {
    console.error("[WhatsApp] Paystack initialize failed", err);
    await sendWhatsAppMessage(
      phone,
      "❌ Payment gateway is temporarily unavailable. Please try again in a few moments.",
    );
    return;
  }

  // 3. Update session
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  if (existingSessionId) {
    await db
      .from("whatsapp_sessions")
      .update({
        state: "awaiting_payment",
        quantity,
        reference: attempt.provider_reference,
        payment_url: authUrl,
        expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existingSessionId);
  } else {
    await db.from("whatsapp_sessions").insert({
      phone,
      phone_hash: phoneHash,
      event_id: eventId,
      category_id: categoryId,
      nominee_id: nomineeId,
      quantity,
      state: "awaiting_payment",
      vote_request: voteRequest,
      reference: attempt.provider_reference,
      payment_url: authUrl,
      expires_at: expiresAt,
    });
  }

  // 4. Send payment link back to voter
  await sendWhatsAppMessage(
    phone,
    `🗳️ *Confirm Your Vote for ${nominee.name}*\n• Event: *${event.name}*\n• Quantity: *${quantity} vote(s)*\n• Total: *GH₵${totalGhs}*\n\nTap the secure link to pay with Mobile Money (MTN, Telecel, AT) or Card:\n👉 ${authUrl}\n\n_Your votes will be confirmed automatically once payment is approved._`,
  );
}

