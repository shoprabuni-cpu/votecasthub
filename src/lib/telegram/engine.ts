import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { paymentAdmin } from "@/lib/payments/admin";
import { paystack, siteUrl } from "@/lib/payments/gateway";
import { normalizeGhanaPhone, sendTicketConfirmationSms } from "@/lib/sms/send-ticket-sms";
import { createClient } from "@supabase/supabase-js";
import {
  answerTelegramCallbackQuery,
  sendTelegramMessage,
  sendTelegramPhoto,
} from "./api";
import { loadPublicAwardsDirectory, loadEventPublicResults } from "@/lib/events/results";
import type { NormalizedTelegramInbound } from "./types";

function getAuthClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://jjgwyvxntzrjugauknzo.supabase.co";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "mock-key";
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

type NomineeWithCategory = {
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
};

async function getSignedImageUrl(path?: string | null): Promise<string | null> {
  if (!path) return null;
  try {
    const db = paymentAdmin();
    const { data } = await db.storage.from("nominee-images").createSignedUrl(path, 3600);
    return data?.signedUrl || null;
  } catch {
    return null;
  }
}

async function resolveTelegramVoterUserId(db: any, phone: string): Promise<string | null> {
  const cleanDigits = phone.replace(/\D/g, "");
  const telegramEmail = `tg_${cleanDigits}@telegram.votecasthub.com`;
  const found = await db.rpc("find_ussd_voter", { p_phone: phone });
  let userId = found.data;

  if (!userId) {
    const created = await db.auth.admin.createUser({
      phone,
      phone_confirm: true,
      email: telegramEmail,
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
        email: telegramEmail,
        email_confirm: true,
      });
    } catch {
      // ignore
    }
  }

  return userId || null;
}

