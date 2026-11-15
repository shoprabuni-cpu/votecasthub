import "server-only";
import { randomUUID, createHmac, createHash } from "node:crypto";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { paymentAdmin } from "@/lib/payments/admin";
import { paystack } from "@/lib/payments/gateway";
import { sendWhatsAppMessage, sendWhatsAppInteractiveButtons, sendWhatsAppInteractiveList, sendWhatsAppImage } from "./sendazi";
import type { NormalizedInboundMessage } from "./types";

function getSharedSecret(): string {
  return process.env.SENDAZI_WEBHOOK_SECRET || process.env.ARKESEL_USSD_SHARED_SECRET || "vch-whatsapp-secret-default-seed-32char";
}

function hashPhone(phone: string): string {
  return createHmac("sha256", getSharedSecret()).update(`wa:${phone}`).digest("hex");
}

function getAuthClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://jjgwyvxntzrjugauknzo.supabase.co";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "mock-key";
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function getSignedImageUrl(path: string | null | undefined): Promise<string | undefined> {
  if (!path) return undefined;
  try {
    const db = paymentAdmin();
    const { data } = await db.storage.from("nominee-images").createSignedUrl(path, 86400);
    return data?.signedUrl || undefined;
  } catch {
    return undefined;
  }
}

interface NomineeWithCategory {
  id: string;
  name: string;
  public_code: string | null;
  display_order: number;
  image_path: string | null;
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

    // If active session is awaiting quantity and user sends a number or taps QTY button
    if (activeSession && activeSession.state === "awaiting_quantity" && activeSession.event_id && activeSession.nominee_id && activeSession.category_id) {
      const cleanQty = text.replace(/^(QTY\s*)/i, "").replace(/\D/g, "");
      const qtyParsed = parseInt(cleanQty, 10);
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

    // If active session is awaiting invite code
    if (activeSession && activeSession.state === "awaiting_invite_code" && activeSession.event_id && activeSession.nominee_id && activeSession.category_id) {
      await handleInviteCodeVerification({
        phone,
        phoneHash,
        code: text,
        session: activeSession,
      });
      return;
    }

    // If active session is awaiting voter ID (Student ID, Index Number, Member ID, or Email)
    if (activeSession && activeSession.state === "awaiting_voter_id" && activeSession.event_id && activeSession.nominee_id && activeSession.category_id) {
      await handleVoterIdVerification({
        phone,
        phoneHash,
        identifier: text,
        session: activeSession,
      });
      return;
    }

    // If active session is awaiting claim code / voting PIN
    if (activeSession && activeSession.state === "awaiting_claim_code" && activeSession.event_id && activeSession.nominee_id && activeSession.category_id) {
      await handleClaimCodeVerification({
        phone,
        phoneHash,
        claimCode: text,
        session: activeSession,
      });
      return;
    }

    // If active session is awaiting email OTP
    if (activeSession && activeSession.state === "awaiting_email_otp" && activeSession.event_id && activeSession.nominee_id && activeSession.category_id) {
      await handleEmailOtpVerification({
        phone,
        phoneHash,
        otp: text,
        session: activeSession,
      });
      return;
    }
  }

