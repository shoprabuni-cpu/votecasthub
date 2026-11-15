import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { paymentAdmin } from "@/lib/payments/admin";
import { paystack } from "@/lib/payments/gateway";
import { createClient } from "@supabase/supabase-js";
import {
  answerTelegramCallbackQuery,
  sendTelegramMessage,
  sendTelegramPhoto,
} from "./api";
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

  // 3. Fetch Active Session
  const { data: activeSession } = await db
    .from("telegram_sessions")
    .select("id, chat_id, telegram_user_id, phone, phone_hash, event_id, category_id, nominee_id, quantity, state, reference, payment_url, metadata, expires_at")
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
    const qtyParsed = parseInt(cleanQty, 10);
    if (!qtyParsed || qtyParsed < 1 || qtyParsed > 10000) {
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

  const welcomeText = `🏆 *Welcome to VoteCastHub!* 🗳️\n\nTap an ongoing competition below to view contestants and cast your ballot:`;

  const coverUrl = await getSignedImageUrl(events[0]?.image_path);
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

async function presentEventBallot(params: {
  chatId: number;
  eventIdentifier: string;
  nomineeIdentifier?: string;
}): Promise<void> {
  const db = paymentAdmin();
  const { chatId, eventIdentifier, nomineeIdentifier } = params;

  let query = db
    .from("events")
    .select("id, name, slug, voting_mode, unit_price_minor, free_vote_limit_per_phone, verification_method, starts_at, ends_at, status, image_path");

  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (uuidPattern.test(eventIdentifier)) {
    query = query.eq("id", eventIdentifier);
  } else {
    query = query.eq("slug", eventIdentifier);
  }

  const { data: event, error: eventErr } = await query.maybeSingle();

  if (eventErr || !event) {
    await sendTelegramMessage(
      chatId,
      `❌ Competition *${eventIdentifier}* was not found or has concluded.\nSend /events to see all ongoing competitions.`,
    );
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