export async function processTelegramVote(inbound: NormalizedTelegramInbound): Promise<void> {
  const db = paymentAdmin();
  const { chatId, userId, username, text, isCallback, callbackQueryId, contact } = inbound;

  // Acknowledge callback immediately to clear the Telegram loading spinner
  if (isCallback && callbackQueryId) {
    await answerTelegramCallbackQuery(callbackQueryId);
  }

  const rawCleanText = text.trim();
  const upper = rawCleanText.toUpperCase();

  // 1. Universal Cancel / Reset
  if (["0", "/CANCEL", "CANCEL", "RESET", "/RESET"].includes(upper)) {
    await db
      .from("telegram_sessions")
      .delete()
      .eq("chat_id", chatId)
      .neq("state", "completed");

    await sendTelegramMessage(
      chatId,
      "👋 Session reset. Send /events or /start to browse ongoing competitions.",
      { reply_markup: { remove_keyboard: true } },
    );
    return;
  }

  // 2. Navigation Commands: /start, /events, /menu, /help (always prioritized regardless of prior session state)
  if (upper.startsWith("/START")) {
    const startParam = text.replace(/^\/start\s*/i, "").trim();

    if (startParam.startsWith("event_")) {
      const eventSlug = startParam.replace(/^event_/, "");
      await presentEventBallot({ chatId, eventIdentifier: eventSlug });
      return;
    }

    if (startParam.startsWith("vote_")) {
      const parts = startParam.replace(/^vote_/, "").split("_");
      const eventSlug = parts[0];
      const nomineeCode = parts[1];
      await presentEventBallot({ chatId, eventIdentifier: eventSlug, nomineeIdentifier: nomineeCode });
      return;
    }

    await presentCompetitionsList(chatId);
    return;
  }

  if (["/EVENTS", "EVENTS", "VOTE", "MENU", "HELP", "/HELP"].includes(upper)) {
    await presentCompetitionsList(chatId);
    return;
  }

  if (["/RESULTS", "RESULTS", "/AWARDS", "AWARDS", "/STANDINGS", "LEADERBOARD"].includes(upper)) {
    await presentTelegramResultsList(chatId);
    return;
  }

  if (upper.startsWith("/RESULTS ") || upper.startsWith("RESULTS ") || upper.startsWith("/AWARDS ") || upper.startsWith("AWARDS ")) {
    const eventParam = text.replace(/^\/?(results?|awards?|standings?)\s+/i, "").trim();
    await presentTelegramEventResults(chatId, eventParam);
    return;
  }

  if (["/TICKETS", "TICKETS", "/TICKET", "TICKET"].includes(upper)) {
    await presentTelegramTicketsList(chatId);
    return;
  }

  if (upper.startsWith("/TICKET ") || upper.startsWith("TICKET ")) {
    const eventParam = text.replace(/^\/?ticket\s+/i, "").trim();
    await presentEventTicketTiers({ chatId, eventIdentifier: eventParam });
    return;
  }

  if (["/MYTICKETS", "MY TICKETS", "MYTICKETS", "/MYTICKET", "MY TICKET"].includes(upper)) {
    await handleMyTicketsTelegram(chatId);
    return;
  }

  const fromUser = inbound.raw.callback_query?.from || inbound.raw.message?.from;

  // 3. Fetch Active Session
  const { data: activeSession } = await db
    .from("telegram_sessions")
    .select("id, chat_id, telegram_user_id, phone, phone_hash, event_id, category_id, nominee_id, tier_id, customer_name, quantity, state, reference, payment_url, metadata, expires_at")
    .eq("chat_id", chatId)
    .gt("expires_at", new Date().toISOString())
    .neq("state", "completed")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // 3. Contact Verification Handling (for free vote phone limits)
  if (contact) {
    // Authenticate that the contact belongs to this Telegram user (anti-spoofing)
    if (contact.user_id && contact.user_id !== userId) {
      await sendTelegramMessage(
        chatId,
        "⚠️ Please tap the button below to share *your own* verified phone number.",
      );
      return;
    }

    const phone = contact.phone_number;
    const phoneHash = createHash("sha256").update(phone).digest("hex");

    if (activeSession && activeSession.event_id && activeSession.nominee_id && activeSession.category_id) {
      await db
        .from("telegram_sessions")
        .update({
          phone,
          phone_hash: phoneHash,
          state: "idle",
          updated_at: new Date().toISOString(),
        })
        .eq("id", activeSession.id);

      const { data: sessionEvent } = await db
        .from("events")
        .select("id, name, free_vote_limit_per_phone")
        .eq("id", activeSession.event_id)
        .single();

      const { data: sessionNominee } = await db
        .from("nominees")
        .select("id, name, image_path")
        .eq("id", activeSession.nominee_id)
        .single();

      const { data: sessionCategory } = await db
        .from("categories")
        .select("id, name")
        .eq("id", activeSession.category_id)
        .single();

      if (sessionEvent && sessionNominee && sessionCategory) {
        await handleFreeTelegramVote({
          chatId,
          phone,
          phoneHash,
          event: sessionEvent,
          category: sessionCategory,
          nominee: sessionNominee,
          quantity: activeSession.quantity || 1,
        });
        return;
      }
    }

    await sendTelegramMessage(
      chatId,
      `✅ Phone number *+${phone}* verified! Send /events to view ongoing competitions.`,
      { reply_markup: { remove_keyboard: true } },
    );
    return;
  }

  // 4. Callback Query Router: Direct Actions
  if (isCallback && (text === "browse_tickets" || text === "tickets")) {
    await presentTelegramTicketsList(chatId);
    return;
  }

  if (isCallback && (text === "results" || text === "awards")) {
    await presentTelegramResultsList(chatId);
    return;
  }

  if (isCallback && text.startsWith("results_")) {
    const slug = text.replace(/^results_/, "");
    await presentTelegramEventResults(chatId, slug);
    return;
  }

  if (isCallback && text === "events") {
    await presentCompetitionsList(chatId);
    return;
  }

  if (isCallback && text === "mytickets") {
    await handleMyTicketsTelegram(chatId, activeSession?.phone);
    return;
  }

  if (isCallback && text === "cancel_ticket") {
    if (activeSession) {
      await db.from("telegram_sessions").delete().eq("id", activeSession.id);
    }
    await sendTelegramMessage(chatId, "👋 Ticket checkout cancelled. Send /tickets to browse upcoming passes.");
    return;
  }

  if (isCallback && text.startsWith("ticket:")) {
    const slugOrId = text.replace(/^ticket:/, "");
    await presentEventTicketTiers({ chatId, eventIdentifier: slugOrId });
    return;
  }

  if (isCallback && text.startsWith("tiktier:")) {
    const tierId = text.replace(/^tiktier:/, "");
    await selectTicketTierTelegram({ chatId, tierId, activeSession, userId, fromUser });
    return;
  }

  if (isCallback && text.startsWith("tikqty:")) {
    const cleanQty = parseInt(text.replace(/^tikqty:/, ""), 10);
    await handleTicketQuantityTelegram({ chatId, quantity: cleanQty, activeSession, userId, fromUser });
    return;
  }

  if (isCallback && text === "custom_tikqty") {
    if (activeSession) {
      await db
        .from("telegram_sessions")
        .update({ state: "awaiting_ticket_quantity", updated_at: new Date().toISOString() })
        .eq("id", activeSession.id);
      await sendTelegramMessage(chatId, "✏️ Please reply with the number of tickets you wish to purchase (e.g. *1*, *2*, *4* up to 20):");
      return;
    }
  }

  if (isCallback && text.startsWith("tikname:")) {
    const nameChoice = text.replace(/^tikname:/, "");
    await handleTicketNameTelegram({ chatId, name: nameChoice, activeSession, userId, fromUser });
    return;
  }

  if (isCallback && text.startsWith("event:")) {
    const slugOrId = text.replace(/^event:/, "");
    await presentEventBallot({ chatId, eventIdentifier: slugOrId });
    return;
  }

  if (isCallback && text.startsWith("cat:")) {
    const categoryId = text.replace(/^cat:/, "");
    await presentCategoryBallotById({ chatId, categoryId });
    return;
  }

  if (isCallback && text.startsWith("cards:")) {
    const categoryId = text.replace(/^cards:/, "");
    await sendTelegramPhotoCards({ chatId, categoryId });
    return;
  }

  if (isCallback && text.startsWith("nom:")) {
    const rawNom = text.replace(/^nom:/, "");
    const parts = rawNom.split(":");
    // Supports both nom:<nomineeId> and legacy nom:<eventId>:<nomineeId>
    const nomineeId = parts.length > 1 ? parts[1] : parts[0];
    const eventId = parts.length > 1 ? parts[0] : activeSession?.event_id;
    await selectCandidateForVoting({ chatId, eventId, nomineeId, activeSessionId: activeSession?.id });
    return;
  }

  if (isCallback && text.startsWith("qty:")) {
    const cleanQty = parseInt(text.replace(/^qty:/, ""), 10);
    if (activeSession && activeSession.event_id && activeSession.nominee_id && activeSession.category_id && cleanQty >= 1) {
      if (activeSession.metadata?.mode === "free") {
        const { data: sessionEvent } = await db.from("events").select("id, name, free_vote_limit_per_phone").eq("id", activeSession.event_id).single();
        const { data: sessionNominee } = await db.from("nominees").select("id, name, image_path").eq("id", activeSession.nominee_id).single();
        const { data: sessionCategory } = await db.from("categories").select("id, name").eq("id", activeSession.category_id).single();
        if (sessionEvent && sessionNominee && sessionCategory && activeSession.phone) {
          await handleFreeTelegramVote({
            chatId,
            phone: activeSession.phone,
            phoneHash: activeSession.phone_hash || createHash("sha256").update(activeSession.phone).digest("hex"),
            event: sessionEvent,
            category: sessionCategory,
            nominee: sessionNominee,
            quantity: cleanQty,
          });
          return;
        }
      }

      await handlePaidVoteCheckout({
        chatId,
        phone: activeSession.phone || `tg_${userId}`,
        phoneHash: activeSession.phone_hash || createHash("sha256").update(String(userId)).digest("hex"),
        eventId: activeSession.event_id,
        categoryId: activeSession.category_id,
        nomineeId: activeSession.nominee_id,
        quantity: cleanQty,
        existingSessionId: activeSession.id,
      });
      return;
    }
  }

  if (isCallback && text === "custom_qty") {
    if (activeSession) {
      await db
        .from("telegram_sessions")
        .update({ state: "awaiting_quantity", updated_at: new Date().toISOString() })
        .eq("id", activeSession.id);

      await sendTelegramMessage(
        chatId,
        "✏️ Please reply with the number of votes you want to cast (e.g. *25*, *50*, *100*):",
      );
      return;
    }
  }

  // 4b. If active session is awaiting ticket tier selection and voter replies with tier number or name
  if (activeSession && activeSession.state === "awaiting_ticket_tier" && activeSession.event_id) {
    const { data: rawTiers } = await db
      .from("event_ticket_tiers")
      .select("id, name, price_minor, capacity, sold_count")
      .eq("event_id", activeSession.event_id)
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("price_minor", { ascending: true });

    if (rawTiers && rawTiers.length > 0) {
      const tierInput = text.trim();
      const tierNum = parseInt(tierInput, 10);
      let matchedTier = null;
      if (!isNaN(tierNum) && tierNum >= 1 && tierNum <= rawTiers.length) {
        matchedTier = rawTiers[tierNum - 1];
      } else {
        matchedTier = rawTiers.find(
          (t) =>
            t.name.toLowerCase().includes(tierInput.toLowerCase()) ||
            t.id.toLowerCase() === tierInput.toLowerCase()
        );
      }

      if (matchedTier) {
        await selectTicketTierTelegram({
          chatId,
          tierId: matchedTier.id,
          activeSession,
          userId,
          fromUser,
        });
        return;
      }
    }
  }

  // 4c. If active session is awaiting ticket quantity and voter replies with a number
  if (activeSession && activeSession.state === "awaiting_ticket_quantity" && activeSession.event_id && activeSession.tier_id) {
    const cleanQty = text.replace(/\D/g, "");
    const qtyParsed = parseInt(cleanQty, 10);
    if (!qtyParsed || qtyParsed < 1 || qtyParsed > 20) {
      await sendTelegramMessage(chatId, "⚠️ Please enter a valid quantity between 1 and 20 (or reply 0 to cancel):");
      return;
    }
    await handleTicketQuantityTelegram({
      chatId,
      quantity: qtyParsed,
      activeSession,
      userId,
      fromUser,
    });
    return;
  }

  // 4d. If active session is awaiting ticket name and voter replies with attendee name
  if (activeSession && activeSession.state === "awaiting_ticket_name" && activeSession.event_id && activeSession.tier_id && activeSession.quantity) {
    await handleTicketNameTelegram({
      chatId,
      name: text.trim(),
      activeSession,
      userId,
      fromUser,
    });
    return;
  }

  // 4e. If active session is awaiting ticket phone for SMS dispatch & payment prompt
  if (activeSession && activeSession.state === "awaiting_ticket_phone" && activeSession.event_id && activeSession.tier_id && activeSession.quantity) {
    if (text.trim() === "0") {
      await db.from("telegram_sessions").delete().eq("id", activeSession.id);
      await sendTelegramMessage(chatId, "❌ Ticket purchase cancelled. Send /tickets anytime to browse upcoming events.");
      return;
    }

    const rawPhone = text.trim();
    const normalized = normalizeGhanaPhone(rawPhone);
    if (!normalized || normalized.length < 10) {
      await sendTelegramMessage(
        chatId,
        "⚠️ Please enter a valid 10-digit Ghana phone number (e.g. *0244123456* or *0551234567*) to receive your SMS pass:\n_(Or reply 0 to cancel)_"
      );
      return;
    }

    const formattedPhone = `+${normalized}`;
    await db
      .from("telegram_sessions")
      .update({
        phone: formattedPhone,
        updated_at: new Date().toISOString(),
      })
      .eq("id", activeSession.id);

    await handleTicketCheckoutTelegram({
      chatId,
      eventId: activeSession.event_id,
      tierId: activeSession.tier_id,
      quantity: activeSession.quantity,
      customerName: activeSession.customer_name || "Guest",
      phone: formattedPhone,
      userId,
      existingSessionId: activeSession.id,
    });
    return;
  }

  // 5. If active session is awaiting category selection and voter replies with number or name
  if (activeSession && activeSession.metadata?.step === "awaiting_category" && activeSession.event_id) {
    const { data: rawCategories } = await db
      .from("categories")
      .select("id, name, display_order")
      .eq("event_id", activeSession.event_id)
      .eq("is_active", true)
      .order("display_order");

    if (rawCategories && rawCategories.length > 0) {
      const catInput = text.trim();
      const catNum = parseInt(catInput, 10);
      let matchedCat = null;
      if (!isNaN(catNum) && catNum >= 1 && catNum <= rawCategories.length) {
        matchedCat = rawCategories[catNum - 1];
      } else {
        matchedCat = rawCategories.find(
          (c) =>
            c.name.toLowerCase().includes(catInput.toLowerCase()) ||
            c.id.toLowerCase() === catInput.toLowerCase()
        );
      }

      if (matchedCat) {
        await presentCategoryBallotById({ chatId, categoryId: matchedCat.id });
        return;
      }
    }
  }

  // 6. If active session is awaiting candidate selection and voter replies with number, code or name
  if (activeSession && (activeSession.state === "idle" || activeSession.state === "awaiting_candidate") && activeSession.event_id) {
    const { data: sessionEvent } = await db
      .from("events")
      .select("id, name, slug, voting_mode, unit_price_minor, free_vote_limit_per_phone, verification_method, starts_at, ends_at, status, image_path")
      .eq("id", activeSession.event_id)
      .single();

    if (sessionEvent) {
      let nomQuery = db
        .from("nominees")
        .select("id, name, public_code, display_order, image_path, category_id, categories!inner(id, name, event_id, is_active)")
        .eq("categories.event_id", sessionEvent.id)
        .eq("is_active", true)
        .order("display_order");

      if (activeSession.category_id) {
        nomQuery = nomQuery.eq("category_id", activeSession.category_id);
      }

      const { data: rawNoms } = await nomQuery;

      if (rawNoms && rawNoms.length > 0) {
        const sessionNominees: NomineeWithCategory[] = rawNoms.map((n: Record<string, unknown>) => ({
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

        const candidateInput = text.replace(/^(VOTE\s+)/i, "").trim();
        const matchedNom = sessionNominees.find((n, idx) => {
          const num = idx + 1;
          if (candidateInput === String(num)) return true;
          if (candidateInput === String(num).padStart(2, "0")) return true;
          if (n.public_code && n.public_code.toUpperCase() === candidateInput.toUpperCase()) return true;
          const targetNum = parseInt(candidateInput, 10);
          const nomNum = parseInt(n.public_code || "", 10);
          if (!isNaN(targetNum) && !isNaN(nomNum) && targetNum === nomNum) return true;
          if (n.id.toLowerCase() === candidateInput.toLowerCase()) return true;
          if (n.id.toLowerCase().startsWith(candidateInput.toLowerCase())) return true;
          if (n.name.toLowerCase().includes(candidateInput.toLowerCase())) return true;
          return false;
        });

        if (matchedNom) {
          await selectCandidateForVoting({
            chatId,
            eventId: sessionEvent.id,
            nomineeId: matchedNom.id,
            activeSessionId: activeSession.id,
          });
          return;
        }
      }
    }
  }

  // 6. If active session is awaiting quantity and user sends a number
  if (activeSession && activeSession.state === "awaiting_quantity" && activeSession.event_id && activeSession.nominee_id && activeSession.category_id) {
    const cleanQty = text.replace(/\D/g, "");
    let qtyParsed = parseInt(cleanQty, 10);
    if (activeSession.metadata?.mode === "free" && upper === "ALL") {
      qtyParsed = Number(activeSession.metadata?.max_votes) || 1;
    }

    if (!qtyParsed || qtyParsed < 1) {
      await sendTelegramMessage(chatId, "Please enter a valid number of votes (or reply 0 to cancel):");
      return;
    }

    // Check if free voting session
    if (activeSession.metadata?.mode === "free") {
      const maxFree = Number(activeSession.metadata?.max_votes) || 1;
      if (qtyParsed > maxFree) {
        await sendTelegramMessage(
          chatId,
          `⚠️ You have ${maxFree} free vote${maxFree === 1 ? "" : "s"} remaining. Please enter a number between 1 and ${maxFree} (or 0 to cancel):`,
        );
        return;
      }

      const { data: sessionEvent } = await db.from("events").select("id, name, free_vote_limit_per_phone").eq("id", activeSession.event_id).single();
      const { data: sessionNominee } = await db.from("nominees").select("id, name, image_path").eq("id", activeSession.nominee_id).single();
      const { data: sessionCategory } = await db.from("categories").select("id, name").eq("id", activeSession.category_id).single();
      if (sessionEvent && sessionNominee && sessionCategory && activeSession.phone) {
        await handleFreeTelegramVote({
          chatId,
          phone: activeSession.phone,
          phoneHash: activeSession.phone_hash || createHash("sha256").update(activeSession.phone).digest("hex"),
          event: sessionEvent,
          category: sessionCategory,
          nominee: sessionNominee,
          quantity: qtyParsed,
        });
        return;
      }
    }

    if (qtyParsed > 10000) {
      await sendTelegramMessage(chatId, "Please enter a valid number of votes between 1 and 10,000 (or reply 0 to cancel):");
      return;
    }

    let quantityToVote = qtyParsed;
    const pkgList = activeSession.metadata?.qty_packages;
    if (Array.isArray(pkgList) && (qtyParsed === 1 || qtyParsed === 2 || qtyParsed === 3)) {
      const minVotes = Number(activeSession.metadata?.min_votes) || pkgList[0] || 1;
      if (minVotes > 3) {
        quantityToVote = Number(pkgList[qtyParsed - 1]) || qtyParsed;
      }
    }

    await handlePaidVoteCheckout({
      chatId,
      phone: activeSession.phone || `tg_${userId}`,
      phoneHash: activeSession.phone_hash || createHash("sha256").update(String(userId)).digest("hex"),
      eventId: activeSession.event_id,
      categoryId: activeSession.category_id,
      nomineeId: activeSession.nominee_id,
      quantity: quantityToVote,
      existingSessionId: activeSession.id,
    });
    return;
  }

  // 7. If active session is awaiting invite code
  if (activeSession && activeSession.state === "awaiting_invite_code" && activeSession.event_id && activeSession.nominee_id && activeSession.category_id) {
    await handleInviteCodeVerification({
      chatId,
      code: text,
      session: activeSession,
    });
    return;
  }

  // 8. If active session is awaiting voter ID (Student ID, Index Number, Member ID, or Email)
  if (activeSession && activeSession.state === "awaiting_voter_id" && activeSession.event_id && activeSession.nominee_id && activeSession.category_id) {
    await handleVoterIdVerification({
      chatId,
      identifier: text,
      session: activeSession,
    });
    return;
  }

  // 9. If active session is awaiting claim code / voting PIN
  if (activeSession && activeSession.state === "awaiting_claim_code" && activeSession.event_id && activeSession.nominee_id && activeSession.category_id) {
    await handleClaimCodeVerification({
      chatId,
      claimCode: text,
      session: activeSession,
    });
    return;
  }

  // 10. If active session is awaiting email OTP
  if (activeSession && activeSession.state === "awaiting_email_otp" && activeSession.event_id && activeSession.nominee_id && activeSession.category_id) {
    await handleEmailOtpVerification({
      chatId,
      otp: text,
      session: activeSession,
    });
    return;
  }

  // 11. Free-form text parser: Check if text is event code or name
  await presentEventBallot({ chatId, eventIdentifier: text.replace(/^VOTE\s+/i, "").trim() });
}

async function presentCompetitionsList(chatId: number): Promise<void> {
  const db = paymentAdmin();
  const nowIso = new Date().toISOString();

  const { data: events, error } = await db
    .from("events")
    .select("id, name, slug, voting_mode, unit_price_minor, image_path, ends_at")
    .in("event_type", ["voting", "hybrid"])
    .eq("status", "published")
    .lte("starts_at", nowIso)
    .gt("ends_at", nowIso)
    .order("created_at", { ascending: false })
    .limit(8);

  if (error || !events || events.length === 0) {
    await sendTelegramMessage(
      chatId,
      "🗳️ *Welcome to VoteCastHub!*\n\nThere are currently no active public competitions open for voting. Please check back shortly or enter your event code.",
    );
    return;
  }

  const buttons = events.map((ev) => [
    {
      text: `🏆 ${ev.name}`.slice(0, 36),
      callback_data: `event:${ev.id}`,
    },
  ]);

  buttons.push([
    {
      text: "🎟️ Browse Event Tickets & Passes",
      callback_data: "browse_tickets",
    },
  ]);

  buttons.push([
    {
      text: "🏆 Awards Results & Standings",
      callback_data: "results",
    },
  ]);

  const welcomeText = `🏆 *Welcome to VoteCastHub!* 🗳️\n\nTap an ongoing competition below to view contestants and cast your ballot:\n\n_(Or reply with any contestant's code like *VOTE BSF-092* to vote directly)_`;

  await sendTelegramMessage(chatId, welcomeText, {
    reply_markup: { inline_keyboard: buttons },
  });
}

async function presentTelegramResultsList(chatId: number): Promise<void> {
  const db = paymentAdmin();
  const list = await loadPublicAwardsDirectory(db);

  if (!list || list.length === 0) {
    await sendTelegramMessage(
      chatId,
      "🏆 *Awards Results & Standings*\n\nThere are currently no competitions with public results released. Organizers can configure Live Results Visibility to make tallies public.\n\nSend /events to browse active voting competitions or /tickets to find passes.",
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: "🗳️ Browse Active Competitions", callback_data: "events" }],
            [{ text: "🎟️ Event Tickets", callback_data: "browse_tickets" }],
          ],
        },
      }
    );
    return;
  }

  const buttons = list.slice(0, 10).map((ev) => [
    {
      text: `${ev.is_ended ? "🏆" : "⚡"} ${ev.name} (${ev.total_votes.toLocaleString()} votes)`.slice(0, 42),
      callback_data: `results_${ev.slug}`,
    },
  ]);

  buttons.push([
    {
      text: "🗳️ Browse Competitions",
      callback_data: "events",
    },
  ]);

  const msg = `🏆 *VoteCastHub Ghana — Awards Results*\n\nTap a competition below to view certified standings, category winners, and recorded vote tallies:\n\n_(Or send /results [Event Name] directly)_`;

  await sendTelegramMessage(chatId, msg, {
    reply_markup: { inline_keyboard: buttons },
  });
}