  // Help / Menu prompt: Present all live competitions
  if (["VOTE", "HELP", "MENU", "VOTEHUB", "VOTECASTHUB", "START", "HI", "HELLO", "EVENTS"].includes(upperText)) {
    const { data: events } = await db
      .from("events")
      .select("id, name, slug, voting_mode, unit_price_minor, image_path, ends_at")
      .eq("status", "published")
      .gt("ends_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(10);

    if (events && events.length > 0) {
      if (events.length <= 3) {
        const buttons = events.map((ev) => ({
          id: `VOTE ${ev.slug}`,
          title: ev.name.slice(0, 20),
        }));

        const firstCover = await getSignedImageUrl(events[0]?.image_path);
        await sendWhatsAppInteractiveButtons(
          phone,
          "🗳️ VoteCastHub Competitions",
          "Welcome to VoteCastHub! 🏆\n\nTap an ongoing competition below to view contestants and vote:",
          buttons,
          "VoteCastHub",
          firstCover,
        );
        return;
      }

      const rows = events.map((ev) => ({
        id: `VOTE ${ev.slug}`,
        title: ev.name.slice(0, 24),
        description: ev.voting_mode === "paid"
          ? `Paid · GH₵${(Number(ev.unit_price_minor) / 100).toFixed(2)}/vote`
          : "Free Voting",
      }));

      await sendWhatsAppInteractiveList(
        phone,
        "🗳️ VoteCastHub Competitions",
        "Welcome to VoteCastHub! 🏆\nTap the button below to browse all active voting events:",
        "Browse Events 🏆",
        [{ title: "Live Competitions", rows }],
        "VoteCastHub",
      );
      return;
    }

    await sendWhatsAppMessage(
      phone,
      "👋 Welcome to *VoteCastHub*! 🗳️\n\nTo vote for your candidate, send:\n*VOTE [Event Code] [Nominee Code]*\n\n_Example:_\n*VOTE 1000 01*",
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
    .select("id, name, slug, voting_mode, unit_price_minor, free_vote_limit_per_phone, verification_method, starts_at, ends_at, status, image_path")
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
    .select("id, name, public_code, display_order, image_path, category_id, categories!inner(id, name, event_id, is_active)")
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
    image_path: n.image_path ? String(n.image_path) : null,
    category_id: String(n.category_id),
    category: {
      id: String((n.categories as Record<string, unknown>).id),
      name: String((n.categories as Record<string, unknown>).name),
      event_id: String((n.categories as Record<string, unknown>).event_id),
    },
  }));

  // If voter specified event but no nominee code, show interactive buttons or list!
  if (!nomineeIdentifier) {
    const priceText = event.voting_mode === "paid"
      ? `💰 Cost: GH₵${(Number(event.unit_price_minor) / 100).toFixed(2)} per vote`
      : "🎟️ Free voting";

    const eventCoverUrl = await getSignedImageUrl(event.image_path);

    // 1. If 1 to 3 nominees: Show Interactive Quick Reply Buttons with Cover Image Header!
    if (nominees.length <= 3) {
      const buttons = nominees.map((n, idx) => {
        const code = n.public_code || String(idx + 1).padStart(2, "0");
        return {
          id: `VOTE ${eventIdentifier} ${code}`,
          title: `${code}: ${n.name}`.slice(0, 20),
        };
      });

      await sendWhatsAppInteractiveButtons(
        phone,
        `🗳️ ${event.name}`.slice(0, 60),
        `Category: ${nominees[0]?.category.name || "Contestants"}\n${priceText}\n\nTap a candidate below to vote:`,
        buttons,
        "VoteCastHub Ballot",
        eventCoverUrl,
      );
      return;
    }

    // 2. If 4 to 10 nominees: Show Interactive Dropdown List
    if (nominees.length <= 10) {
      const rows = nominees.map((n, idx) => {
        const code = n.public_code || String(idx + 1).padStart(2, "0");
        return {
          id: `VOTE ${eventIdentifier} ${code}`,
          title: n.name.slice(0, 24),
          description: `Code: ${code} · ${n.category.name}`.slice(0, 72),
        };
      });

      await sendWhatsAppInteractiveList(
        phone,
        `🗳️ ${event.name}`.slice(0, 60),
        `Category: ${nominees[0]?.category.name || "Contestants"}\n${priceText}\n\nTap the button below to pick your candidate:`,
        "Select Candidate 👤",
        [
          {
            title: "Candidates",
            rows,
          },
        ],
        "VoteCastHub Ballot",
      );
      return;
    }

    // 3. Fallback for > 10 nominees (text list with event cover if available)
    const list = nominees.slice(0, 15).map((n, idx) => {
      const code = n.public_code || String(idx + 1).padStart(2, "0");
      return `• *${code}*: ${n.name} (${n.category.name})`;
    }).join("\n");

    const moreText = nominees.length > 15 ? `\n_...and ${nominees.length - 15} more candidates._` : "";
    const rosterText = `🗳️ *${event.name}*\n${priceText}\n\nTo vote, reply with:\n*VOTE ${eventIdentifier} <CODE>*\n\n*Candidates:*\n${list}${moreText}\n\n_Example:_\n*VOTE ${eventIdentifier} ${nominees[0]?.public_code || "01"}*`;

    if (eventCoverUrl) {
      await sendWhatsAppImage(phone, eventCoverUrl, rosterText);
    } else {
      await sendWhatsAppMessage(phone, rosterText);
    }
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
      phoneHash,
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
      // Prompt for quantity with interactive buttons and nominee photo!
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

      const unitPriceMinor = Math.max(1, Number(event.unit_price_minor) || 100);
      const minVotes = Math.max(1, Math.ceil(100 / unitPriceMinor));
      const priceGhs = (unitPriceMinor / 100).toFixed(2);
      const nomineePhotoUrl = await getSignedImageUrl(matched.image_path);

      const qty1 = minVotes;
      const qty2 = minVotes === 1 ? 5 : minVotes * 2;
      const qty3 = minVotes === 1 ? 10 : minVotes * 5;

      const buttons = [
        { id: `QTY ${qty1}`, title: `${qty1} Vote${qty1 > 1 ? "s" : ""} (GH₵${((qty1 * unitPriceMinor) / 100).toFixed(2)})`.slice(0, 20) },
        { id: `QTY ${qty2}`, title: `${qty2} Votes (GH₵${((qty2 * unitPriceMinor) / 100).toFixed(2)})`.slice(0, 20) },
        { id: `QTY ${qty3}`, title: `${qty3} Votes (GH₵${((qty3 * unitPriceMinor) / 100).toFixed(2)})`.slice(0, 20) },
      ];

      let promptBody = `You selected *${matched.name}* in *${matched.category.name}* (${event.name}).\nPrice: *GH₵${priceGhs} per vote*.`;
      if (minVotes > 1) {
        promptBody += `\n\n*(ℹ️ Mobile Money minimum checkout is GH₵ 1.00 — min package is ${minVotes} votes)*`;
      }
      promptBody += `\n\nHow many votes would you like to cast? Tap a button below or reply with a number:`;

      await sendWhatsAppInteractiveButtons(
        phone,
        `🗳️ ${matched.name}`.slice(0, 60),
        promptBody,
        buttons,
        minVotes > 1 ? `Or reply with ${minVotes}+ (e.g. ${minVotes * 2}, ${minVotes * 5})` : "Or reply with any number (e.g. 20, 50)",
        nomineePhotoUrl,
      );
    }
  }
}