async function presentTelegramEventResults(chatId: number, eventIdentifier: string): Promise<void> {
  const db = paymentAdmin();
  const results = await loadEventPublicResults(eventIdentifier, db);

  if (!results) {
    await sendTelegramMessage(
      chatId,
      `❌ Could not find awards results for "*${eventIdentifier}*".\n\nSend /results to browse available competitions.`,
      {
        reply_markup: {
          inline_keyboard: [[{ text: "🏆 All Results", callback_data: "results" }]],
        },
      }
    );
    return;
  }

  const ev = results.event;

  if (!results.is_public) {
    await sendTelegramMessage(
      chatId,
      `🔒 *Results Confidential / Locked*\n\nThe organizer of *${ev.name}* has configured results visibility as Organizer-Only or sealed until awards night.\n\n🔗 ${siteUrl()}/events/${ev.slug}`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: "🗳️ View Event Voting Page", url: `${siteUrl()}/events/${ev.slug}` }],
            [{ text: "← All Results", callback_data: "results" }],
          ],
        },
      }
    );
    return;
  }

  let text = `🏆 *${ev.name.toUpperCase()}* 🏆\n`;
  text += ev.is_ended ? `🏁 *Official Final Awards Results*\n` : `⚡ *Live Standings & Vote Tallies*\n`;
  text += `🏛️ Organizer: ${ev.organization_name}\n`;
  text += `📊 Recorded Ballots: *${results.total_ballots.toLocaleString("en-GH")}*\n`;
  text += `🔐 Audit Hash: \`${results.audit_hash}\`\n\n`;

  results.categories.slice(0, 6).forEach((cat) => {
    text += `🎖️ *${cat.category_name}* (${cat.total_votes.toLocaleString("en-GH")} votes)\n`;
    if (cat.podium.length === 0 || cat.total_votes === 0) {
      text += `   _No votes recorded yet_\n`;
    } else {
      cat.podium.forEach((n) => {
        const medal = n.rank === 1 ? "🥇" : n.rank === 2 ? "🥈" : "🥉";
        text += `   ${medal} *${n.name}* — ${n.vote_count.toLocaleString("en-GH")} votes (${n.vote_share_percentage}%)\n`;
      });
    }
    text += `\n`;
  });

  if (results.categories.length > 6) {
    text += `_...and ${results.categories.length - 6} more categories._\n\n`;
  }

  const inline_keyboard: Array<Array<{ text: string; url?: string; callback_data?: string }>> = [
    [
      {
        text: "🌐 View Full Certificate on Web",
        url: `${siteUrl()}/results/${ev.slug}`,
      },
    ],
  ];

  if (ev.is_live) {
    inline_keyboard.push([
      {
        text: `🗳️ Vote in ${ev.name}`.slice(0, 36),
        callback_data: `event:${ev.id}`,
      },
    ]);
  }

  inline_keyboard.push([
    {
      text: "← Back to Results List",
      callback_data: "results",
    },
  ]);

  await sendTelegramMessage(chatId, text, {
    reply_markup: { inline_keyboard },
  });
}

async function presentEventBallot(params: {
  chatId: number;
  eventIdentifier: string;
  nomineeIdentifier?: string;
}): Promise<void> {
  const db = paymentAdmin();
  const { chatId, eventIdentifier, nomineeIdentifier } = params;

  let query = db
    .from("events")
    .select("id, name, slug, event_type, voting_mode, unit_price_minor, free_vote_limit_per_phone, verification_method, starts_at, ends_at, status, image_path, venue_name, doors_open_time");

  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (uuidPattern.test(eventIdentifier)) {
    query = query.eq("id", eventIdentifier);
  } else {
    query = query.eq("slug", eventIdentifier);
  }

  const { data: event, error: eventErr } = await query.maybeSingle();

  if (eventErr || !event) {
    // Check if eventIdentifier is a direct candidate public code (e.g. "BSF-092")
    const cleanNomCode = eventIdentifier.trim();
    const { data: directNominee } = await db
      .from("nominees")
      .select(`
        id, name, public_code, display_order, image_path, category_id,
        categories!inner(
          id, name, event_id, is_active,
          events!inner(id, name, slug, event_type, voting_mode, unit_price_minor, free_vote_limit_per_phone, verification_method, starts_at, ends_at, status, image_path)
        )
      `)
      .ilike("public_code", cleanNomCode)
      .eq("is_active", true)
      .eq("categories.is_active", true)
      .eq("categories.events.status", "published")
      .gt("categories.events.ends_at", new Date().toISOString())
      .limit(1)
      .maybeSingle();

    if (directNominee) {
      const nomCat = directNominee.categories as any;
      await selectCandidateForVoting({
        chatId,
        eventId: nomCat.event_id,
        nomineeId: directNominee.id,
      });
      return;
    }

    await sendTelegramMessage(
      chatId,
      `❌ Contestant or event *${eventIdentifier}* was not found or has concluded.\nSend /events to see all ongoing competitions.`,
    );
    return;
  }

  // If this is a dedicated ticketing event, jump straight to ticket tiers
  if (event.event_type === "ticketing") {
    await presentEventTicketTiers({ chatId, eventIdentifier: event.id });
    return;
  }

  // If voter already specified a nominee directly
  if (nomineeIdentifier) {
    const { data: rawNominees } = await db
      .from("nominees")
      .select("id, name, public_code, display_order, image_path, category_id, categories!inner(id, name, event_id, is_active)")
      .eq("categories.event_id", event.id)
      .eq("is_active", true);

    if (rawNominees && rawNominees.length > 0) {
      const matched = rawNominees.find((n) => {
        if (n.public_code && String(n.public_code).toUpperCase() === nomineeIdentifier.toUpperCase()) return true;
        if (String(n.id).toLowerCase() === nomineeIdentifier.toLowerCase()) return true;
        if (String(n.name).toLowerCase().includes(nomineeIdentifier.toLowerCase())) return true;
        return false;
      });

      if (matched) {
        await selectCandidateForVoting({ chatId, eventId: event.id, nomineeId: String(matched.id) });
        return;
      }
    }
  }

  // Fetch active categories for this event
  const { data: rawCategories } = await db
    .from("categories")
    .select("id, name, display_order")
    .eq("event_id", event.id)
    .eq("is_active", true)
    .order("display_order");

  if (!rawCategories || rawCategories.length === 0) {
    // Check if event has ticket tiers instead
    const { count: tierCount } = await db
      .from("event_ticket_tiers")
      .select("id", { count: "exact", head: true })
      .eq("event_id", event.id)
      .eq("is_active", true);

    if (tierCount && tierCount > 0) {
      await presentEventTicketTiers({ chatId, eventIdentifier: event.id });
      return;
    }

    await sendTelegramMessage(chatId, `❌ No active categories found for *${event.name}*.`);
    return;
  }

  // Single-category competition: Jump straight to contestants
  if (rawCategories.length === 1) {
    await presentCategoryBallotById({ chatId, categoryId: rawCategories[0].id });
    return;
  }

  // Multi-category competition: Present category selection menu
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  await db
    .from("telegram_sessions")
    .delete()
    .eq("chat_id", chatId)
    .neq("state", "completed");

  await db.from("telegram_sessions").insert({
    chat_id: chatId,
    telegram_user_id: chatId,
    event_id: event.id,
    state: "idle",
    metadata: {
      step: "awaiting_category",
      event_name: event.name,
      event_slug: event.slug,
      event_identifier: eventIdentifier,
    },
    expires_at: expiresAt,
  });

  const priceText = event.voting_mode === "paid"
    ? `💰 Cost: *GH₵${(Number(event.unit_price_minor) / 100).toFixed(2)} per vote*`
    : "🎟️ *Free voting*";

  const categoryRoster = rawCategories
    .slice(0, 15)
    .map((c, idx) => `• *${idx + 1}* · ${c.name}`)
    .join("\n");

  const moreText = rawCategories.length > 15 ? `\n_...and ${rawCategories.length - 15} more categories._` : "";

  const buttons = rawCategories.slice(0, 10).map((c, idx) => [
    {
      text: `📂 ${idx + 1}. ${c.name}`.slice(0, 36),
      callback_data: `cat:${c.id}`,
    },
  ]);

  if (event.event_type === "hybrid") {
    buttons.unshift([
      {
        text: "🎟️ Buy Event Passes / Tickets",
        callback_data: `ticket:${event.id}`,
      },
    ]);
  }

  buttons.push([
    {
      text: "🔄 Browse Other Competitions",
      callback_data: "events",
    },
  ]);

  const bodyText = `🗳️ *${event.name}*\n${priceText}\n\n*Select a Category:*\n${categoryRoster}${moreText}\n\n👉 Tap a category below or reply with a number (e.g. 1):`;

  const eventCoverUrl = await getSignedImageUrl(event.image_path);
  if (eventCoverUrl) {
    await sendTelegramPhoto(chatId, eventCoverUrl, bodyText, {
      reply_markup: { inline_keyboard: buttons },
    });
  } else {
    await sendTelegramMessage(chatId, bodyText, {
      reply_markup: { inline_keyboard: buttons },
    });
  }
}