async function resolveWhatsAppVoterUserId(db: any, phone: string): Promise<string | null> {
  const cleanDigits = phone.replace(/\D/g, "");
  const whatsappEmail = `wa_${cleanDigits}@whatsapp.votecasthub.com`;
  const found = await db.rpc("find_ussd_voter", { p_phone: phone });
  let userId = found.data;

  if (!userId) {
    const created = await db.auth.admin.createUser({
      phone,
      phone_confirm: true,
      email: whatsappEmail,
      email_confirm: true,
    });
    if (created.data?.user?.id) {
      userId = created.data.user.id;
    } else {
      const retry = await db.rpc("find_ussd_voter", { p_phone: phone });
      userId = retry.data;
    }
  }

  if (userId) {
    try {
      await db.auth.admin.updateUserById(userId, {
        email: whatsappEmail,
        email_confirm: true,
      });
    } catch {
      try {
        await db.auth.admin.updateUserById(userId, {
          email_confirm: true,
        });
      } catch {
        // ignore
      }
    }
  }

  return userId || null;
}

async function handleFreeVote(params: {
  phone: string;
  phoneHash: string;
  event: { id: string; name: string; free_vote_limit_per_phone: number | null };
  category: { id: string; name: string };
  nominee: { id: string; name: string; image_path?: string | null };
  quantity: number;
}): Promise<void> {
  const db = paymentAdmin();
  const { phone, phoneHash, event, category, nominee, quantity } = params;

  // 1. Resolve or create verified phone user
  const userId = await resolveWhatsAppVoterUserId(db, phone);
  if (!userId) {
    await sendWhatsAppMessage(phone, "❌ Unable to verify voter identity. Please try voting via the website.");
    return;
  }

  // 2. Pre-flight verification check
  const { data: eligibility } = await db.rpc("check_whatsapp_voter_eligibility", {
    p_user: userId,
    p_event: event.id,
    p_phone: phone,
  });

  if (eligibility && eligibility.eligible === false) {
    if (eligibility.reason === "requires_invite_code") {
      await db
        .from("whatsapp_sessions")
        .update({ state: "completed", updated_at: new Date().toISOString() })
        .eq("phone", phone)
        .neq("state", "completed");

      await db.from("whatsapp_sessions").insert({
        phone,
        phone_hash: phoneHash,
        event_id: event.id,
        category_id: category.id,
        nominee_id: nominee.id,
        quantity,
        state: "awaiting_invite_code",
        metadata: {
          event_name: event.name,
          category_name: category.name,
          nominee_name: nominee.name,
          nominee_image_path: nominee.image_path,
        },
        expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      });

      await sendWhatsAppMessage(
        phone,
        `🎟️ *Access Code Required*\n\nVoting for *${nominee.name}* in *${event.name}* is private and requires a 1-time Invite Code from the organizer.\n\nPlease reply with your *Access Code* (e.g. VIP-8492) to cast your vote (or reply *0* to cancel):`,
      );
      return;
    }

    if (eligibility.reason === "requires_identifier") {
      await db
        .from("whatsapp_sessions")
        .update({ state: "completed", updated_at: new Date().toISOString() })
        .eq("phone", phone)
        .neq("state", "completed");

      await db.from("whatsapp_sessions").insert({
        phone,
        phone_hash: phoneHash,
        event_id: event.id,
        category_id: category.id,
        nominee_id: nominee.id,
        quantity,
        state: "awaiting_voter_id",
        metadata: {
          event_name: event.name,
          category_name: category.name,
          nominee_name: nominee.name,
          nominee_image_path: nominee.image_path,
        },
        expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      });

      await sendWhatsAppMessage(
        phone,
        `📋 *Voter Roll Verification*\n\nVoting for *${nominee.name}* in *${event.name}* is restricted to registered members on the official voter roll.\n\nPlease reply with your *Student ID, Index Number, Member ID, or Email* (e.g. 10892341) to verify your eligibility (or reply *0* to cancel):`,
      );
      return;
    }

    if (eligibility.reason === "limit_exhausted") {
      await sendWhatsAppMessage(
        phone,
        `⚠️ You have already used all your allocated votes (${eligibility.max_votes ?? 1}) for this event.`,
      );
      return;
    }
  }

  // 3. Cast verified free vote via Supabase RPC
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

  // Success message with photo if available!
  const nomineePhotoUrl = await getSignedImageUrl(nominee.image_path);
  const successText = `✅ *Vote Cast Successfully!* 🎉\n\nYou voted for *${nominee.name}* in *${category.name}* (${event.name}).\nQuantity: *${quantity} vote(s)*.\n\nThank you for making your voice count!`;

  if (nomineePhotoUrl) {
    await sendWhatsAppImage(phone, nomineePhotoUrl, successText);
  } else {
    await sendWhatsAppMessage(phone, successText);
  }
}