async function presentCategoryBallotById(params: {
  chatId: number;
  categoryId: string;
}): Promise<void> {
  const db = paymentAdmin();
  const { chatId, categoryId } = params;

  const { data: category } = await db
    .from("categories")
    .select("id, name, event_id, events!inner(id, name, slug, voting_mode, unit_price_minor, free_vote_limit_per_phone, image_path)")
    .eq("id", categoryId)
    .single();

  if (!category) {
    await sendTelegramMessage(chatId, "❌ Category not found. Send /events to restart.");
    return;
  }

  let event = ((category as Record<string, unknown>).events as {
    id: string;
    name: string;
    slug: string;
    voting_mode: string;
    unit_price_minor: number;
    free_vote_limit_per_phone: number;
    image_path: string | null;
  } | undefined) || null;

  if (!event && category.event_id) {
    const { data: ev } = await db
      .from("events")
      .select("id, name, slug, voting_mode, unit_price_minor, free_vote_limit_per_phone, image_path")
      .eq("id", category.event_id)
      .single();
    if (ev) event = ev;
  }

  if (!event) {
    await sendTelegramMessage(chatId, "❌ Event details unavailable. Send /events to restart.");
    return;
  }

  const { data: rawNominees } = await db
    .from("nominees")
    .select("id, name, public_code, display_order, image_path, category_id")
    .eq("category_id", category.id)
    .eq("is_active", true)
    .order("display_order");

  if (!rawNominees || rawNominees.length === 0) {
    await sendTelegramMessage(chatId, `❌ No active contestants found in *${category.name}*. Send /events to restart.`);
    return;
  }

  const { count: catCount } = await db
    .from("categories")
    .select("id", { count: "exact", head: true })
    .eq("event_id", event.id)
    .eq("is_active", true);

  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  await db
    .from("telegram_sessions")
    .delete()
    .eq("chat_id", chatId)
    .neq("state", "completed");

  await db.from("telegram_sessions").insert({
    chat_id: chatId,
    telegram_user_id: chatId,
    event_id: event.id,
    category_id: category.id,
    state: "idle",
    metadata: {
      step: "awaiting_candidate",
      event_name: event.name,
      event_slug: event.slug,
      category_id: category.id,
      category_name: category.name,
    },
    expires_at: expiresAt,
  });

  const priceText = event.voting_mode === "paid"
    ? `💰 Cost: *GH₵${(Number(event.unit_price_minor) / 100).toFixed(2)} per vote*`
    : "🎟️ *Free voting*";

  const candidateRoster = rawNominees
    .slice(0, 15)
    .map((n, idx) => {
      const code = n.public_code ? ` (Code: ${n.public_code})` : "";
      return `• *${idx + 1}* · ${n.name}${code}`;
    })
    .join("\n");

  const moreText = rawNominees.length > 15 ? `\n_...and ${rawNominees.length - 15} more candidates._` : "";

  const buttons = rawNominees.slice(0, 10).map((n, idx) => [
    {
      text: `👤 ${idx + 1}. ${n.name}`.slice(0, 36),
      callback_data: `nom:${n.id}`,
    },
  ]);

  const hasImages = rawNominees.some((n) => Boolean(n.image_path));
  if (hasImages) {
    buttons.unshift([
      {
        text: "🖼️ View Candidate Photo Cards",
        callback_data: `cards:${category.id}`,
      },
    ]);
  }

  if (catCount && catCount > 1) {
    buttons.push([
      {
        text: "📂 Browse Other Categories",
        callback_data: `event:${event.id}`,
      },
    ]);
  }

  buttons.push([
    {
      text: "🔄 Browse Other Competitions",
      callback_data: "events",
    },
  ]);

  const bodyText = `🗳️ *${event.name}*\nCategory: *${category.name}*\n${priceText}\n\n*Candidates:*\n${candidateRoster}${moreText}\n\n👉 Tap a candidate below or reply with a number (e.g. 1):`;

  const eventCoverUrl = await getSignedImageUrl(event.image_path);
  if (eventCoverUrl) {
    await sendTelegramPhoto(chatId, eventCoverUrl, bodyText, {
      reply_markup: { inline_keyboard: buttons },
    });
  } else {
    await sendTelegramMessage(chatId, bodyText, {
      reply_markup: { inline_keyboard: buttons },
    });
  }
}

async function sendTelegramPhotoCards(params: {
  chatId: number;
  categoryId: string;
}): Promise<void> {
  const db = paymentAdmin();
  const { chatId, categoryId } = params;

  const { data: category } = await db
    .from("categories")
    .select("id, name, event_id, events!inner(id, name, slug, voting_mode, unit_price_minor, free_vote_limit_per_phone, image_path)")
    .eq("id", categoryId)
    .single();

  if (!category) {
    await sendTelegramMessage(chatId, "❌ Category not found. Send /events to restart.");
    return;
  }

  let event = ((category as Record<string, unknown>).events as {
    id: string;
    name: string;
    slug: string;
    voting_mode: string;
    unit_price_minor: number;
    free_vote_limit_per_phone: number;
    image_path: string | null;
  } | undefined) || null;

  if (!event && category.event_id) {
    const { data: ev } = await db
      .from("events")
      .select("id, name, slug, voting_mode, unit_price_minor, free_vote_limit_per_phone, image_path")
      .eq("id", category.event_id)
      .single();
    if (ev) event = ev;
  }

  if (!event) {
    await sendTelegramMessage(chatId, "❌ Event details unavailable. Send /events to restart.");
    return;
  }

  const { data: rawNominees } = await db
    .from("nominees")
    .select("id, name, public_code, display_order, image_path, category_id")
    .eq("category_id", category.id)
    .eq("is_active", true)
    .order("display_order");

  if (!rawNominees || rawNominees.length === 0) {
    await sendTelegramMessage(chatId, `❌ No active contestants found in *${category.name}*. Send /events to restart.`);
    return;
  }

  const priceText = event.voting_mode === "paid"
    ? `💰 Cost: *GH₵${(Number(event.unit_price_minor) / 100).toFixed(2)} per vote*`
    : "🎟️ *Free voting*";

  for (const [idx, n] of rawNominees.slice(0, 10).entries()) {
    const nomPhotoUrl = await getSignedImageUrl(n.image_path);
    const code = n.public_code ? ` • Code: *${n.public_code}*` : ` • #${idx + 1}`;
    const cardCaption = `👤 *${n.name}*${code}\n📂 Category: *${category.name}*\n${priceText}\n\n👉 Tap the button below to vote for ${n.name}:`;
    const cardButtons = [
      [
        {
          text: `🗳️ Vote for ${n.name}`.slice(0, 36),
          callback_data: `nom:${n.id}`,
        },
      ],
    ];

    if (nomPhotoUrl) {
      await sendTelegramPhoto(chatId, nomPhotoUrl, cardCaption, {
        reply_markup: { inline_keyboard: cardButtons },
      });
    } else {
      await sendTelegramMessage(chatId, cardCaption, {
        reply_markup: { inline_keyboard: cardButtons },
      });
    }
  }

  const { count: catCount } = await db
    .from("categories")
    .select("id", { count: "exact", head: true })
    .eq("event_id", event.id)
    .eq("is_active", true);

  const navButtons = [];
  if (catCount && catCount > 1) {
    navButtons.push([{ text: "📂 Browse Other Categories", callback_data: `event:${event.id}` }]);
  }
  navButtons.push([{ text: "🔄 Browse Other Competitions", callback_data: "events" }]);

  await sendTelegramMessage(
    chatId,
    `👆 *${category.name}* (${event.name})\n\nTap [🗳️ Vote] under any candidate's photo above to cast your ballot!`,
    { reply_markup: { inline_keyboard: navButtons } },
  );
}