async function handleInviteCodeVerification(params: {
  phone: string;
  phoneHash: string;
  code: string;
  session: {
    id: string;
    event_id: string;
    category_id: string;
    nominee_id: string;
    quantity: number | null;
    metadata?: any;
  };
}): Promise<void> {
  const db = paymentAdmin();
  const { phone, code, session } = params;

  const userId = await resolveWhatsAppVoterUserId(db, phone);
  if (!userId) {
    await sendWhatsAppMessage(phone, "❌ Unable to verify voter identity. Please try voting via the website.");
    return;
  }

  const { data: redeemResult, error: redeemError } = await db.rpc("redeem_whatsapp_access_code", {
    p_user: userId,
    p_event: session.event_id,
    p_code: code.trim(),
  });

  if (redeemError || !redeemResult || redeemResult.success !== true) {
    const errorMsg = redeemResult?.error || "Invalid or expired access code.";
    await sendWhatsAppMessage(
      phone,
      `❌ ${errorMsg}\n\nPlease check your invite code and try again, or reply *0* to cancel:`,
    );
    return;
  }

  await db
    .from("whatsapp_sessions")
    .update({ state: "completed", updated_at: new Date().toISOString() })
    .eq("id", session.id);

  const voteRequest = randomUUID();
  const quantity = session.quantity || 1;
  const { error: voteErr } = await db.rpc("cast_verified_whatsapp_vote", {
    p_user: userId,
    p_event: session.event_id,
    p_category: session.category_id,
    p_nominee: session.nominee_id,
    p_quantity: quantity,
    p_request: voteRequest,
  });

  if (voteErr) {
    const errText = voteErr.message.toLowerCase();
    if (errText.includes("limit")) {
      await sendWhatsAppMessage(phone, "⚠️ You have reached your voting limit for this event.");
    } else {
      await sendWhatsAppMessage(phone, "❌ Your vote could not be recorded after redeeming the code. Please try again.");
    }
    return;
  }

  const nomineeName = session.metadata?.nominee_name || "your candidate";
  const categoryName = session.metadata?.category_name || "the category";
  const eventName = session.metadata?.event_name || "this event";
  const nomineeImagePath = session.metadata?.nominee_image_path;

  const successText = `🎟️ *Invite Code Verified!* ✅\n\nYour vote has been recorded for *${nomineeName}* in *${categoryName}* (${eventName}).\nQuantity: *${quantity} vote(s)*.\n\nThank you for making your voice count!`;

  const nomineePhotoUrl = await getSignedImageUrl(nomineeImagePath);
  if (nomineePhotoUrl) {
    await sendWhatsAppImage(phone, nomineePhotoUrl, successText);
  } else {
    await sendWhatsAppMessage(phone, successText);
  }
}