async function selectCandidateForVoting(params: {
  chatId: number;
  nomineeId: string;
  eventId?: string;
  activeSessionId?: string;
}): Promise<void> {
  const db = paymentAdmin();
  const { chatId, nomineeId, activeSessionId } = params;

  const { data: nominee } = await db
    .from("nominees")
    .select("id, name, image_path, category_id, categories!inner(id, name, event_id)")
    .eq("id", nomineeId)
    .single();

  if (!nominee) {
    await sendTelegramMessage(chatId, "❌ Selection unavailable. Send /events to restart.");
    return;
  }

  const category = nominee.categories as unknown as { id: string; name: string; event_id: string };
  const targetEventId = params.eventId || category.event_id;

  const { data: event } = await db
    .from("events")
    .select("id, name, voting_mode, unit_price_minor, free_vote_limit_per_phone, image_path")
    .eq("id", targetEventId)
    .single();

  if (!event) {
    await sendTelegramMessage(chatId, "❌ Competition unavailable. Send /events to restart.");
    return;
  }

  if (event.voting_mode === "free") {
    // Check if phone number is known
    let phone: string | null = null;
    let phoneHash: string | null = null;

    if (activeSessionId) {
      const { data: sess } = await db.from("telegram_sessions").select("phone, phone_hash").eq("id", activeSessionId).single();
      phone = sess?.phone || null;
      phoneHash = sess?.phone_hash || null;
    }

    if (!phone) {
      // Prompt user to share verified phone number via native Telegram contact button
      await db
        .from("telegram_sessions")
        .update({
          event_id: event.id,
          category_id: category.id,
          nominee_id: nominee.id,
          quantity: 1,
          state: "awaiting_contact",
          updated_at: new Date().toISOString(),
        })
        .eq("id", activeSessionId);

      await sendTelegramMessage(
        chatId,
        `🗳️ *Voter Verification Required*\n\nTo ensure fair voting (1 vote per person) for *${nominee.name}* in *${category.name}*, please tap the button below to verify your phone number:`,
        {
          reply_markup: {
            keyboard: [[{ text: "📱 Tap to Verify My Phone Number", request_contact: true }]],
            resize_keyboard: true,
            one_time_keyboard: true,
          },
        },
      );
      return;
    }

    const totalLimit = Number(event.free_vote_limit_per_phone) || 1;
    let remaining = totalLimit;
    const userId = await resolveTelegramVoterUserId(db, phone);
    if (userId) {
      const { data: batches } = await db
        .from("vote_batches")
        .select("quantity")
        .eq("voter_user_id", userId)
        .eq("event_id", event.id)
        .is("payment_attempt_id", null);
      const used = (batches || []).reduce((sum, b) => sum + (Number(b.quantity) || 1), 0);
      remaining = Math.max(0, totalLimit - used);
    }

    if (remaining <= 0) {
      await sendTelegramMessage(chatId, `⚠️ You have already reached your free vote limit of *${totalLimit} vote(s)* for *${event.name}*.`);
      return;
    }

    if (remaining === 1) {
      await handleFreeTelegramVote({
        chatId,
        phone,
        phoneHash: phoneHash || createHash("sha256").update(phone).digest("hex"),
        event,
        category,
        nominee,
        quantity: 1,
      });
      return;
    }

    // Remaining > 1: Allow voter to choose how many free votes to cast
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    if (activeSessionId) {
      await db
        .from("telegram_sessions")
        .update({
          event_id: event.id,
          category_id: category.id,
          nominee_id: nominee.id,
          state: "awaiting_quantity",
          metadata: {
            mode: "free",
            max_votes: remaining,
            event_name: event.name,
            category_name: category.name,
            nominee_name: nominee.name,
            nominee_image_path: nominee.image_path,
          },
          expires_at: expiresAt,
          updated_at: new Date().toISOString(),
        })
        .eq("id", activeSessionId);
    } else {
      await db.from("telegram_sessions").delete().eq("chat_id", chatId).neq("state", "completed");
      await db.from("telegram_sessions").insert({
        chat_id: chatId,
        telegram_user_id: chatId,
        phone,
        phone_hash: phoneHash,
        event_id: event.id,
        category_id: category.id,
        nominee_id: nominee.id,
        state: "awaiting_quantity",
        metadata: {
          mode: "free",
          max_votes: remaining,
          event_name: event.name,
          category_name: category.name,
          nominee_name: nominee.name,
          nominee_image_path: nominee.image_path,
        },
        expires_at: expiresAt,
      });
    }

    const freeButtons: { text: string; callback_data: string }[][] = [
      [
        { text: "1 Vote", callback_data: "qty:1" },
        ...(remaining >= 2 ? [{ text: "2 Votes", callback_data: "qty:2" }] : []),
        ...(remaining >= 3 ? [{ text: "3 Votes", callback_data: "qty:3" }] : []),
      ],
      [
        { text: `✨ Cast All ${remaining} Votes`, callback_data: `qty:${remaining}` },
        { text: "✏️ Other Qty", callback_data: "custom_qty" },
      ],
    ];

    const freeText =
      `🗳️ *Free Voting for ${nominee.name}*\n` +
      `• Category: *${category.name}*\n` +
      `• Event: *${event.name}*\n` +
      `• Remaining Allowance: *${remaining} of ${totalLimit} free vote(s)*\n\n` +
      `Select how many free votes to cast:`;

    const nomPhoto = await getSignedImageUrl(nominee.image_path);
    if (nomPhoto) {
      await sendTelegramPhoto(chatId, nomPhoto, freeText, {
        reply_markup: { inline_keyboard: freeButtons },
      });
    } else {
      await sendTelegramMessage(chatId, freeText, {
        reply_markup: { inline_keyboard: freeButtons },
      });
    }
    return;
  }

  // Paid voting -> Prompt for package with buttons
  const unitPriceMinor = Math.max(1, Number(event.unit_price_minor) || 100);
  const minVotes = Math.max(1, Math.ceil(100 / unitPriceMinor));
  const priceGhs = (unitPriceMinor / 100).toFixed(2);

  const qty1 = minVotes;
  const qty2 = minVotes === 1 ? 5 : minVotes * 2;
  const qty3 = minVotes === 1 ? 10 : minVotes * 5;

  const cost1 = ((qty1 * unitPriceMinor) / 100).toFixed(2);
  const cost2 = ((qty2 * unitPriceMinor) / 100).toFixed(2);
  const cost3 = ((qty3 * unitPriceMinor) / 100).toFixed(2);

  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  const voteRequest = randomUUID();

  if (activeSessionId) {
    await db
      .from("telegram_sessions")
      .update({
        event_id: event.id,
        category_id: category.id,
        nominee_id: nominee.id,
        state: "awaiting_quantity",
        vote_request: voteRequest,
        expires_at: expiresAt,
        metadata: {
          event_name: event.name,
          category_name: category.name,
          nominee_name: nominee.name,
          nominee_image_path: nominee.image_path,
          min_votes: minVotes,
          qty_packages: [qty1, qty2, qty3],
        },
        updated_at: new Date().toISOString(),
      })
      .eq("id", activeSessionId);
  } else {
    await db
      .from("telegram_sessions")
      .delete()
      .eq("chat_id", chatId)
      .neq("state", "completed");

    await db.from("telegram_sessions").insert({
      chat_id: chatId,
      telegram_user_id: chatId,
      event_id: event.id,
      category_id: category.id,
      nominee_id: nominee.id,
      state: "awaiting_quantity",
      vote_request: voteRequest,
      expires_at: expiresAt,
      metadata: {
        event_name: event.name,
        category_name: category.name,
        nominee_name: nominee.name,
        nominee_image_path: nominee.image_path,
        min_votes: minVotes,
        qty_packages: [qty1, qty2, qty3],
      },
    });
  }

  const buttons = [
    [
      { text: `1️⃣ ${qty1} Vote${qty1 > 1 ? "s" : ""} · GH₵${cost1}`, callback_data: `qty:${qty1}` },
      { text: `2️⃣ ${qty2} Votes · GH₵${cost2}`, callback_data: `qty:${qty2}` },
    ],
    [
      { text: `3️⃣ ${qty3} Votes · GH₵${cost3}`, callback_data: `qty:${qty3}` },
      { text: `✏️ Custom Quantity`, callback_data: `custom_qty` },
    ],
  ];

  let promptBody = `You selected *${nominee.name}* in *${category.name}* (${event.name}).\nPrice: *GH₵${priceGhs} per vote*.`;
  if (minVotes > 1) {
    promptBody += `\n\nℹ️ _Mobile Money minimum checkout is GH₵ 1.00 (min package: ${minVotes} votes)_`;
  }
  promptBody += `\n\nHow many votes would you like to cast? Tap a package below or reply with a number (*${qty1}*, *${qty2}*, *${qty3}*, or any number):`;

  const nomineePhotoUrl = await getSignedImageUrl(nominee.image_path);
  if (nomineePhotoUrl) {
    await sendTelegramPhoto(chatId, nomineePhotoUrl, promptBody, {
      reply_markup: { inline_keyboard: buttons },
    });
  } else {
    await sendTelegramMessage(chatId, promptBody, {
      reply_markup: { inline_keyboard: buttons },
    });
  }
}

async function handlePaidVoteCheckout(params: {
  chatId: number;
  phone: string;
  phoneHash: string;
  eventId: string;
  categoryId: string;
  nomineeId: string;
  quantity: number;
  existingSessionId?: string;
}): Promise<void> {
  const db = paymentAdmin();
  const { chatId, phone, eventId, categoryId, nomineeId, quantity, existingSessionId } = params;

  const { data: event } = await db.from("events").select("id, name, unit_price_minor").eq("id", eventId).single();
  const { data: nominee } = await db.from("nominees").select("id, name, image_path").eq("id", nomineeId).single();
  const { data: category } = await db.from("categories").select("id, name").eq("id", categoryId).single();

  if (!event || !nominee) {
    await sendTelegramMessage(chatId, "❌ Selection unavailable. Send /events to restart.");
    return;
  }

  const unitPriceMinor = Math.max(1, Number(event.unit_price_minor) || 100);
  const minVotes = Math.max(1, Math.ceil(100 / unitPriceMinor));
  if (quantity < minVotes) {
    const minGhs = ((minVotes * unitPriceMinor) / 100).toFixed(2);
    await sendTelegramMessage(
      chatId,
      `⚠️ *Minimum Mobile Money Checkout is GH₵ 1.00*\n\nTelco networks and Paystack require a minimum checkout of GH₵ 1.00.\nAt GH₵ ${(unitPriceMinor / 100).toFixed(2)} per vote, the minimum purchase is *${minVotes} votes (GH₵ ${minGhs})*.\n\nPlease reply with *${minVotes}* or more to continue:`,
    );
    return;
  }

  const voteRequest = randomUUID();

  // Reserve payment attempt in database
  const { data: attempt, error: reserveErr } = await db.rpc("reserve_paystack_whatsapp_payment", {
    p_phone: phone,
    p_event: eventId,
    p_category: categoryId,
    p_nominee: nomineeId,
    p_quantity: quantity,
    p_vote_request: voteRequest,
  });

  if (reserveErr || !attempt) {
    await sendTelegramMessage(chatId, "❌ Unable to initiate payment checkout. The organizer's payout account may need verification.");
    return;
  }

  // Re-tag reference to VCH-TG- so it is identified as a Telegram payment
  const tgRef = `VCH-TG-${voteRequest.replace(/-/g, "")}`;
  await db
    .from("payment_attempts")
    .update({ provider_reference: tgRef, idempotency_key: `tg-paystack-${voteRequest}` })
    .eq("id", attempt.id);
  attempt.provider_reference = tgRef;

  const totalAmountMinor = Number(attempt.total_amount_minor);
  const totalGhs = (totalAmountMinor / 100).toFixed(2);
  const subaccount = attempt.subaccount_code;

  let authUrl = "";
  try {
    const paystackRes = await paystack<{ authorization_url: string }>("/transaction/initialize", {
      reference: attempt.provider_reference,
      amount: totalAmountMinor,
      currency: "GHS",
      email: `${phone.replace(/\D/g, "") || chatId}@telegram.votecasthub.com`,
      ...(subaccount ? {
        subaccount,
        bearer: "account" as const,
        transaction_charge: Math.floor(totalAmountMinor / 10),
      } : {}),
      metadata: {
        channel: "telegram",
        chat_id: chatId,
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
    const errMsg = err instanceof Error ? err.message : String(err);
    if (subaccount && errMsg.toLowerCase().includes("subaccount")) {
      try {
        const fallbackRes = await paystack<{ authorization_url: string }>("/transaction/initialize", {
          reference: attempt.provider_reference,
          amount: totalAmountMinor,
          currency: "GHS",
          email: `${chatId}@telegram.votecasthub.com`,
          metadata: {
            channel: "telegram",
            chat_id: chatId,
            phone,
            event_id: eventId,
            nominee_id: nomineeId,
            quantity,
            intended_subaccount: subaccount,
          },
        });
        const parsedUrl = new URL(fallbackRes.authorization_url);
        if (parsedUrl.protocol === "https:" && parsedUrl.hostname === "checkout.paystack.com") {
          authUrl = parsedUrl.href;
        }
      } catch {
        // ignore
      }
    }

    if (!authUrl) {
      await sendTelegramMessage(
        chatId,
        `❌ Payment checkout error: ${errMsg.replace(/^Paystack request failed:\s*/, "") || "Please try again shortly."}`,
      );
      return;
    }
  }

  // Update session
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  if (existingSessionId) {
    await db
      .from("telegram_sessions")
      .update({
        state: "awaiting_payment",
        quantity,
        reference: attempt.provider_reference,
        payment_url: authUrl,
        expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existingSessionId);
  }

  const checkoutMsg = `🗳️ *Confirm Your Vote for ${nominee.name}*\n• Event: *${event.name}*\n• Category: *${category?.name || "Contestant"}*\n• Quantity: *${quantity} vote(s)*\n• Total: *GH₵${totalGhs}*\n\n💳 *Tap the button below to pay with Mobile Money (MTN, Telecel, AT) or Card:*\n👉 ${authUrl}\n\n_Your votes will be confirmed automatically once payment is approved._`;

  const buttons = [
    [
      {
        text: `💳 Pay GH₵${totalGhs} with MoMo / Card ↗`,
        url: authUrl,
      },
    ],
    [
      {
        text: "❌ Cancel Vote",
        callback_data: "cancel",
      },
    ],
  ];

  const nomineePhotoUrl = await getSignedImageUrl(nominee.image_path);
  if (nomineePhotoUrl) {
    await sendTelegramPhoto(chatId, nomineePhotoUrl, checkoutMsg, {
      reply_markup: { inline_keyboard: buttons },
    });
  } else {
    await sendTelegramMessage(chatId, checkoutMsg, {
      reply_markup: { inline_keyboard: buttons },
    });
  }
}

async function handleFreeTelegramVote(params: {
  chatId: number;
  phone: string;
  phoneHash: string;
  event: { id: string; name: string; free_vote_limit_per_phone: number | null };
  category: { id: string; name: string };
  nominee: { id: string; name: string; image_path?: string | null };
  quantity: number;
}): Promise<void> {
  const db = paymentAdmin();
  const { chatId, phone, phoneHash, event, category, nominee, quantity } = params;

  const userId = await resolveTelegramVoterUserId(db, phone);
  if (!userId) {
    await sendTelegramMessage(chatId, "❌ Unable to verify voter identity. Please try voting via the website.");
    return;
  }

  const { data: eligibility } = await db.rpc("check_whatsapp_voter_eligibility", {
    p_user: userId,
    p_event: event.id,
    p_phone: phone,
  });

  if (eligibility && eligibility.eligible === false) {
    if (eligibility.reason === "requires_invite_code") {
      await db
        .from("telegram_sessions")
        .update({
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
          updated_at: new Date().toISOString(),
        })
        .eq("chat_id", chatId)
        .neq("state", "completed");

      await sendTelegramMessage(
        chatId,
        `🎟️ *Access Code Required*\n\nVoting for *${nominee.name}* in *${event.name}* is private and requires a 1-time Invite Code from the organizer.\n\nPlease reply with your *Access Code* (e.g. VIP-8492) to cast your vote (or reply *0* to cancel):`,
      );
      return;
    }

    if (eligibility.reason === "requires_identifier") {
      await db
        .from("telegram_sessions")
        .update({
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
          updated_at: new Date().toISOString(),
        })
        .eq("chat_id", chatId)
        .neq("state", "completed");

      await sendTelegramMessage(
        chatId,
        `📋 *Voter Roll Verification*\n\nVoting for *${nominee.name}* in *${event.name}* is restricted to registered members on the official voter roll.\n\nPlease reply with your *Student ID, Index Number, Member ID, or Email* (e.g. 10892341) to verify your eligibility (or reply *0* to cancel):`,
      );
      return;
    }

    if (eligibility.reason === "limit_exhausted") {
      await sendTelegramMessage(
        chatId,
        `⚠️ You have already used all your allocated votes (${eligibility.max_votes ?? 1}) for this category.`,
      );
      return;
    }
  }

  // Cast verified free vote via Supabase RPC
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
      await sendTelegramMessage(
        chatId,
        `⚠️ You have already reached your free vote limit for *${category.name}*. Each voter is allowed ${event.free_vote_limit_per_phone ?? 1} free vote(s).`,
      );
    } else if (errText.includes("open") || errText.includes("closed")) {
      await sendTelegramMessage(chatId, "⏳ Voting has ended for this event. Your vote was not recorded.");
    } else {
      await sendTelegramMessage(chatId, "❌ Your vote could not be recorded. Please check event rules or try later.");
    }
    return;
  }

  const nomineePhotoUrl = await getSignedImageUrl(nominee.image_path);
  const successText = `✅ *Vote Cast Successfully!* 🎉\n\nYou voted for *${nominee.name}* in *${category.name}* (${event.name}).\nQuantity: *${quantity} vote(s)*.\n\nThank you for making your voice count!`;

  if (nomineePhotoUrl) {
    await sendTelegramPhoto(chatId, nomineePhotoUrl, successText);
  } else {
    await sendTelegramMessage(chatId, successText);
  }
}

async function handleInviteCodeVerification(params: {
  chatId: number;
  code: string;
  session: any;
}): Promise<void> {
  const db = paymentAdmin();
  const { chatId, code, session } = params;

  const phone = session.phone || `tg_${session.chat_id}`;
  const userId = await resolveTelegramVoterUserId(db, phone);
  if (!userId) {
    await sendTelegramMessage(chatId, "❌ Voter verification failed. Please try again or vote via the website.");
    return;
  }

  const { data: redeemResult, error: redeemError } = await db.rpc("redeem_whatsapp_invite_code", {
    p_user: userId,
    p_event: session.event_id,
    p_code: code.trim(),
  });

  if (redeemError || !redeemResult || redeemResult.success !== true) {
    const errorMsg = redeemResult?.error || "Invalid or already used invite code.";
    await sendTelegramMessage(
      chatId,
      `❌ ${errorMsg}\n\nPlease check the code and try again, or reply *0* to cancel:`,
    );
    return;
  }

  await db
    .from("telegram_sessions")
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
    await sendTelegramMessage(chatId, "❌ Your vote could not be recorded after redeeming the code. Please try again.");
    return;
  }

  const nomineeName = session.metadata?.nominee_name || "your candidate";
  const categoryName = session.metadata?.category_name || "the category";
  const eventName = session.metadata?.event_name || "this event";
  const nomineeImagePath = session.metadata?.nominee_image_path;

  const successText = `🎟️ *Invite Code Verified!* ✅\n\nYour vote has been recorded for *${nomineeName}* in *${categoryName}* (${eventName}).\nQuantity: *${quantity} vote(s)*.\n\nThank you for participating!`;

  const nomineePhotoUrl = await getSignedImageUrl(nomineeImagePath);
  if (nomineePhotoUrl) {
    await sendTelegramPhoto(chatId, nomineePhotoUrl, successText);
  } else {
    await sendTelegramMessage(chatId, successText);
  }
}

async function handleVoterIdVerification(params: {
  chatId: number;
  identifier: string;
  session: any;
}): Promise<void> {
  const db = paymentAdmin();
  const { chatId, identifier, session } = params;

  const phone = session.phone || `tg_${session.chat_id}`;
  const userId = await resolveTelegramVoterUserId(db, phone);
  if (!userId) {
    await sendTelegramMessage(chatId, "❌ Voter verification failed. Please try again or vote via the website.");
    return;
  }

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
      await sendTelegramMessage(
        chatId,
        `❌ The email *${cleanEmail}* was not found on the approved voter roll for this event. Please check spelling or reply *0* to cancel:`,
      );
      return;
    }

    if (rosterEntry.redeemed_by && rosterEntry.redeemed_by !== userId) {
      await sendTelegramMessage(chatId, `❌ The email *${cleanEmail}* has already been used to vote in this election.`);
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

    await db
      .from("telegram_sessions")
      .update({
        state: "awaiting_email_otp",
        metadata: {
          ...(session.metadata || {}),
          pending_email: cleanEmail,
          voter_label: rosterEntry.label || cleanEmail,
        },
        updated_at: new Date().toISOString(),
      })
      .eq("id", session.id);

    await sendTelegramMessage(
      chatId,
      `✉️ *Verification Code Sent!*\n\nWe sent a 6-digit verification code to *${cleanEmail}*.\n\nPlease check your email inbox and reply with the *6-digit code* here to cast your vote (or reply *0* to cancel):`,
    );
    return;
  }

  // Handle Student / Staff ID lookup
  const cleanId = identifier.trim();
  const idHash = createHash("sha256").update(cleanId.toLowerCase()).digest("hex");

  const { data: rosterEntry } = await db
    .from("event_voter_list_entries")
    .select("id, label, redeemed_by, claim_code_hash")
    .eq("event_id", session.event_id)
    .eq("identifier_type", "voter_id")
    .eq("identifier_hash", idHash)
    .maybeSingle();

  if (!rosterEntry) {
    await sendTelegramMessage(
      chatId,
      `❌ The identifier *${cleanId}* was not found on the approved voter list. Please recheck or reply *0* to cancel:`,
    );
    return;
  }

  if (rosterEntry.redeemed_by && rosterEntry.redeemed_by !== userId) {
    await sendTelegramMessage(chatId, `❌ The identifier *${cleanId}* has already been used to vote in this election.`);
    return;
  }

  if (rosterEntry.claim_code_hash) {
    await db
      .from("telegram_sessions")
      .update({
        state: "awaiting_claim_code",
        metadata: {
          ...(session.metadata || {}),
          voter_identifier: cleanId,
          voter_label: rosterEntry.label || cleanId,
        },
        updated_at: new Date().toISOString(),
      })
      .eq("id", session.id);

    await sendTelegramMessage(
      chatId,
      `🔐 *Voting PIN Required*\n\nIdentity *${rosterEntry.label || cleanId}* found.\nPlease reply with your *4-digit voting PIN / claim code* provided by the organizer (or reply *0* to cancel):`,
    );
    return;
  }

  // Direct redemption without PIN
  const { data: redeemResult, error: redeemError } = await db.rpc("redeem_whatsapp_voter_id", {
    p_user: userId,
    p_event: session.event_id,
    p_identifier: cleanId,
    p_claim_code: null,
  });

  if (redeemError || !redeemResult || redeemResult.success !== true) {
    await sendTelegramMessage(chatId, `❌ ${redeemResult?.error || "Unable to redeem voter ID."}`);
    return;
  }

  await db.from("telegram_sessions").update({ state: "completed", updated_at: new Date().toISOString() }).eq("id", session.id);

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
    await sendTelegramMessage(chatId, "❌ Your vote could not be recorded after verifying your voter ID.");
    return;
  }

  const nomineeName = session.metadata?.nominee_name || "your candidate";
  const categoryName = session.metadata?.category_name || "the category";
  const eventName = session.metadata?.event_name || "this event";
  const voterLabel = redeemResult.label || cleanId;
  const nomineeImagePath = session.metadata?.nominee_image_path;

  const successText = `📋 *Voter Identity Verified!* ✅\n\nIdentity *${voterLabel}* confirmed on the official roll.\nYour vote has been recorded for *${nomineeName}* in *${categoryName}* (${eventName}).\nQuantity: *${quantity} vote(s)*.\n\nThank you for casting your verified ballot!`;

  const nomineePhotoUrl = await getSignedImageUrl(nomineeImagePath);
  if (nomineePhotoUrl) {
    await sendTelegramPhoto(chatId, nomineePhotoUrl, successText);
  } else {
    await sendTelegramMessage(chatId, successText);
  }
}

async function handleClaimCodeVerification(params: {
  chatId: number;
  claimCode: string;
  session: any;
}): Promise<void> {
  const db = paymentAdmin();
  const { chatId, claimCode, session } = params;

  const phone = session.phone || `tg_${session.chat_id}`;
  const userId = await resolveTelegramVoterUserId(db, phone);
  if (!userId) {
    await sendTelegramMessage(chatId, "❌ Voter verification failed. Please try again.");
    return;
  }

  const voterIdentifier = session.metadata?.voter_identifier;
  if (!voterIdentifier) {
    await sendTelegramMessage(chatId, "❌ Session error. Send /events to restart.");
    return;
  }

  const { data: redeemResult, error: redeemError } = await db.rpc("redeem_whatsapp_voter_id", {
    p_user: userId,
    p_event: session.event_id,
    p_identifier: voterIdentifier,
    p_claim_code: claimCode.trim(),
  });

  if (redeemError || !redeemResult || redeemResult.success !== true) {
    await sendTelegramMessage(chatId, `❌ ${redeemResult?.error || "Incorrect voting PIN / claim code."}\nPlease try again or reply *0* to cancel:`);
    return;
  }

  await db.from("telegram_sessions").update({ state: "completed", updated_at: new Date().toISOString() }).eq("id", session.id);

  const voteRequest = randomUUID();
  const quantity = session.quantity || 1;
  await db.rpc("cast_verified_whatsapp_vote", {
    p_user: userId,
    p_event: session.event_id,
    p_category: session.category_id,
    p_nominee: session.nominee_id,
    p_quantity: quantity,
    p_request: voteRequest,
  });

  const nomineeName = session.metadata?.nominee_name || "your candidate";
  const categoryName = session.metadata?.category_name || "the category";
  const eventName = session.metadata?.event_name || "this event";
  const voterLabel = redeemResult.label || voterIdentifier;
  const nomineeImagePath = session.metadata?.nominee_image_path;

  const successText = `🔐 *Voter PIN Confirmed!* ✅\n\nIdentity *${voterLabel}* verified on the official roll.\nYour vote has been recorded for *${nomineeName}* in *${categoryName}* (${eventName}).\nQuantity: *${quantity} vote(s)*.\n\nThank you for casting your verified ballot!`;

  const nomineePhotoUrl = await getSignedImageUrl(nomineeImagePath);
  if (nomineePhotoUrl) {
    await sendTelegramPhoto(chatId, nomineePhotoUrl, successText);
  } else {
    await sendTelegramMessage(chatId, successText);
  }
}