async function handleVoterIdVerification(params: {
  phone: string;
  phoneHash: string;
  identifier: string;
  session: {
    id: string;
    event_id: string;
    category_id: string;
    nominee_id: string;
    quantity: number | null;
    metadata?: any;
  };
}): Promise<void> {
  const db = paymentAdmin();
  const { phone, identifier, session } = params;

  const userId = await resolveWhatsAppVoterUserId(db, phone);
  if (!userId) {
    await sendWhatsAppMessage(phone, "❌ Unable to verify voter identity. Please try voting via the website.");
    return;
  }

  // Check if voter provided an email address
  const isEmail = z.string().email().safeParse(identifier.trim()).success;
  if (isEmail) {
    const cleanEmail = identifier.trim().toLowerCase();
    const emailHash = createHash("sha256").update(cleanEmail).digest("hex");

    const { data: rosterEntry } = await db
      .from("event_voter_list_entries")
      .select("id, label, redeemed_by")
      .eq("event_id", session.event_id)
      .eq("identifier_type", "email")
      .eq("identifier_hash", emailHash)
      .maybeSingle();

    if (!rosterEntry) {
      await sendWhatsAppMessage(
        phone,
        `❌ The email *${cleanEmail}* was not found on the approved voter roll for this event. Please check the spelling or enter your Student/Staff ID (or reply *0* to cancel):`,
      );
      return;
    }

    if (rosterEntry.redeemed_by && rosterEntry.redeemed_by !== userId) {
      await sendWhatsAppMessage(
        phone,
        `❌ The email *${cleanEmail}* has already been used to vote in this election.`,
      );
      return;
    }

    try {
      const authClient = getAuthClient();
      await authClient.auth.signInWithOtp({
        email: cleanEmail,
        options: { shouldCreateUser: true },
      });
    } catch {
      // ignore
    }

    const updatedMeta = {
      ...(session.metadata || {}),
      pending_email: cleanEmail,
      voter_label: rosterEntry.label || cleanEmail,
    };
    await db
      .from("whatsapp_sessions")
      .update({
        state: "awaiting_email_otp",
        metadata: updatedMeta,
        updated_at: new Date().toISOString(),
      })
      .eq("id", session.id);

    await sendWhatsAppMessage(
      phone,
      `✉️ *Verification Code Sent!*\n\nWe sent a 6-digit verification code to *${cleanEmail}*.\n\nPlease check your email inbox and reply with the *6-digit code* here to cast your vote (or reply *0* to cancel):`,
    );
    return;
  }

  // Call redeem_whatsapp_voter_id without claim_code first
  const { data: redeemResult, error: redeemError } = await db.rpc("redeem_whatsapp_voter_id", {
    p_user: userId,
    p_event: session.event_id,
    p_identifier: identifier.trim(),
    p_claim_code: null,
  });

  if (redeemError || !redeemResult) {
    await sendWhatsAppMessage(
      phone,
      "❌ Roster verification is temporarily unavailable. Please try again later or reply *0* to cancel.",
    );
    return;
  }

  if (redeemResult.requires_claim_code === true) {
    const updatedMeta = {
      ...(session.metadata || {}),
      voter_identifier: identifier.trim(),
      voter_label: redeemResult.label || identifier.trim(),
    };
    await db
      .from("whatsapp_sessions")
      .update({
        state: "awaiting_claim_code",
        metadata: updatedMeta,
        updated_at: new Date().toISOString(),
      })
      .eq("id", session.id);

    await sendWhatsAppMessage(
      phone,
      `🔐 *Voting PIN Required*\n\nIdentity confirmed for *${redeemResult.label || identifier.trim()}*.\n\nPlease reply with your *4-digit Voting PIN or Claim Code* (found on your voter card or slip):`,
    );
    return;
  }

  if (redeemResult.success !== true) {
    const errorMsg = redeemResult.error || "Identifier not found on the approved voter roll.";
    await sendWhatsAppMessage(
      phone,
      `❌ ${errorMsg}\n\nPlease check your Student ID / Member ID and try again, or reply *0* to cancel:`,
    );
    return;
  }

  await db
    .from("whatsapp_sessions")
    .update({ state: "completed", updated_at: new Date().toISOString() })
    .eq("id", session.id);

  const voteRequest = randomUUID();
  const quantity = session.quantity || 1;
  const { error: voteErr } = await db.rpc("cast_verified_whatsapp_vote", {
    p_user: userId,
    p_event: session.event_id,
    p_category: session.category_id,
    p_nominee: session.nominee_id,
    p_quantity: quantity,
    p_request: voteRequest,
  });

  if (voteErr) {
    const errText = voteErr.message.toLowerCase();
    if (errText.includes("limit") || errText.includes("exhausted")) {
      await sendWhatsAppMessage(phone, "⚠️ Your approved voter-list vote limit is exhausted.");
    } else {
      await sendWhatsAppMessage(phone, "❌ Your vote could not be recorded after verifying your voter ID. Please contact the organizer.");
    }
    return;
  }

  const nomineeName = session.metadata?.nominee_name || "your candidate";
  const categoryName = session.metadata?.category_name || "the category";
  const eventName = session.metadata?.event_name || "this event";
  const voterLabel = redeemResult.label || identifier.trim();
  const nomineeImagePath = session.metadata?.nominee_image_path;

  const successText = `📋 *Voter Identity Verified!* ✅\n\nIdentity *${voterLabel}* confirmed on the official roll.\nYour vote has been recorded for *${nomineeName}* in *${categoryName}* (${eventName}).\nQuantity: *${quantity} vote(s)*.\n\nThank you for casting your verified ballot!`;

  const nomineePhotoUrl = await getSignedImageUrl(nomineeImagePath);
  if (nomineePhotoUrl) {
    await sendWhatsAppImage(phone, nomineePhotoUrl, successText);
  } else {
    await sendWhatsAppMessage(phone, successText);
  }
}

async function handleClaimCodeVerification(params: {
  phone: string;
  phoneHash: string;
  claimCode: string;
  session: {
    id: string;
    event_id: string;
    category_id: string;
    nominee_id: string;
    quantity: number | null;
    metadata?: any;
  };
}): Promise<void> {
  const db = paymentAdmin();
  const { phone, claimCode, session } = params;

  const userId = await resolveWhatsAppVoterUserId(db, phone);
  if (!userId) {
    await sendWhatsAppMessage(phone, "❌ Unable to verify voter identity. Please try voting via the website.");
    return;
  }

  const voterIdentifier = session.metadata?.voter_identifier;
  if (!voterIdentifier) {
    await sendWhatsAppMessage(phone, "❌ Session error. Please reply with VOTE to start over.");
    return;
  }

  const { data: redeemResult, error: redeemError } = await db.rpc("redeem_whatsapp_voter_id", {
    p_user: userId,
    p_event: session.event_id,
    p_identifier: voterIdentifier,
    p_claim_code: claimCode.trim(),
  });

  if (redeemError || !redeemResult || redeemResult.success !== true) {
    const errorMsg = redeemResult?.error || "Incorrect voting PIN / claim code.";
    await sendWhatsAppMessage(
      phone,
      `❌ ${errorMsg}\n\nPlease check your PIN and try again, or reply *0* to cancel:`,
    );
    return;
  }

  await db
    .from("whatsapp_sessions")
    .update({ state: "completed", updated_at: new Date().toISOString() })
    .eq("id", session.id);

  const voteRequest = randomUUID();
  const quantity = session.quantity || 1;
  const { error: voteErr } = await db.rpc("cast_verified_whatsapp_vote", {
    p_user: userId,
    p_event: session.event_id,
    p_category: session.category_id,
    p_nominee: session.nominee_id,
    p_quantity: quantity,
    p_request: voteRequest,
  });

  if (voteErr) {
    const errText = voteErr.message.toLowerCase();
    if (errText.includes("limit") || errText.includes("exhausted")) {
      await sendWhatsAppMessage(phone, "⚠️ Your approved voter-list vote limit is exhausted.");
    } else {
      await sendWhatsAppMessage(phone, "❌ Your vote could not be recorded after verifying your voting PIN. Please try again.");
    }
    return;
  }

  const nomineeName = session.metadata?.nominee_name || "your candidate";
  const categoryName = session.metadata?.category_name || "the category";
  const eventName = session.metadata?.event_name || "this event";
  const voterLabel = redeemResult.label || voterIdentifier;
  const nomineeImagePath = session.metadata?.nominee_image_path;

  const successText = `🔐 *Voter PIN Confirmed!* ✅\n\nIdentity *${voterLabel}* verified on the official roll.\nYour vote has been recorded for *${nomineeName}* in *${categoryName}* (${eventName}).\nQuantity: *${quantity} vote(s)*.\n\nThank you for making your voice count!`;

  const nomineePhotoUrl = await getSignedImageUrl(nomineeImagePath);
  if (nomineePhotoUrl) {
    await sendWhatsAppImage(phone, nomineePhotoUrl, successText);
  } else {
    await sendWhatsAppMessage(phone, successText);
  }
}