async function handleEmailOtpVerification(params: {
  chatId: number;
  otp: string;
  session: any;
}): Promise<void> {
  const db = paymentAdmin();
  const { chatId, otp, session } = params;

  const cleanOtp = otp.trim().replace(/\D/g, "");
  if (cleanOtp.length < 6 || cleanOtp.length > 8) {
    await sendTelegramMessage(chatId, "Please enter the 6-digit verification code sent to your email (or reply *0* to cancel):");
    return;
  }

  const phone = session.phone || `tg_${session.chat_id}`;
  const userId = await resolveTelegramVoterUserId(db, phone);
  if (!userId) {
    await sendTelegramMessage(chatId, "❌ Voter verification failed. Please try again.");
    return;
  }

  const pendingEmail = session.metadata?.pending_email;
  if (!pendingEmail) {
    await sendTelegramMessage(chatId, "❌ Session error. Send /events to restart.");
    return;
  }

  const authClient = getAuthClient();
  const { error: verifyError } = await authClient.auth.verifyOtp({
    email: pendingEmail,
    token: cleanOtp,
    type: "email",
  });

  if (verifyError) {
    await sendTelegramMessage(chatId, "❌ That code is invalid or has expired. Please check your email and try again, or reply *0* to cancel:");
    return;
  }

  await db.rpc("redeem_whatsapp_voter_id", {
    p_user: userId,
    p_event: session.event_id,
    p_identifier: pendingEmail,
    p_claim_code: null,
  });

  await db.from("telegram_sessions").update({ state: "completed", updated_at: new Date().toISOString() }).eq("id", session.id);

  const voteRequest = randomUUID();
  const quantity = session.quantity || 1;
  await db.rpc("cast_verified_whatsapp_vote", {
    p_user: userId,
    p_event: session.event_id,
    p_category: session.category_id,
    p_nominee: session.nominee_id,
    p_quantity: quantity,
    p_request: voteRequest,
  });

  const nomineeName = session.metadata?.nominee_name || "your candidate";
  const categoryName = session.metadata?.category_name || "the category";
  const eventName = session.metadata?.event_name || "this event";
  const voterLabel = session.metadata?.voter_label || pendingEmail;
  const nomineeImagePath = session.metadata?.nominee_image_path;

  const successText = `🎓 *Email Verified & Vote Recorded!* ✅\n\nIdentity *${voterLabel}* confirmed on the official roll.\nYour vote has been recorded for *${nomineeName}* in *${categoryName}* (${eventName}).\nQuantity: *${quantity} vote(s)*.\n\nThank you for casting your verified ballot!`;

  const nomineePhotoUrl = await getSignedImageUrl(nomineeImagePath);
  if (nomineePhotoUrl) {
    await sendTelegramPhoto(chatId, nomineePhotoUrl, successText);
  } else {
    await sendTelegramMessage(chatId, successText);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Telegram Ticketing Helpers
// ─────────────────────────────────────────────────────────────────────────────

async function presentTelegramTicketsList(chatId: number): Promise<void> {
  const db = paymentAdmin();
  const nowIso = new Date().toISOString();

  const { data: ticketEvents } = await db
    .from("events")
    .select("id, name, slug, venue_name, doors_open_time, image_path, ends_at")
    .in("event_type", ["ticketing", "hybrid"])
    .eq("status", "published")
    .gt("ends_at", nowIso)
    .order("created_at", { ascending: false })
    .limit(8);

  if (!ticketEvents || ticketEvents.length === 0) {
    await sendTelegramMessage(
      chatId,
      `🎟️ *VoteCastHub Event Tickets*\n\nThere are currently no active ticketed events open for booking.\n\nSend /events to browse ongoing voting competitions.`,
      {
        reply_markup: {
          inline_keyboard: [[{ text: "🏆 View Competitions", callback_data: "events" }]],
        },
      }
    );
    return;
  }

  const buttons = ticketEvents.map((ev) => [
    {
      text: `🎟️ ${ev.name}`.slice(0, 36),
      callback_data: `ticket:${ev.id}`,
    },
  ]);

  buttons.push([{ text: "🔍 My Purchased Tickets", callback_data: "mytickets" }]);

  const welcomeText =
    `🎟️ *VoteCastHub Event Tickets & Passes* 🎫\n\n` +
    `Explore upcoming live events, award dinners, and concerts below. Tap an event to select your pass:`;

  const coverUrl = await getSignedImageUrl(ticketEvents[0]?.image_path);
  if (coverUrl) {
    await sendTelegramPhoto(chatId, coverUrl, welcomeText, {
      reply_markup: { inline_keyboard: buttons },
    });
  } else {
    await sendTelegramMessage(chatId, welcomeText, {
      reply_markup: { inline_keyboard: buttons },
    });
  }
}

async function presentEventTicketTiers(params: { chatId: number; eventIdentifier: string }): Promise<void> {
  const db = paymentAdmin();
  const { chatId, eventIdentifier } = params;

  let query = db
    .from("events")
    .select("id, name, slug, venue_name, doors_open_time, status, image_path, ends_at");

  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (uuidPattern.test(eventIdentifier)) {
    query = query.eq("id", eventIdentifier);
  } else {
    query = query.eq("slug", eventIdentifier);
  }

  const { data: event, error: eventErr } = await query.maybeSingle();

  if (eventErr || !event) {
    await sendTelegramMessage(chatId, `❌ Event not found or expired. Send /tickets to view upcoming events.`);
    return;
  }

  const { data: tiers, error: tiersErr } = await db
    .from("event_ticket_tiers")
    .select("id, name, description, price_minor, capacity, sold_count, is_active")
    .eq("event_id", event.id)
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("price_minor", { ascending: true });

  if (tiersErr || !tiers || tiers.length === 0) {
    await sendTelegramMessage(chatId, `❌ No active ticket tiers found for *${event.name}*.`);
    return;
  }

  // Create or update active session
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  await db
    .from("telegram_sessions")
    .delete()
    .eq("chat_id", chatId)
    .neq("state", "completed");

  await db.from("telegram_sessions").insert({
    chat_id: chatId,
    telegram_user_id: chatId,
    event_id: event.id,
    state: "awaiting_ticket_tier",
    metadata: { step: "awaiting_ticket_tier" },
    expires_at: expiresAt,
  });

  const buttons: { text: string; callback_data: string }[][] = [];
  let descriptionText = `🎟️ *${event.name} — Admission Tickets*\n`;
  if (event.venue_name) descriptionText += `📍 *Venue:* ${event.venue_name}\n`;
  if (event.doors_open_time) descriptionText += `🚪 *Doors Open:* ${event.doors_open_time}\n`;
  descriptionText += `\n*Available Ticket Tiers:*\n`;

  tiers.forEach((t, index) => {
    const remaining = Math.max(0, t.capacity - t.sold_count);
    const isSoldOut = remaining <= 0;
    const priceStr = t.price_minor === 0 ? "FREE" : `GH₵ ${(Number(t.price_minor) / 100).toFixed(2)}`;
    const statusNote = isSoldOut ? " [SOLD OUT]" : remaining <= 10 ? ` (${remaining} left)` : "";

    descriptionText += `\n${index + 1}. *${t.name}* — ${priceStr}${statusNote}`;
    if (t.description) descriptionText += `\n   _${t.description}_`;

    if (!isSoldOut) {
      buttons.push([
        {
          text: `🎫 ${t.name} — ${priceStr}${statusNote}`,
          callback_data: `tiktier:${t.id}`,
        },
      ]);
    }
  });

  descriptionText += `\n\nTap a tier above or reply with the tier number (e.g. *1*) to continue:`;

  const coverUrl = await getSignedImageUrl(event.image_path);
  if (coverUrl) {
    await sendTelegramPhoto(chatId, coverUrl, descriptionText, {
      reply_markup: { inline_keyboard: buttons },
    });
  } else {
    await sendTelegramMessage(chatId, descriptionText, {
      reply_markup: { inline_keyboard: buttons },
    });
  }
}

async function selectTicketTierTelegram(params: {
  chatId: number;
  tierId: string;
  activeSession: any;
  userId: number;
  fromUser?: { first_name?: string; last_name?: string; username?: string };
}): Promise<void> {
  const db = paymentAdmin();
  const { chatId, tierId, activeSession, userId, fromUser } = params;

  const { data: tier, error: tierErr } = await db
    .from("event_ticket_tiers")
    .select("id, event_id, name, description, price_minor, capacity, sold_count, is_active, events(id, name, venue_name)")
    .eq("id", tierId)
    .single();

  if (tierErr || !tier) {
    await sendTelegramMessage(chatId, "❌ Selected ticket tier not found. Send /tickets to restart.");
    return;
  }

  const remaining = Math.max(0, tier.capacity - tier.sold_count);
  if (remaining <= 0) {
    await sendTelegramMessage(chatId, `❌ Sorry, *${tier.name}* is sold out. Please select another tier.`);
    return;
  }

  const eventObj = tier.events as any;
  const priceStr = tier.price_minor === 0 ? "FREE" : `GH₵ ${(Number(tier.price_minor) / 100).toFixed(2)}`;

  let sessionId = activeSession?.id;
  if (!sessionId) {
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    const { data: created } = await db
      .from("telegram_sessions")
      .insert({
        chat_id: chatId,
        telegram_user_id: userId,
        event_id: tier.event_id,
        tier_id: tier.id,
        state: "awaiting_ticket_quantity",
        metadata: { step: "awaiting_ticket_quantity" },
        expires_at: expiresAt,
      })
      .select("id")
      .single();
    sessionId = created?.id;
  } else {
    await db
      .from("telegram_sessions")
      .update({
        tier_id: tier.id,
        state: "awaiting_ticket_quantity",
        metadata: { ...activeSession?.metadata, step: "awaiting_ticket_quantity" },
        updated_at: new Date().toISOString(),
      })
      .eq("id", sessionId);
  }

  const promptText =
    `🎫 *${tier.name}* (${priceStr} each)\n` +
    `📌 Event: *${eventObj?.name || "Event"}*\n\n` +
    `How many tickets would you like to purchase?\n` +
    `Select below or reply with a number (1-20):`;

  const qtyButtons = [
    [
      { text: "1 Ticket", callback_data: "tikqty:1" },
      { text: "2 Tickets", callback_data: "tikqty:2" },
      { text: "3 Tickets", callback_data: "tikqty:3" },
    ],
    [
      { text: "4 Tickets", callback_data: "tikqty:4" },
      { text: "5 Tickets", callback_data: "tikqty:5" },
      { text: "✏️ Other Qty", callback_data: "custom_tikqty" },
    ],
  ];

  await sendTelegramMessage(chatId, promptText, {
    reply_markup: { inline_keyboard: qtyButtons },
  });
}

async function handleTicketQuantityTelegram(params: {
  chatId: number;
  quantity: number;
  activeSession: any;
  userId: number;
  fromUser?: { first_name?: string; last_name?: string; username?: string };
}): Promise<void> {
  const db = paymentAdmin();
  const { chatId, quantity, activeSession, userId, fromUser } = params;

  if (quantity < 1 || quantity > 20) {
    await sendTelegramMessage(chatId, "⚠️ Please enter a quantity between 1 and 20 tickets:");
    return;
  }

  if (!activeSession || !activeSession.tier_id || !activeSession.event_id) {
    await sendTelegramMessage(chatId, "❌ Session expired. Please send /tickets to restart.");
    return;
  }

  // Check capacity
  const { data: tier } = await db
    .from("event_ticket_tiers")
    .select("capacity, sold_count, name")
    .eq("id", activeSession.tier_id)
    .single();

  if (tier) {
    const remaining = Math.max(0, tier.capacity - tier.sold_count);
    if (quantity > remaining) {
      await sendTelegramMessage(
        chatId,
        `⚠️ Only *${remaining}* ticket${remaining === 1 ? "" : "s"} remaining for *${tier.name}*. Please enter ${remaining} or fewer:`,
      );
      return;
    }
  }

  await db
    .from("telegram_sessions")
    .update({
      quantity,
      state: "awaiting_ticket_name",
      metadata: { ...activeSession.metadata, step: "awaiting_ticket_name" },
      updated_at: new Date().toISOString(),
    })
    .eq("id", activeSession.id);

  const suggestedName = [fromUser?.first_name, fromUser?.last_name].filter(Boolean).join(" ") || fromUser?.username || "";

  const nameButtons: { text: string; callback_data: string }[][] = [];
  if (suggestedName && suggestedName.length >= 2) {
    nameButtons.push([{ text: `👤 Use Profile Name: "${suggestedName}"`, callback_data: "tikname:profile" }]);
  }

  await sendTelegramMessage(
    chatId,
    `👤 *Attendee Information*\n\n` +
    `Please reply with the *Full Name* of the ticket holder (to appear on the pass and check-in scanner):` +
    (suggestedName ? `\n\nOr tap below to use your Telegram profile name:` : ""),
    {
      reply_markup: nameButtons.length > 0 ? { inline_keyboard: nameButtons } : undefined,
    }
  );
}

async function handleTicketNameTelegram(params: {
  chatId: number;
  name: string;
  activeSession: any;
  userId: number;
  fromUser?: { first_name?: string; last_name?: string; username?: string };
}): Promise<void> {
  const db = paymentAdmin();
  const { chatId, name, activeSession, userId, fromUser } = params;

  let resolvedName = name.trim();
  if (resolvedName === "profile") {
    resolvedName = [fromUser?.first_name, fromUser?.last_name].filter(Boolean).join(" ") || fromUser?.username || "Guest";
  }

  if (resolvedName.length < 2) {
    await sendTelegramMessage(chatId, "⚠️ Please enter a valid name with at least 2 characters:");
    return;
  }

  if (!activeSession || !activeSession.event_id || !activeSession.tier_id || !activeSession.quantity) {
    await sendTelegramMessage(chatId, "❌ Session expired. Please send /tickets to restart.");
    return;
  }

  await db
    .from("telegram_sessions")
    .update({
      customer_name: resolvedName,
      state: "awaiting_ticket_phone",
      updated_at: new Date().toISOString(),
    })
    .eq("id", activeSession.id);

  await sendTelegramMessage(
    chatId,
    `👤 *Attendee:* ${resolvedName}\n\n` +
    `📱 Please reply with your *Ghana Phone Number* (e.g. *0244123456* or *0551234567*) to receive your instant SMS pass and Mobile Money prompt:\n\n` +
    `_(Reply 0 to cancel)_`
  );
}

async function handleTicketCheckoutTelegram(params: {
  chatId: number;
  eventId: string;
  tierId: string;
  quantity: number;
  customerName: string;
  phone?: string;
  userId: number;
  existingSessionId?: string;
}): Promise<void> {
  const db = paymentAdmin();
  const { chatId, eventId, tierId, quantity, customerName, phone, userId, existingSessionId } = params;

  // 1. Fetch Event
  const { data: event, error: eventErr } = await db
    .from("events")
    .select("id, organization_id, name, venue_name, status, starts_at, ends_at")
    .eq("id", eventId)
    .maybeSingle();

  if (eventErr || !event || event.status === "closed") {
    await sendTelegramMessage(chatId, "❌ This event is currently closed or unavailable.");
    return;
  }

  // 2. Fetch Tier
  const { data: tier, error: tierErr } = await db
    .from("event_ticket_tiers")
    .select("id, name, price_minor, capacity, sold_count, is_active")
    .eq("id", tierId)
    .eq("event_id", eventId)
    .eq("is_active", true)
    .maybeSingle();

  if (tierErr || !tier) {
    await sendTelegramMessage(chatId, "❌ This ticket tier is no longer active.");
    return;
  }

  if (tier.sold_count + quantity > tier.capacity) {
    const remaining = Math.max(0, tier.capacity - tier.sold_count);
    await sendTelegramMessage(chatId, `❌ Sold out! Only ${remaining} ticket${remaining === 1 ? "" : "s"} remaining in this tier.`);
    return;
  }

  const totalMinor = Number(tier.price_minor) * quantity;
  const buyerPhone = phone && phone.length >= 9 ? phone : `+233000000000`;
  const buyerEmail = phone && phone.length >= 9
    ? `${normalizeGhanaPhone(phone)}@tickets.votecasthub.com`
    : `tg_${userId}@telegram.votecasthub.com`;

  // Free Ticket: issue immediately
  if (totalMinor === 0) {
    const { data: ticket, error: purchaseErr } = await db.rpc("purchase_event_ticket", {
      p_event_id: eventId,
      p_tier_id: tierId,
      p_quantity: quantity,
      p_customer_name: customerName,
      p_customer_phone: buyerPhone,
      p_customer_email: buyerEmail,
      p_order_reference: null,
      p_channel: "telegram",
      p_initial_status: "valid",
    });

    if (purchaseErr) {
      await sendTelegramMessage(chatId, `❌ Error reserving free pass: ${purchaseErr.message}`);
      return;
    }

    if (existingSessionId) {
      await db.from("telegram_sessions").update({ state: "completed", updated_at: new Date().toISOString() }).eq("id", existingSessionId);
    }

    const ticketObj = ticket as Record<string, unknown>;
    const allCodes = Array.isArray(ticketObj?.pax_codes) && (ticketObj.pax_codes as string[]).length > 0
      ? (ticketObj.pax_codes as string[])
      : [String(ticketObj?.pax_code || "PAX")];
    const passUrl = `${siteUrl()}/tickets?q=${encodeURIComponent(allCodes[0])}`;

    if (buyerPhone && buyerPhone !== "+233000000000") {
      sendTicketConfirmationSms({
        phone: buyerPhone,
        customerName,
        eventName: event.name,
        tierName: tier.name,
        paxCode: allCodes,
        venueName: event.venue_name,
      }).catch(() => {});
    }

    const codesList = allCodes.length === 1
      ? `🔑 *CODE PAX:* \`#${allCodes[0]}\``
      : allCodes.map((c, i) => `🔑 *Pass #${i + 1} CODE PAX:* \`#${c}\``).join("\n");

    await sendTelegramMessage(
      chatId,
      `🎉 *Your Free Ticket Is Confirmed!* 🎟️\n\n` +
      `📌 *${event.name}*\n` +
      `👤 *Attendee:* ${customerName}\n` +
      `🎫 *Tier:* ${tier.name} (${quantity} Pass${quantity > 1 ? "es" : ""})\n` +
      `${codesList}\n` +
      `📍 *Venue:* ${event.venue_name || "Event Venue"}\n\n` +
      `📱 *SMS pass dispatched to:* ${buyerPhone}\n` +
      `🔗 *Digital Pass & QR Codes:*\n👉 ${passUrl}\n\n` +
      `_Show your CODE PAX or digital pass at the entrance gate._`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: "🎫 Open Digital Passes", url: passUrl }],
            [{ text: "🎟️ Browse More Events", callback_data: "browse_tickets" }],
          ],
        },
      }
    );
    return;
  }

  // Paid Ticket: Initialize Paystack
  const { data: account } = await db
    .from("organization_paystack_accounts")
    .select("subaccount_code")
    .eq("organization_id", event.organization_id)
    .eq("status", "active")
    .eq("paystack_verified", true)
    .maybeSingle();

  const orderRef = `VCH-TIK-${randomUUID().replaceAll("-", "")}`;

  // Atomically reserve ticket with status 'pending'
  const { error: reserveErr } = await db.rpc("purchase_event_ticket", {
    p_event_id: eventId,
    p_tier_id: tierId,
    p_quantity: quantity,
    p_customer_name: customerName,
    p_customer_phone: buyerPhone,
    p_customer_email: buyerEmail,
    p_order_reference: orderRef,
    p_channel: "telegram",
    p_initial_status: "pending",
  });

  if (reserveErr) {
    await sendTelegramMessage(chatId, `❌ Could not reserve ticket: ${reserveErr.message}`);
    return;
  }

  const origin = siteUrl();
  const totalGhs = (totalMinor / 100).toFixed(2);
  const subaccountParams = account?.subaccount_code
    ? {
        subaccount: account.subaccount_code,
        bearer: "account" as const,
        transaction_charge: Math.floor(totalMinor / 10), // 10% platform fee
      }
    : {};

  let authUrl = "";
  try {
    const paystackRes = await paystack<{ authorization_url: string }>("/transaction/initialize", {
      reference: orderRef,
      email: buyerEmail,
      amount: totalMinor,
      currency: "GHS",
      ...subaccountParams,
      callback_url: `${origin}/payments/complete?reference=${orderRef}`,
      metadata: {
        kind: "paid_ticket",
        channel: "telegram",
        chat_id: chatId,
        phone: buyerPhone,
        telegram_user_id: userId,
        order_reference: orderRef,
        event_id: eventId,
        tier_id: tierId,
        quantity,
        customer_name: customerName,
        customer_phone: buyerPhone,
      },
    });

    const parsedUrl = new URL(paystackRes.authorization_url);
    if (parsedUrl.protocol !== "https:" || parsedUrl.hostname !== "checkout.paystack.com") {
      throw new Error("Invalid checkout domain returned by Paystack");
    }
    authUrl = parsedUrl.href;
  } catch (err) {
    console.error("tg_ticket_paystack_init_failed:", err);
    await sendTelegramMessage(chatId, "❌ Failed to initiate Paystack checkout. Please try again shortly.");
    return;
  }

  if (existingSessionId) {
    await db
      .from("telegram_sessions")
      .update({
        reference: orderRef,
        payment_url: authUrl,
        state: "awaiting_payment",
        customer_name: customerName,
        quantity,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existingSessionId);
  }

  await sendTelegramMessage(
    chatId,
    `🎟️ *Ticket Checkout — ${event.name}*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `🎫 *Tier:* ${tier.name}\n` +
    `👥 *Quantity:* ${quantity} Pass${quantity > 1 ? "es" : ""}\n` +
    `👤 *Attendee:* ${customerName}\n` +
    `💰 *Total Amount:* GH₵ ${totalGhs}\n\n` +
    `📱 *Pay with Mobile Money (MTN / Telecel / AT) or Card:*\n` +
    `Tap the secure button below to complete payment:`,
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: `💳 Complete Payment (GH₵ ${totalGhs})`, url: authUrl }],
          [{ text: "❌ Cancel", callback_data: "cancel_ticket" }],
        ],
      },
    }
  );
}

async function handleMyTicketsTelegram(chatId: number, queryPhone?: string): Promise<void> {
  const db = paymentAdmin();
  if (queryPhone) {
    const { data: myTickets } = await db.rpc("find_public_tickets", { p_query: queryPhone });
    const list = (myTickets ?? []) as Record<string, unknown>[];

    if (list.length > 0) {
      let reply = `🎟️ *Your Event Passes (${list.length})*\n\n`;
      for (const t of list) {
        reply += `📌 *${t.event_name}*\n`;
        reply += `👤 Holder: ${t.customer_name}\n`;
        reply += `🎫 Tier: ${t.tier_name} (${t.quantity} Person)\n`;
        reply += `🔑 *CODE PAX: #${t.pax_code}*\n`;
        reply += `📍 Venue: ${t.venue_name || "Event Venue"}\n`;
        reply += `🟢 Status: ${t.status === "checked_in" ? "✓ Checked In" : "Valid for Entry"}\n`;
        reply += `🔗 Digital Pass: ${siteUrl()}/tickets?q=${t.pax_code}\n\n`;
      }
      reply += `_Show your CODE PAX or QR code at the entrance for verification._`;
      await sendTelegramMessage(chatId, reply);
      return;
    }
  }

  await sendTelegramMessage(
    chatId,
    `🎟️ *Retrieve Your Event Tickets*\n\n` +
    `To look up your tickets, you can search with your Phone Number or CODE PAX on our web portal:\n` +
    `👉 ${siteUrl()}/tickets\n\n` +
    `Or send /tickets to browse upcoming events and get passes!`,
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: "🔍 Open Ticket Portal", url: `${siteUrl()}/tickets` }],
          [{ text: "🎟️ Browse Events", callback_data: "browse_tickets" }],
        ],
      },
    }
  );
}