async function handleEmailOtpVerification(params: {
  phone: string;
  phoneHash: string;
  otp: string;
  session: {
    id: string;
    event_id: string;
    category_id: string;
    nominee_id: string;
    quantity: number | null;
    metadata?: any;
  };
}): Promise<void> {
  const db = paymentAdmin();
  const { phone, otp, session } = params;

  const cleanOtp = otp.trim().replace(/\D/g, "");
  if (cleanOtp.length < 6 || cleanOtp.length > 8) {
    await sendWhatsAppMessage(
      phone,
      "Please enter the 6-digit verification code sent to your email (or reply *0* to cancel):",
    );
    return;
  }

  const pendingEmail = session.metadata?.pending_email;
  if (!pendingEmail) {
    await sendWhatsAppMessage(phone, "❌ Session error. Please reply with VOTE to start over.");
    return;
  }

  const userId = await resolveWhatsAppVoterUserId(db, phone);
  if (!userId) {
    await sendWhatsAppMessage(phone, "❌ Unable to verify voter identity. Please try voting via the website.");
    return;
  }

  const authClient = getAuthClient();
  const { error: verifyError } = await authClient.auth.verifyOtp({
    email: pendingEmail,
    token: cleanOtp,
    type: "email",
  });

  if (verifyError) {
    await sendWhatsAppMessage(
      phone,
      "❌ That code is invalid or has expired. Please check your email and try again, or reply *0* to cancel:",
    );
    return;
  }

  try {
    await db.auth.admin.updateUserById(userId, {
      email: pendingEmail,
      email_confirm: true,
    });
  } catch {
    // ignore
  }

  await db.rpc("redeem_whatsapp_voter_id", {
    p_user: userId,
    p_event: session.event_id,
    p_identifier: pendingEmail,
    p_claim_code: null,
  });

  await db
    .from("whatsapp_sessions")
    .update({ state: "completed", updated_at: new Date().toISOString() })
    .eq("id", session.id);

  const voteRequest = randomUUID();
  const quantity = session.quantity || 1;
  const { error: voteErr } = await db.rpc("cast_verified_whatsapp_vote", {
    p_user: userId,
    p_event: session.event_id,
    p_category: session.category_id,
    p_nominee: session.nominee_id,
    p_quantity: quantity,
    p_request: voteRequest,
  });

  if (voteErr) {
    const errText = voteErr.message.toLowerCase();
    if (errText.includes("limit") || errText.includes("exhausted")) {
      await sendWhatsAppMessage(phone, "⚠️ Your voting quota has been exhausted for this event.");
    } else {
      await sendWhatsAppMessage(phone, "❌ Your vote could not be recorded after verifying your email. Please contact the organizer.");
    }
    return;
  }

  const nomineeName = session.metadata?.nominee_name || "your candidate";
  const categoryName = session.metadata?.category_name || "the category";
  const eventName = session.metadata?.event_name || "this event";
  const voterLabel = session.metadata?.voter_label || pendingEmail;
  const nomineeImagePath = session.metadata?.nominee_image_path;

  const successText = `🎓 *Email Verified & Vote Recorded!* ✅\n\nIdentity *${voterLabel}* confirmed on the official roll.\nYour vote has been recorded for *${nomineeName}* in *${categoryName}* (${eventName}).\nQuantity: *${quantity} vote(s)*.\n\nThank you for casting your verified ballot!`;

  const nomineePhotoUrl = await getSignedImageUrl(nomineeImagePath);
  if (nomineePhotoUrl) {
    await sendWhatsAppImage(phone, nomineePhotoUrl, successText);
  } else {
    await sendWhatsAppMessage(phone, successText);
  }
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

  // Fetch event, nominee and category details for display
  const { data: event } = await db.from("events").select("id, name, unit_price_minor, image_path").eq("id", eventId).single();
  const { data: nominee } = await db.from("nominees").select("id, name, image_path").eq("id", nomineeId).single();
  const { data: category } = await db.from("categories").select("id, name").eq("id", categoryId).single();

  if (!event || !nominee) {
    await sendWhatsAppMessage(phone, "❌ Selection unavailable. Please send VOTE to start over.");
    return;
  }

  // Enforce Mobile Money / Paystack GH₵ 1.00 minimum transaction threshold
  const unitPriceMinor = Math.max(1, Number(event.unit_price_minor) || 100);
  const minVotes = Math.max(1, Math.ceil(100 / unitPriceMinor));
  if (quantity < minVotes) {
    const minGhs = ((minVotes * unitPriceMinor) / 100).toFixed(2);
    await sendWhatsAppMessage(
      phone,
      `⚠️ *Minimum Mobile Money Checkout is GH₵ 1.00*\n\nTelco networks and Paystack require a minimum checkout of GH₵ 1.00.\nAt GH₵ ${(unitPriceMinor / 100).toFixed(2)} per vote, the minimum purchase is *${minVotes} votes (GH₵ ${minGhs})*.\n\nPlease reply with *${minVotes}* or more to continue:`,
    );
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

  // 4. Send payment link back to voter with candidate image
  const nomineePhotoUrl = await getSignedImageUrl(nominee.image_path);
  const checkoutMsg = `🗳️ *Confirm Your Vote for ${nominee.name}*\n• Event: *${event.name}*\n• Category: *${category?.name || "Contestant"}*\n• Quantity: *${quantity} vote(s)*\n• Total: *GH₵${totalGhs}*\n\n💳 *Tap to Pay with Mobile Money (MTN, Telecel, AT) or Card:*\n👉 ${authUrl}\n\n_Your votes will be confirmed automatically once payment is approved._`;

  if (nomineePhotoUrl) {
    await sendWhatsAppImage(phone, nomineePhotoUrl, checkoutMsg);
  } else {
    await sendWhatsAppMessage(phone, checkoutMsg);
  }
}

