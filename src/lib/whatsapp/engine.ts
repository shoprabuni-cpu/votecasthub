import "server-only";
import { randomUUID, createHmac, createHash } from "node:crypto";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { paymentAdmin } from "@/lib/payments/admin";
import { paystack, siteUrl } from "@/lib/payments/gateway";
import { normalizeGhanaPhone, sendTicketConfirmationSms } from "@/lib/sms/send-ticket-sms";
import { sendWhatsAppMessage, sendWhatsAppInteractiveButtons, sendWhatsAppInteractiveList, sendWhatsAppImage } from "./sendazi";
import { loadPublicAwardsDirectory, loadEventPublicResults } from "@/lib/events/results";
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

  if (/^(CAT|CATEGORY)\b/i.test(text)) {
    const parts = text.split(/\s+/).filter(Boolean);
    const eventId = parts[1];
    const categoryId = parts[2];
    if (eventId && categoryId) {
      await presentWhatsAppCategoryBallotById({ phone, phoneHash, eventId, categoryId });
      return;
    }
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

    // 0a. Ticketing Step A: Awaiting ticket tier selection or event selection
    if (activeSession && activeSession.state === "awaiting_ticket_tier") {
      if (!["0", "CANCEL", "RESET", "HELP", "MENU", "VOTE"].includes(upperText)) {
        // If voter was choosing an event from the ticket events list
        if (activeSession.metadata?.step === "awaiting_ticket_event") {
          const eventsList = (activeSession.metadata?.events as Array<{ id: string; name: string; slug: string }>) || [];
          const num = parseInt(text.trim(), 10);
          let matchedEvent = null;
          if (!isNaN(num) && num >= 1 && num <= eventsList.length) {
            matchedEvent = eventsList[num - 1];
          } else {
            matchedEvent = eventsList.find(
              (e) =>
                e.slug.toLowerCase() === text.trim().toLowerCase() ||
                e.name.toLowerCase().includes(text.trim().toLowerCase())
            );
          }

          if (matchedEvent) {
            await presentWhatsAppEventTicketTiers(phone, matchedEvent.id);
            return;
          }
        }

        // Voter is choosing a ticket tier for an event
        if (activeSession.event_id) {
          const { data: rawTiers } = await db
            .from("event_ticket_tiers")
            .select("id, name, price_minor, capacity, sold_count, is_active")
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
              const remaining = Math.max(0, matchedTier.capacity - matchedTier.sold_count);
              if (remaining <= 0) {
                await sendWhatsAppMessage(phone, `❌ Sorry, *${matchedTier.name}* is sold out. Please reply with another tier number:`);
                return;
              }

              await db
                .from("whatsapp_sessions")
                .update({
                  tier_id: matchedTier.id,
                  state: "awaiting_ticket_quantity",
                  metadata: { ...activeSession.metadata, step: "awaiting_ticket_quantity", tier_name: matchedTier.name },
                  updated_at: new Date().toISOString(),
                })
                .eq("id", activeSession.id);

              const priceStr = matchedTier.price_minor === 0 ? "FREE" : `GH₵ ${(Number(matchedTier.price_minor) / 100).toFixed(2)}`;
              await sendWhatsAppMessage(
                phone,
                `🎫 *${matchedTier.name}* (${priceStr} each)\n\n` +
                `How many tickets would you like to purchase?\n` +
                `Reply with the quantity (e.g. *1*, *2*, *4* up to 20):`
              );
              return;
            }
          }
        }
      }
    }

    // 0b. Ticketing Step B: Awaiting ticket quantity
    if (activeSession && activeSession.state === "awaiting_ticket_quantity" && activeSession.event_id && activeSession.tier_id) {
      if (!["0", "CANCEL", "RESET", "HELP", "MENU", "VOTE"].includes(upperText)) {
        const cleanQty = text.replace(/\D/g, "");
        const qtyParsed = parseInt(cleanQty, 10);
        if (!qtyParsed || qtyParsed < 1 || qtyParsed > 20) {
          await sendWhatsAppMessage(phone, "⚠️ Please reply with a valid number of tickets between 1 and 20 (or 0 to cancel):");
          return;
        }

        // Verify remaining capacity
        const { data: tier } = await db
          .from("event_ticket_tiers")
          .select("capacity, sold_count, name")
          .eq("id", activeSession.tier_id)
          .single();

        if (tier) {
          const remaining = Math.max(0, tier.capacity - tier.sold_count);
          if (qtyParsed > remaining) {
            await sendWhatsAppMessage(
              phone,
              `⚠️ Only *${remaining}* ticket${remaining === 1 ? "" : "s"} remaining for *${tier.name}*. Please reply with ${remaining} or fewer:`,
            );
            return;
          }
        }

        await db
          .from("whatsapp_sessions")
          .update({
            quantity: qtyParsed,
            state: "awaiting_ticket_name",
            metadata: { ...activeSession.metadata, step: "awaiting_ticket_name" },
            updated_at: new Date().toISOString(),
          })
          .eq("id", activeSession.id);

        await sendWhatsAppMessage(
          phone,
          `👤 *Attendee Information*\n\n` +
          `Please reply with the *Full Name* of the ticket holder (to appear on the pass and check-in scanner):`
        );
        return;
      }
    }

    // 0c. Ticketing Step C: Awaiting ticket attendee name
    if (activeSession && activeSession.state === "awaiting_ticket_name" && activeSession.event_id && activeSession.tier_id && activeSession.quantity) {
      if (!["0", "CANCEL", "RESET", "HELP", "MENU", "VOTE"].includes(upperText)) {
        const nameInput = text.trim();
        if (nameInput.length < 2) {
          await sendWhatsAppMessage(phone, "⚠️ Please reply with a valid attendee name (at least 2 letters):");
          return;
        }

        await db
          .from("whatsapp_sessions")
          .update({
            customer_name: nameInput,
            updated_at: new Date().toISOString(),
          })
          .eq("id", activeSession.id);

        await handleTicketCheckoutWhatsApp({
          phone,
          eventId: activeSession.event_id,
          tierId: activeSession.tier_id,
          quantity: activeSession.quantity,
          customerName: nameInput,
          existingSessionId: activeSession.id,
        });
        return;
      }
    }

    // 1. If active session is awaiting category selection and voter replies with category number or name
    if (activeSession && activeSession.metadata?.step === "awaiting_category" && activeSession.event_id) {
      if (!["0", "CANCEL", "RESET", "HELP", "MENU", "VOTE"].includes(text.trim().toUpperCase())) {
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
            const { data: ev } = await db
              .from("events")
              .select("id, name, slug, voting_mode, unit_price_minor, free_vote_limit_per_phone, image_path, status, starts_at, ends_at")
              .eq("id", activeSession.event_id)
              .single();
            if (ev) {
              await presentWhatsAppCategoryBallot({
                phone,
                phoneHash,
                event: ev,
                category: matchedCat,
              });
              return;
            }
          }
        }
      }
    }

    // 2. If active session is awaiting candidate selection and voter replies with number, code or name
    if (activeSession && (activeSession.state === "awaiting_candidate" || activeSession.state === "idle") && activeSession.event_id) {
      if (!["0", "CANCEL", "RESET", "HELP", "MENU", "VOTE"].includes(text.trim().toUpperCase())) {
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
              if (sessionEvent.voting_mode === "free") {
                const totalLimit = Number(sessionEvent.free_vote_limit_per_phone) || 1;
                let remaining = totalLimit;
                const userId = await resolveWhatsAppVoterUserId(db, phone);
                if (userId) {
                  const { data: batches } = await db
                    .from("vote_batches")
                    .select("quantity")
                    .eq("voter_user_id", userId)
                    .eq("event_id", sessionEvent.id)
                    .is("payment_attempt_id", null);
                  const used = (batches || []).reduce((sum, b) => sum + (Number(b.quantity) || 1), 0);
                  remaining = Math.max(0, totalLimit - used);
                }

                if (remaining <= 0) {
                  await sendWhatsAppMessage(
                    phone,
                    `⚠️ You have already reached your free vote limit of *${totalLimit} vote(s)* for *${sessionEvent.name}*.`,
                  );
                  return;
                }

                if (remaining === 1) {
                  await handleFreeVote({
                    phone,
                    phoneHash,
                    event: sessionEvent,
                    category: matchedNom.category,
                    nominee: matchedNom,
                    quantity: 1,
                  });
                  return;
                }

                // If remaining > 1, prompt voter how many free votes to cast!
                const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
                await db
                  .from("whatsapp_sessions")
                  .update({
                    category_id: matchedNom.category.id,
                    nominee_id: matchedNom.id,
                    state: "awaiting_quantity",
                    metadata: {
                      mode: "free",
                      max_votes: remaining,
                      event_name: sessionEvent.name,
                      category_name: matchedNom.category.name,
                      nominee_name: matchedNom.name,
                      nominee_image_path: matchedNom.image_path,
                    },
                    expires_at: expiresAt,
                    updated_at: new Date().toISOString(),
                  })
                  .eq("id", activeSession.id);

                const nomPhoto = await getSignedImageUrl(matchedNom.image_path);
                const freePrompt =
                  `🗳️ *Free Vote for ${matchedNom.name}*\n` +
                  `• Category: *${matchedNom.category.name}*\n` +
                  `• Event: *${sessionEvent.name}*\n` +
                  `• Remaining Allowance: *${remaining} of ${totalLimit} free vote(s)*\n\n` +
                  `How many free votes would you like to cast for *${matchedNom.name}*?\n` +
                  `Reply with a number from *1 to ${remaining}* (or reply *ALL* to cast all ${remaining}):`;

                if (nomPhoto) {
                  await sendWhatsAppImage(phone, nomPhoto, freePrompt);
                } else {
                  await sendWhatsAppMessage(phone, freePrompt);
                }
                return;
              }

              // Paid voting -> Prompt for quantity
              await promptPaidVoteQuantity({
                db,
                phone,
                phoneHash,
                event: sessionEvent,
                matched: matchedNom,
                existingSessionId: activeSession.id,
              });
              return;
            }
          }
        }
      }
    }

    // If active session is awaiting quantity and user sends a number or taps QTY button
    if (activeSession && activeSession.state === "awaiting_quantity" && activeSession.event_id && activeSession.nominee_id && activeSession.category_id) {
      const cleanQty = text.replace(/^(QTY\s*)/i, "").replace(/\D/g, "");
      let qtyParsed = parseInt(cleanQty, 10);

      // If free vote quantity prompt and user replied "ALL"
      if (activeSession.metadata?.mode === "free" && upperText === "ALL") {
        qtyParsed = Number(activeSession.metadata?.max_votes) || 1;
      }

      if (!qtyParsed || qtyParsed < 1) {
        await sendWhatsAppMessage(phone, "Please enter a valid number of votes (or reply 0 to cancel):");
        return;
      }

      // Check if this is a free voting session
      if (activeSession.metadata?.mode === "free") {
        const maxFree = Number(activeSession.metadata?.max_votes) || 1;
        if (qtyParsed > maxFree) {
          await sendWhatsAppMessage(
            phone,
            `⚠️ You have ${maxFree} free vote${maxFree === 1 ? "" : "s"} remaining. Please reply with a number between 1 and ${maxFree} (or 0 to cancel):`,
          );
          return;
        }

        const { data: ev } = await db
          .from("events")
          .select("id, name, free_vote_limit_per_phone")
          .eq("id", activeSession.event_id)
          .single();

        const { data: nom } = await db
          .from("nominees")
          .select("id, name, image_path")
          .eq("id", activeSession.nominee_id)
          .single();

        const { data: cat } = await db
          .from("categories")
          .select("id, name")
          .eq("id", activeSession.category_id)
          .single();

        if (ev && nom && cat) {
          await handleFreeVote({
            phone,
            phoneHash,
            event: ev,
            category: cat,
            nominee: nom,
            quantity: qtyParsed,
          });
          return;
        }
      }

      if (qtyParsed > 10000) {
        await sendWhatsAppMessage(phone, "Please enter a valid number of votes between 1 and 10,000 (or reply 0 to cancel):");
        return;
      }

      let quantityToVote = qtyParsed;
      const pkgList = activeSession.metadata?.qty_packages;
      // If user typed 1, 2, or 3, check if it maps to package 1, 2, or 3
      if (Array.isArray(pkgList) && (qtyParsed === 1 || qtyParsed === 2 || qtyParsed === 3)) {
        const minVotes = Number(activeSession.metadata?.min_votes) || pkgList[0] || 1;
        if (minVotes > 3) {
          quantityToVote = Number(pkgList[qtyParsed - 1]) || qtyParsed;
        }
      }

      await handlePaidVoteCheckout({
        phone,
        phoneHash,
        eventId: activeSession.event_id,
        categoryId: activeSession.category_id,
        nomineeId: activeSession.nominee_id,
        quantity: quantityToVote,
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

  // 1. Ticket purchasing and pass retrieval
  if (upperText.startsWith("TICKET ") || upperText.startsWith("TICKETS ") || upperText.startsWith("BUY TICKET ")) {
    const eventParam = text.replace(/^(BUY\s+TICKET|TICKETS?)\s+/i, "").trim();
    if (eventParam) {
      await presentWhatsAppEventTicketTiers(phone, eventParam);
      return;
    }
  }

  // Browse ticket events
  if (
    ["BUY TICKET", "BUY TICKETS", "TICKETS", "TICKET", "MENU_TICKETS", "2"].includes(upperText) ||
    upperText.startsWith("MENU_TICKETS")
  ) {
    await presentWhatsAppTicketsList(phone);
    return;
  }

  // View existing purchased tickets
  if (
    ["MY TICKET", "MY TICKETS", "MY PASS", "MY PASSES", "MENU_MY_TICKETS", "3"].includes(upperText) ||
    upperText.startsWith("MENU_MY_TICKETS")
  ) {
    const { data: myTickets } = await db.rpc("find_public_tickets", { p_query: phone });
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
        reply += `🔗 View Digital Pass: ${siteUrl()}/tickets?q=${t.pax_code}\n\n`;
      }
      reply += `_Show your CODE PAX or QR code at the entrance for verification._\n\n`;
      reply += `👉 *Want to buy passes for another event?* Reply *BUY TICKET*.`;
      await sendWhatsAppMessage(phone, reply);
      return;
    } else {
      await sendWhatsAppMessage(
        phone,
        `🔍 No active tickets were found under this phone number (*${phone}*).\n\n` +
        `Reply *TICKETS* to browse upcoming events and purchase admission passes.`
      );
      return;
    }
  }

  // Results and Standings
  if (
    ["4", "RESULTS", "RESULT", "AWARDS", "STANDINGS", "LEADERBOARD", "MENU_RESULTS"].includes(upperText) ||
    upperText.startsWith("RESULTS ") ||
    upperText.startsWith("RESULT ") ||
    upperText.startsWith("AWARDS ") ||
    upperText.startsWith("STANDINGS ") ||
    upperText.startsWith("LEADERBOARD ") ||
    upperText.startsWith("MENU_RESULTS")
  ) {
    const eventParam = text.replace(/^(RESULTS?|AWARDS?|STANDINGS?|LEADERBOARD|MENU_RESULTS)\s*/i, "").trim();
    await handleWhatsAppResults(phone, eventParam);
    return;
  }

  // Main Menu Greetings
  const isGreetingOrMenu =
    ["MENU", "START", "HI", "HELLO", "HEY", "WASSUP", "YO", "HELP", "GREETINGS"].includes(upperText) ||
    /^(HI|HELLO|HEY|YO|WASSUP|START|MENU|HELP|GREETINGS|GOOD\s+(MORNING|AFTERNOON|EVENING))\b/i.test(text.trim());

  if (isGreetingOrMenu) {
    const welcomeMsg =
      `👋 Welcome to *VoteCastHub Ghana*! 🏆🎟️\n\n` +
      `How can we help you today? Reply with a number:\n\n` +
      `*1.* 🗳️ *Vote in a Competition*\n` +
      `*2.* 🎟️ *Buy Event Tickets & Passes*\n` +
      `*3.* 🔍 *My Tickets / Find My Passes*\n` +
      `*4.* 🏆 *View Awards Results & Standings*\n\n` +
      `_💡 Direct Shortcut: Reply *VOTE [Code]*, *TICKETS*, or *RESULTS*._`;

    await sendWhatsAppInteractiveButtons(
      phone,
      "🌟 VoteCastHub Main Menu",
      welcomeMsg,
      [
        { id: "MENU_VOTE", title: "🗳️ Vote in Contest" },
        { id: "MENU_TICKETS", title: "🎟️ Buy Tickets" },
        { id: "MENU_RESULTS", title: "🏆 Awards Results" },
      ],
      "VoteCastHub GH"
    );
    return;
  }

  // Voting competitions list prompt
  const isVotingListPrompt =
    ["1", "VOTE", "VOTING", "EVENTS", "COMPETITION", "COMPETITIONS", "CONTEST", "MENU_VOTE"].includes(upperText) ||
    upperText.startsWith("MENU_VOTE") ||
    /^(I\s+WANT\s+TO\s+VOTE|HOW\s+TO\s+VOTE|CAN\s+I\s+VOTE)/i.test(text.trim());

  if (isVotingListPrompt) {
    const { data: events } = await db
      .from("events")
      .select("id, name, slug, voting_mode, unit_price_minor, image_path, ends_at")
      .in("event_type", ["voting", "hybrid"])
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

        await sendWhatsAppInteractiveButtons(
          phone,
          "🗳️ VoteCastHub Competitions",
          "Welcome to VoteCastHub! 🏆\n\nTap an ongoing competition below to view categories and candidates:\n\n_(You can also reply with any contestant's code like *VOTE BSF-092* to vote directly)_",
          buttons,
          "VoteCastHub",
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
        "Welcome to VoteCastHub! 🏆\nTap below to explore active voting events.\n\n👉 Have a contestant code? Reply *VOTE [Code]* (e.g. *VOTE BSF-092*) to jump directly to their ballot!",
        "Browse Events 🏆",
        [{ title: "Live Competitions", rows }],
        "VoteCastHub",
      );
      return;
    }

    await sendWhatsAppMessage(
      phone,
      "👋 Welcome to *VoteCastHub*! 🗳️\n\nTo vote for your candidate, reply with their code:\n👉 *VOTE [Nominee Code]*\n\n_Example:_\n*VOTE BSF-092*",
    );
    return;
  }

  // Parse command syntax: VOTE [NOMINEE_CODE or EVENT_CODE] [OPTIONAL_NOMINEE_CODE or QUANTITY]
  const cleaned = text.replace(/^(VOTE|VCH|BALLOT)\s+/i, "");
  const parts = cleaned.split(/\s+/).filter(Boolean);

  if (parts.length === 0) {
    await sendWhatsAppMessage(
      phone,
      "⚠️ Incomplete voting command.\nPlease use the format:\n*VOTE [Nominee Code]* (e.g. *VOTE BSF-092*)\nor *VOTE [Event Code] [Nominee Code]*",
    );
    return;
  }

  // 1. Check if first parameter is a direct candidate public code (e.g. "VOTE BSF-092" or "BSF-092" or "VOTE BSF-092 10")
  const potentialNomineeCode = parts[0].trim();
  const { data: directNominee } = await db
    .from("nominees")
    .select(`
      id, name, public_code, display_order, image_path, category_id,
      categories!inner(
        id, name, event_id, is_active,
        events!inner(id, name, slug, event_type, voting_mode, unit_price_minor, free_vote_limit_per_phone, verification_method, starts_at, ends_at, status, image_path)
      )
    `)
    .ilike("public_code", potentialNomineeCode)
    .eq("is_active", true)
    .eq("categories.is_active", true)
    .eq("categories.events.status", "published")
    .gt("categories.events.ends_at", new Date().toISOString())
    .limit(1)
    .maybeSingle();

  if (directNominee) {
    const nomCat = directNominee.categories as any;
    const nomEvent = nomCat.events as any;
    // Check if parts[1] is quantity (e.g. "VOTE BSF-092 10")
    const directQty = parts[1] && /^\d+$/.test(parts[1]) ? parseInt(parts[1], 10) : undefined;
    await handleDirectNomineeVoteWhatsApp({
      phone,
      phoneHash,
      nominee: directNominee,
      category: nomCat,
      event: nomEvent,
      quantity: directQty,
    });
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
      `❌ Contestant or event code *${eventIdentifier}* was not found.\nPlease double check the event flyer and try again.`,
    );
    return;
  }

  // Load event details
  const { data: event, error: eventErr } = await db
    .from("events")
    .select("id, name, slug, event_type, voting_mode, unit_price_minor, free_vote_limit_per_phone, verification_method, starts_at, ends_at, status, image_path, venue_name, doors_open_time")
    .eq("id", eventId)
    .single();

  if (eventErr || !event) {
    await sendWhatsAppMessage(phone, "❌ Event details unavailable. Please try again later.");
    return;
  }

  // If this is a dedicated ticketing event, jump straight to ticket tiers
  if (event.event_type === "ticketing") {
    await presentWhatsAppEventTicketTiers(phone, event.id);
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
    // Check if event has ticket tiers instead
    const { count: tierCount } = await db
      .from("event_ticket_tiers")
      .select("id", { count: "exact", head: true })
      .eq("event_id", event.id)
      .eq("is_active", true);

    if (tierCount && tierCount > 0) {
      await presentWhatsAppEventTicketTiers(phone, event.id);
      return;
    }

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

  // If voter specified event but no nominee code, check categories:
  if (!nomineeIdentifier) {
    const { data: rawCategories } = await db
      .from("categories")
      .select("id, name, display_order")
      .eq("event_id", event.id)
      .eq("is_active", true)
      .order("display_order");

    if (!rawCategories || rawCategories.length === 0) {
      await sendWhatsAppMessage(phone, "❌ No active categories found for this event.");
      return;
    }

    // Single-category event: Jump directly to candidate roster
    if (rawCategories.length === 1) {
      await presentWhatsAppCategoryBallot({
        phone,
        phoneHash,
        event,
        category: rawCategories[0],
      });
      return;
    }

    // Multi-category event: Prompt voter to choose category first
    const priceText = event.voting_mode === "paid"
      ? `💰 Cost: GH₵${(Number(event.unit_price_minor) / 100).toFixed(2)} per vote`
      : "🎟️ Free voting";

    const eventCoverUrl = await getSignedImageUrl(event.image_path);

    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    await db
      .from("whatsapp_sessions")
      .delete()
      .eq("phone", phone)
      .neq("state", "completed");

    await db.from("whatsapp_sessions").insert({
      phone,
      phone_hash: phoneHash,
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

    const categoryRoster = rawCategories
      .slice(0, 15)
      .map((c, idx) => `• *${idx + 1}* · ${c.name}`)
      .join("\n");

    const moreText = rawCategories.length > 15 ? `\n_...and ${rawCategories.length - 15} more categories._` : "";

    // 1. If 1 to 3 categories: Interactive Quick Reply Buttons
    if (rawCategories.length <= 3) {
      const buttons = rawCategories.map((c, idx) => ({
        id: `CAT ${event.id} ${c.id}`,
        title: `${idx + 1}. ${c.name}`.slice(0, 20),
      }));

      await sendWhatsAppInteractiveButtons(
        phone,
        `📂 ${event.name}`.slice(0, 60),
        `${priceText}\n\n*Categories:*\n${categoryRoster}\n\n👉 Tap a category below or reply with a number (e.g. 1):`,
        buttons,
        "VoteCastHub Categories",
        eventCoverUrl,
      );
      return;
    }

    // 2. If 4 to 10 categories: Interactive Dropdown List
    if (rawCategories.length <= 10) {
      const rows = rawCategories.map((c, idx) => ({
        id: `CAT ${event.id} ${c.id}`,
        title: `${idx + 1}. ${c.name}`.slice(0, 24),
        description: `Browse contestants in ${c.name}`.slice(0, 72),
      }));

      await sendWhatsAppInteractiveList(
        phone,
        `📂 ${event.name}`.slice(0, 60),
        `${priceText}\n\n*Categories:*\n${categoryRoster}\n\n👉 Tap the button below or reply with a category number (e.g. 1):`,
        "Select Category",
        [{ title: "Categories", rows }],
        "VoteCastHub Categories",
      );
      return;
    }

    // 3. Fallback for > 10 categories
    const rosterText = `📂 *${event.name}*\n${priceText}\n\n*Categories:*\n${categoryRoster}${moreText}\n\n👉 Reply with a category *number (e.g. 1)* or *name* to browse contestants.`;
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
      await promptPaidVoteQuantity({
        db,
        phone,
        phoneHash,
        event,
        matched,
      });
    }
  }
}

async function promptPaidVoteQuantity(params: {
  db: any;
  phone: string;
  phoneHash: string;
  event: {
    id: string;
    name: string;
    unit_price_minor: number;
    image_path?: string | null;
  };
  matched: NomineeWithCategory;
  existingSessionId?: string;
}): Promise<void> {
  const { db, phone, phoneHash, event, matched, existingSessionId } = params;

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

  if (existingSessionId) {
    await db
      .from("whatsapp_sessions")
      .update({
        category_id: matched.category_id,
        nominee_id: matched.id,
        state: "awaiting_quantity",
        vote_request: voteRequest,
        expires_at: expiresAt,
        metadata: {
          event_name: event.name,
          category_name: matched.category.name,
          nominee_name: matched.name,
          nominee_image_path: matched.image_path,
          min_votes: minVotes,
          qty_packages: [qty1, qty2, qty3],
        },
        updated_at: new Date().toISOString(),
      })
      .eq("id", existingSessionId);
  } else {
    await db
      .from("whatsapp_sessions")
      .delete()
      .eq("phone", phone)
      .neq("state", "completed");

    await db.from("whatsapp_sessions").insert({
      phone,
      phone_hash: phoneHash,
      event_id: event.id,
      category_id: matched.category_id,
      nominee_id: matched.id,
      state: "awaiting_quantity",
      vote_request: voteRequest,
      expires_at: expiresAt,
      metadata: {
        event_name: event.name,
        category_name: matched.category.name,
        nominee_name: matched.name,
        nominee_image_path: matched.image_path,
        min_votes: minVotes,
        qty_packages: [qty1, qty2, qty3],
      },
    });
  }

  const nomineePhotoUrl = await getSignedImageUrl(matched.image_path);

  // Button titles must be <= 20 chars and plain ASCII to satisfy Meta WhatsApp API
  const buttons = [
    { id: `QTY ${qty1}`, title: `${qty1} Vote${qty1 > 1 ? "s" : ""} · GHc${cost1}`.slice(0, 20) },
    { id: `QTY ${qty2}`, title: `${qty2} Votes · GHc${cost2}`.slice(0, 20) },
    { id: `QTY ${qty3}`, title: `${qty3} Votes · GHc${cost3}`.slice(0, 20) },
  ];

  let promptBody = `You selected *${matched.name}* in *${matched.category.name}* (${event.name}).\nPrice: *GH₵${priceGhs} per vote*.`;
  if (minVotes > 1) {
    promptBody += `\n\nℹ️ _Mobile Money minimum checkout is GH₵ 1.00 (min package: ${minVotes} votes)_`;
  }
  promptBody += `\n\nHow many votes would you like to cast?\n*Choose a Vote Package:*\n1️⃣ *${qty1} Vote${qty1 > 1 ? "s" : ""}* — GH₵ ${cost1}\n2️⃣ *${qty2} Votes* — GH₵ ${cost2}\n3️⃣ *${qty3} Votes* — GH₵ ${cost3}\n\n👉 Tap a button below or reply with a number (*${qty1}*, *${qty2}*, *${qty3}*, or any amount):`;

  await sendWhatsAppInteractiveButtons(
    phone,
    `🗳️ ${matched.name}`.slice(0, 60),
    promptBody,
    buttons,
    minVotes > 1 ? `Min: ${minVotes} votes · GHc${cost1}` : "Or reply with any number",
    nomineePhotoUrl,
  );
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
      ...(subaccount ? {
        subaccount,
        bearer: "account" as const,
        transaction_charge: Math.floor(totalAmountMinor / 10),
      } : {}),
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
    const errMsg = err instanceof Error ? err.message : String(err);
    console.warn("[WhatsApp] Paystack initialize attempt failed, checking fallback", { error: errMsg, subaccount });

    // If initial checkout failed due to subaccount (e.g. invalid, unverified or mismatched subaccount code), fallback to direct checkout so the voter is not stranded
    if (subaccount && errMsg.toLowerCase().includes("subaccount")) {
      try {
        console.warn("[WhatsApp] Retrying checkout directly without subaccount fallback", { subaccount, ref: attempt.provider_reference });
        const fallbackRes = await paystack<{ authorization_url: string }>("/transaction/initialize", {
          reference: attempt.provider_reference,
          amount: totalAmountMinor,
          currency: "GHS",
          email: `${phone}@votecasthub.com`,
          metadata: {
            channel: "whatsapp",
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
      } catch (fallbackErr) {
        console.error("[WhatsApp] Fallback checkout also failed", fallbackErr);
      }
    }

    if (!authUrl) {
      console.error("[WhatsApp] All Paystack initialize paths failed", { error: errMsg });
      await sendWhatsAppMessage(
        phone,
        `❌ Payment checkout error: ${errMsg.replace(/^Paystack request failed:\s*/, "") || "Please try again in a few moments."}`,
      );
      return;
    }
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

  // 4. Send payment link back to voter with candidate image and direct clickable link
  const nomineePhotoUrl = await getSignedImageUrl(nominee.image_path);
  const checkoutMsg = `🗳️ *Confirm Your Vote for ${nominee.name}*\n• Event: *${event.name}*\n• Category: *${category?.name || "Contestant"}*\n• Quantity: *${quantity} vote(s)*\n• Total: *GH₵${totalGhs}*\n\n💳 *Tap to Pay with Mobile Money (MTN, Telecel, AT) or Card:*\n👉 ${authUrl}\n\n_Your votes will be confirmed automatically once payment is approved._`;

  if (nomineePhotoUrl) {
    await sendWhatsAppImage(phone, nomineePhotoUrl, checkoutMsg);
    // When photo is attached, also send link as standalone text so it is 1-tap clickable on all WhatsApp clients
    await sendWhatsAppMessage(
      phone,
      `👉 *Tap to Complete Payment (GH₵${totalGhs}):*\n${authUrl}\n\n_Supports MTN Mobile Money, Telecel Cash, AT Money, and Cards._`,
    );
  } else {
    await sendWhatsAppMessage(phone, checkoutMsg);
  }
}

async function presentWhatsAppCategoryBallotById(params: {
  phone: string;
  phoneHash: string;
  eventId: string;
  categoryId: string;
}): Promise<void> {
  const db = paymentAdmin();
  const { phone, phoneHash, eventId, categoryId } = params;

  // Resolve event (supports UUID, slug, or numeric code)
  let resolvedEventId = eventId;
  if (/^\d+$/.test(eventId)) {
    const { data: ussdReq } = await db
      .from("event_ussd_requests")
      .select("event_id")
      .eq("event_code", parseInt(eventId, 10))
      .maybeSingle();
    if (ussdReq?.event_id) {
      resolvedEventId = ussdReq.event_id;
    }
  }

  const { data: event } = await db
    .from("events")
    .select("id, name, slug, voting_mode, unit_price_minor, free_vote_limit_per_phone, verification_method, starts_at, ends_at, status, image_path")
    .or(`id.eq.${resolvedEventId.length === 36 ? resolvedEventId : "00000000-0000-0000-0000-000000000000"},slug.eq.${resolvedEventId.toLowerCase()}`)
    .single();

  if (!event) {
    await sendWhatsAppMessage(phone, "❌ Event not found. Reply VOTE to browse events.");
    return;
  }

  const { data: category } = await db
    .from("categories")
    .select("id, name, display_order")
    .eq("id", categoryId)
    .single();

  if (!category) {
    await sendWhatsAppMessage(phone, "❌ Category not found. Reply VOTE to browse events.");
    return;
  }

  await presentWhatsAppCategoryBallot({
    phone,
    phoneHash,
    event,
    category,
  });
}

async function presentWhatsAppCategoryBallot(params: {
  phone: string;
  phoneHash: string;
  event: {
    id: string;
    name: string;
    slug: string;
    voting_mode: string;
    unit_price_minor: number;
    free_vote_limit_per_phone?: number;
    image_path?: string | null;
    status: string;
    starts_at: string;
    ends_at: string;
  };
  category: {
    id: string;
    name: string;
  };
}): Promise<void> {
  const db = paymentAdmin();
  const { phone, phoneHash, event, category } = params;

  const now = new Date();
  if (event.status !== "published" || now < new Date(event.starts_at) || now >= new Date(event.ends_at)) {
    await sendWhatsAppMessage(phone, `⏳ Voting for *${event.name}* is currently closed.`);
    return;
  }

  const { data: rawNominees } = await db
    .from("nominees")
    .select("id, name, public_code, display_order, image_path, category_id")
    .eq("category_id", category.id)
    .eq("is_active", true)
    .order("display_order");

  if (!rawNominees || rawNominees.length === 0) {
    await sendWhatsAppMessage(phone, `❌ No active contestants found in *${category.name}*. Reply VOTE to choose another category.`);
    return;
  }

  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  await db
    .from("whatsapp_sessions")
    .delete()
    .eq("phone", phone)
    .neq("state", "completed");

  await db.from("whatsapp_sessions").insert({
    phone,
    phone_hash: phoneHash,
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
    ? `💰 Cost: GH₵${(Number(event.unit_price_minor) / 100).toFixed(2)} per vote`
    : "🎟️ Free voting";

  const eventCoverUrl = await getSignedImageUrl(event.image_path);

  const candidateRoster = rawNominees
    .slice(0, 15)
    .map((n, idx) => {
      const code = n.public_code ? ` (Code: ${n.public_code})` : "";
      return `• *${idx + 1}* · ${n.name}${code}`;
    })
    .join("\n");

  const moreText = rawNominees.length > 15 ? `\n_...and ${rawNominees.length - 15} more candidates._` : "";

  // 1. If 1 to 3 nominees: Quick Reply Buttons or Photo Cards
  if (rawNominees.length <= 3) {
    const hasPhotos = rawNominees.some((n) => Boolean(n.image_path));
    if (hasPhotos) {
      for (const [idx, n] of rawNominees.entries()) {
        const nomPhotoUrl = await getSignedImageUrl(n.image_path);
        const code = n.public_code ? ` (Code: ${n.public_code})` : ` (#${idx + 1})`;
        const cardBody = `*${n.name}*${code}\nCategory: *${category.name}*\n${priceText}\n\n👉 Tap the button below to vote:`;
        const singleBtn = [
          {
            id: `VOTE ${event.slug} ${n.id}`,
            title: `🗳️ Vote ${n.name.split(" ")[0]}`.slice(0, 20),
          },
        ];
        await sendWhatsAppInteractiveButtons(
          phone,
          `👤 ${n.name}`.slice(0, 60),
          cardBody,
          singleBtn,
          "VoteCastHub Ballot",
          nomPhotoUrl,
        );
      }
      return;
    }

    const buttons = rawNominees.map((n, idx) => ({
      id: `VOTE ${event.slug} ${n.id}`,
      title: `${idx + 1}. ${n.name}`.slice(0, 20),
    }));

    await sendWhatsAppInteractiveButtons(
      phone,
      `🗳️ ${event.name}`.slice(0, 60),
      `Category: *${category.name}*\n${priceText}\n\n*Candidates:*\n${candidateRoster}\n\n👉 Tap a candidate below or reply with a number (e.g. 1):`,
      buttons,
      "VoteCastHub Ballot",
      eventCoverUrl,
    );
    return;
  }

  // 2. If 4 to 10 nominees: Dropdown List
  if (rawNominees.length <= 10) {
    const rows = rawNominees.map((n, idx) => {
      const code = n.public_code || String(idx + 1).padStart(2, "0");
      return {
        id: `VOTE ${event.slug} ${n.id}`,
        title: `${idx + 1}. ${n.name}`.slice(0, 24),
        description: `Code: ${code} · ${category.name}`.slice(0, 72),
      };
    });

    await sendWhatsAppInteractiveList(
      phone,
      `🗳️ ${event.name}`.slice(0, 60),
      `Category: *${category.name}*\n${priceText}\n\n*Candidates:*\n${candidateRoster}\n\n👉 Tap the button below or reply with a candidate number (e.g. 1):`,
      "Select Candidate",
      [{ title: "Candidates", rows }],
      "VoteCastHub Ballot",
    );
    return;
  }

  // 3. Fallback for > 10 nominees
  const rosterText = `🗳️ *${event.name}*\nCategory: *${category.name}*\n${priceText}\n\n*Candidates:*\n${candidateRoster}${moreText}\n\n👉 Reply with a candidate *number (e.g. 1)*, *code*, or *name* to vote.\n_(Or reply 0 to cancel)_`;
  if (eventCoverUrl) {
    await sendWhatsAppImage(phone, eventCoverUrl, rosterText);
  } else {
    await sendWhatsAppMessage(phone, rosterText);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// WhatsApp Ticketing Helpers
// ─────────────────────────────────────────────────────────────────────────────

async function presentWhatsAppTicketsList(phone: string): Promise<void> {
  const db = paymentAdmin();
  const nowIso = new Date().toISOString();

  // Find all active ticket tiers to identify any event selling tickets
  const { data: activeTiers } = await db
    .from("event_ticket_tiers")
    .select("event_id")
    .eq("is_active", true);

  const tierEventIds = new Set((activeTiers ?? []).map((t) => t.event_id));

  const { data: rawEvents } = await db
    .from("events")
    .select("id, name, slug, venue_name, doors_open_time, status, ends_at, event_type")
    .eq("status", "published")
    .gt("ends_at", nowIso)
    .order("created_at", { ascending: false })
    .limit(15);

  const ticketEvents = (rawEvents ?? []).filter(
    (e) => tierEventIds.has(e.id) || e.event_type === "ticketing" || e.event_type === "hybrid"
  ).slice(0, 8);

  if (!ticketEvents || ticketEvents.length === 0) {
    await sendWhatsAppMessage(
      phone,
      `🎟️ *VoteCastHub Event Tickets*\n\nThere are currently no active ticketed events open for booking.\n\nReply *VOTE* or *EVENTS* to browse ongoing voting competitions.`
    );
    return;
  }

  // Create or refresh active session for choosing an event
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  await db.from("whatsapp_sessions").delete().eq("phone", phone).neq("state", "completed");
  try {
    await db.from("whatsapp_sessions").insert({
      phone,
      phone_hash: hashPhone(phone),
      state: "awaiting_ticket_tier",
      metadata: {
        step: "awaiting_ticket_event",
        events: ticketEvents.map((e) => ({ id: e.id, name: e.name, slug: e.slug })),
      },
      expires_at: expiresAt,
    });
  } catch {
    // Resilient fallback in case state constraint has not been migrated yet
    await db.from("whatsapp_sessions").insert({
      phone,
      phone_hash: hashPhone(phone),
      state: "awaiting_candidate",
      metadata: {
        step: "awaiting_ticket_event",
        events: ticketEvents.map((e) => ({ id: e.id, name: e.name, slug: e.slug })),
      },
      expires_at: expiresAt,
    });
  }

  let msg = `🎟️ *VoteCastHub Live Event Tickets* 🎫\n\nSelect an upcoming event below to buy passes or check in:\n\n`;
  ticketEvents.forEach((ev, idx) => {
    msg += `*${idx + 1}.* *${ev.name}*\n   📍 ${ev.venue_name || "Event Venue"}${ev.doors_open_time ? ` | 🚪 ${ev.doors_open_time}` : ""}\n\n`;
  });
  msg += `👉 Reply with the *Event Number* (e.g. *1*) or Event Name to choose ticket tiers.\n_(Reply 0 to cancel)_`;

  await sendWhatsAppMessage(phone, msg);
}

async function presentWhatsAppEventTicketTiers(phone: string, eventIdentifier: string): Promise<void> {
  const db = paymentAdmin();

  let query = db
    .from("events")
    .select("id, name, slug, venue_name, doors_open_time, status, image_path, ends_at");

  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (uuidPattern.test(eventIdentifier)) {
    query = query.eq("id", eventIdentifier);
  } else {
    query = query.eq("slug", eventIdentifier.toLowerCase());
  }

  const { data: event, error: eventErr } = await query.maybeSingle();

  if (eventErr || !event) {
    await sendWhatsAppMessage(phone, `❌ Event *${eventIdentifier}* was not found or has concluded. Reply *TICKETS* to view upcoming events.`);
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
    await sendWhatsAppMessage(phone, `❌ No active ticket tiers found for *${event.name}*.`);
    return;
  }

  // Create or refresh session
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  await db.from("whatsapp_sessions").delete().eq("phone", phone).neq("state", "completed");
  try {
    await db.from("whatsapp_sessions").insert({
      phone,
      phone_hash: hashPhone(phone),
      event_id: event.id,
      state: "awaiting_ticket_tier",
      metadata: {
        step: "awaiting_tier_number",
        event_name: event.name,
        tiers: tiers.map((t) => ({ id: t.id, name: t.name })),
      },
      expires_at: expiresAt,
    });
  } catch {
    await db.from("whatsapp_sessions").insert({
      phone,
      phone_hash: hashPhone(phone),
      event_id: event.id,
      state: "awaiting_candidate",
      metadata: {
        step: "awaiting_tier_number",
        event_name: event.name,
        tiers: tiers.map((t) => ({ id: t.id, name: t.name })),
      },
      expires_at: expiresAt,
    });
  }

  let msg = `🎟️ *${event.name} — Admission Tickets*\n`;
  if (event.venue_name) msg += `📍 Venue: ${event.venue_name}\n`;
  if (event.doors_open_time) msg += `🚪 Doors: ${event.doors_open_time}\n`;
  msg += `\n*Available Ticket Tiers:*\n`;

  tiers.forEach((t, index) => {
    const remaining = Math.max(0, t.capacity - t.sold_count);
    const isSoldOut = remaining <= 0;
    const priceStr = t.price_minor === 0 ? "FREE" : `GH₵ ${(Number(t.price_minor) / 100).toFixed(2)}`;
    const statusNote = isSoldOut ? " [SOLD OUT]" : remaining <= 10 ? ` (${remaining} left)` : "";

    msg += `\n*${index + 1}.* *${t.name}* — ${priceStr}${statusNote}`;
    if (t.description) msg += `\n   _${t.description}_`;
  });

  msg += `\n\n👉 Reply with the *Tier Number* (e.g. *1*) to select your pass.\n_(Reply 0 to cancel)_`;

  await sendWhatsAppMessage(phone, msg);
}

async function handleTicketCheckoutWhatsApp(params: {
  phone: string;
  eventId: string;
  tierId: string;
  quantity: number;
  customerName: string;
  existingSessionId?: string;
}): Promise<void> {
  const db = paymentAdmin();
  const { phone, eventId, tierId, quantity, customerName, existingSessionId } = params;

  // 1. Fetch Event
  const { data: event, error: eventErr } = await db
    .from("events")
    .select("id, organization_id, name, venue_name, status, starts_at, ends_at")
    .eq("id", eventId)
    .maybeSingle();

  if (eventErr || !event || event.status === "closed") {
    await sendWhatsAppMessage(phone, "❌ This event is currently closed or unavailable.");
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
    await sendWhatsAppMessage(phone, "❌ This ticket tier is no longer active.");
    return;
  }

  if (tier.sold_count + quantity > tier.capacity) {
    const remaining = Math.max(0, tier.capacity - tier.sold_count);
    await sendWhatsAppMessage(phone, `❌ Sold out! Only ${remaining} ticket${remaining === 1 ? "" : "s"} remaining in this tier.`);
    return;
  }

  const totalMinor = Number(tier.price_minor) * quantity;
  const buyerEmail = `${normalizeGhanaPhone(phone)}@tickets.votecasthub.com`;

  // Free Ticket: issue immediately
  if (totalMinor === 0) {
    const { data: ticket, error: purchaseErr } = await db.rpc("purchase_event_ticket", {
      p_event_id: eventId,
      p_tier_id: tierId,
      p_quantity: quantity,
      p_customer_name: customerName,
      p_customer_phone: phone,
      p_customer_email: buyerEmail,
      p_order_reference: null,
      p_channel: "whatsapp",
      p_initial_status: "valid",
    });

    if (purchaseErr) {
      await sendWhatsAppMessage(phone, `❌ Error reserving pass: ${purchaseErr.message}`);
      return;
    }

    if (existingSessionId) {
      await db.from("whatsapp_sessions").update({ state: "completed", updated_at: new Date().toISOString() }).eq("id", existingSessionId);
    }

    const ticketObj = ticket as Record<string, unknown>;
    const allCodes = Array.isArray(ticketObj?.pax_codes) && (ticketObj.pax_codes as string[]).length > 0
      ? (ticketObj.pax_codes as string[])
      : [String(ticketObj?.pax_code || "PAX")];
    const passUrl = `${siteUrl()}/tickets?q=${encodeURIComponent(allCodes[0])}`;

    sendTicketConfirmationSms({
      phone,
      customerName,
      eventName: event.name,
      tierName: tier.name,
      paxCode: allCodes,
      venueName: event.venue_name,
    }).catch(() => {});

    const codesList = allCodes.length === 1
      ? `🔑 *CODE PAX:* \`#${allCodes[0]}\``
      : allCodes.map((c, i) => `🔑 *Pass #${i + 1} CODE PAX:* \`#${c}\``).join("\n");

    await sendWhatsAppMessage(
      phone,
      `🎉 *Your Free Ticket Is Confirmed!* 🎟️\n\n` +
      `📌 *${event.name}*\n` +
      `👤 *Attendee:* ${customerName}\n` +
      `🎫 *Tier:* ${tier.name} (${quantity} Pass${quantity > 1 ? "es" : ""})\n` +
      `${codesList}\n` +
      `📍 *Venue:* ${event.venue_name || "Event Venue"}\n\n` +
      `📱 *SMS pass dispatched to:* ${phone}\n` +
      `🔗 *View Digital Pass & QR Codes:*\n👉 ${passUrl}\n\n` +
      `_Show your CODE PAX or QR code at the entrance for verification._`
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
    p_customer_phone: phone,
    p_customer_email: buyerEmail,
    p_order_reference: orderRef,
    p_channel: "whatsapp",
    p_initial_status: "pending",
  });

  if (reserveErr) {
    await sendWhatsAppMessage(phone, `❌ Could not reserve ticket: ${reserveErr.message}`);
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
        channel: "whatsapp",
        phone,
        order_reference: orderRef,
        event_id: eventId,
        tier_id: tierId,
        quantity,
        customer_name: customerName,
        customer_phone: phone,
      },
    });

    const parsedUrl = new URL(paystackRes.authorization_url);
    if (parsedUrl.protocol !== "https:" || parsedUrl.hostname !== "checkout.paystack.com") {
      throw new Error("Invalid checkout domain returned by Paystack");
    }
    authUrl = parsedUrl.href;
  } catch (err) {
    console.error("wa_ticket_paystack_init_failed:", err);
    await sendWhatsAppMessage(phone, "❌ Failed to initiate Paystack checkout. Please try again shortly.");
    return;
  }

  if (existingSessionId) {
    await db
      .from("whatsapp_sessions")
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

  await sendWhatsAppMessage(
    phone,
    `🎟️ *Ticket Checkout — ${event.name}*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `🎫 *Tier:* ${tier.name}\n` +
    `👥 *Quantity:* ${quantity} Pass${quantity > 1 ? "es" : ""}\n` +
    `👤 *Holder:* ${customerName}\n` +
    `💰 *Total Amount:* GH₵ ${totalGhs}\n\n` +
    `📱 *Pay with Mobile Money (MTN / Telecel / AT) or Card:*\n` +
    `Tap the secure link below to complete payment:\n` +
    `👉 ${authUrl}\n\n` +
    `_After payment is approved, your CODE PAX and digital passes will be delivered right to this chat!_`
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Direct Nominee Voting Helper
// ─────────────────────────────────────────────────────────────────────────────

async function handleDirectNomineeVoteWhatsApp(params: {
  phone: string;
  phoneHash: string;
  nominee: { id: string; name: string; public_code: string | null; image_path: string | null };
  category: { id: string; name: string };
  event: {
    id: string;
    name: string;
    slug: string;
    voting_mode: string;
    unit_price_minor: number;
    free_vote_limit_per_phone: number | null;
    image_path?: string | null;
  };
  quantity?: number;
}): Promise<void> {
  const db = paymentAdmin();
  const { phone, phoneHash, nominee, category, event, quantity } = params;

  // Free voting mode
  if (event.voting_mode === "free") {
    const totalLimit = Number(event.free_vote_limit_per_phone) || 1;
    let remaining = totalLimit;

    const userId = await resolveWhatsAppVoterUserId(db, phone);
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
      await sendWhatsAppMessage(
        phone,
        `⚠️ You have already reached your free vote limit of *${totalLimit} vote(s)* for *${event.name}*.`,
      );
      return;
    }

    // If quantity was explicitly provided (e.g. VOTE BSF-092 3)
    if (quantity && quantity >= 1) {
      const votesToCast = Math.min(quantity, remaining);
      await handleFreeVote({
        phone,
        phoneHash,
        event,
        category,
        nominee,
        quantity: votesToCast,
      });
      return;
    }

    // If only 1 vote remaining or total limit is 1, cast directly
    if (remaining === 1) {
      await handleFreeVote({
        phone,
        phoneHash,
        event,
        category,
        nominee,
        quantity: 1,
      });
      return;
    }

    // Otherwise, prompt voter how many of their remaining free votes to cast!
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    await db.from("whatsapp_sessions").delete().eq("phone", phone).neq("state", "completed");
    await db.from("whatsapp_sessions").insert({
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

    const nomPhotoUrl = await getSignedImageUrl(nominee.image_path);
    const freePrompt =
      `🗳️ *Free Vote for ${nominee.name}*\n` +
      `• Category: *${category.name}*\n` +
      `• Event: *${event.name}*\n` +
      `• Remaining Allowance: *${remaining} of ${totalLimit} free vote(s)*\n\n` +
      `How many free votes would you like to cast for *${nominee.name}*?\n` +
      `Reply with a number from *1 to ${remaining}* (or reply *ALL* to cast all ${remaining}):`;

    if (nomPhotoUrl) {
      await sendWhatsAppImage(phone, nomPhotoUrl, freePrompt);
    } else {
      await sendWhatsAppMessage(phone, freePrompt);
    }
    return;
  }

  // Paid voting mode
  if (quantity && quantity >= 1 && quantity <= 10000) {
    await handlePaidVoteCheckout({
      phone,
      phoneHash,
      eventId: event.id,
      categoryId: category.id,
      nomineeId: nominee.id,
      quantity,
    });
    return;
  }

  // Prompt for paid vote quantity with nominee photo
  await promptPaidVoteQuantity({
    db,
    phone,
    phoneHash,
    event,
    matched: {
      ...nominee,
      category_id: category.id,
      category: {
        id: category.id,
        name: category.name,
        event_id: event.id,
      },
      display_order: 1,
    },
  });
}

async function handleWhatsAppResults(phone: string, eventParam?: string): Promise<void> {
  const db = paymentAdmin();

  if (!eventParam) {
    const list = await loadPublicAwardsDirectory(db);
    if (!list || list.length === 0) {
      await sendWhatsAppMessage(
        phone,
        `🔍 *No Public Awards Results Available*\n\nNone of the competitions currently have public results active. Organizers can configure Live Results Visibility to make tallies public.\n\nReply *VOTE* to browse active voting competitions or *TICKETS* to buy event passes.`
      );
      return;
    }

    if (list.length <= 10) {
      const rows = list.map((ev) => ({
        id: `RESULTS ${ev.slug}`,
        title: ev.name.slice(0, 24),
        description: ev.is_ended
          ? `🏆 Certified Final · ${ev.total_votes.toLocaleString()} votes`
          : `⚡ Live Standings · ${ev.total_votes.toLocaleString()} votes`,
      }));

      await sendWhatsAppInteractiveList(
        phone,
        "🏆 VoteCastHub Awards Results",
        "🏆 *Certified Awards & Standings*\n\nSelect an event from the list below to view verified vote tallies and category winners:",
        "View Results 🏆",
        [{ title: "Competitions", rows }],
        "VoteCastHub GH"
      );
      return;
    }

    let text = `🏆 *VoteCastHub Ghana — Awards Results*\n\nReply with an event number to view standings:\n\n`;
    list.slice(0, 10).forEach((ev, idx) => {
      const badge = ev.is_ended ? "🏁 Final" : "⚡ Live";
      text += `*${idx + 1}.* ${ev.name} (${badge})\n`;
    });
    text += `\n_Example: Reply *RESULTS 1* or *RESULTS ${list[0]?.slug}*_`;
    await sendWhatsAppMessage(phone, text);
    return;
  }

  // Look up event: check if eventParam is a number (1-based index)
  const num = parseInt(eventParam, 10);
  let targetSlugOrId = eventParam;

  if (!isNaN(num) && num >= 1) {
    const list = await loadPublicAwardsDirectory(db);
    if (list[num - 1]) {
      targetSlugOrId = list[num - 1].slug;
    }
  }

  const results = await loadEventPublicResults(targetSlugOrId, db);
  if (!results) {
    await sendWhatsAppMessage(
      phone,
      `❌ Could not find awards results for "*${eventParam}*".\n\nReply *RESULTS* to see all competitions with public standings.`
    );
    return;
  }

  if (!results.is_public) {
    await sendWhatsAppMessage(
      phone,
      `🔒 *Results Confidential / Locked*\n\nThe organizer of *${results.event.name}* has configured results visibility as Organizer-Only or confidential until awards night.\n\n🔗 View event details: ${siteUrl()}/events/${results.event.slug}`
    );
    return;
  }

  // Build formatted message
  const ev = results.event;
  let reply = `🏆 *${ev.name.toUpperCase()}* 🏆\n`;
  reply += ev.is_ended ? `🏁 *Official Final Awards Results*\n` : `⚡ *Live Standings & Vote Tallies*\n`;
  reply += `🏛️ Organizer: ${ev.organization_name}\n`;
  reply += `📊 Total Ballots: ${results.total_ballots.toLocaleString("en-GH")}\n`;
  reply += `🔐 Audit Hash: *${results.audit_hash}*\n\n`;

  results.categories.slice(0, 6).forEach((cat) => {
    reply += `🎖️ *${cat.category_name}* (${cat.total_votes.toLocaleString("en-GH")} votes)\n`;
    if (cat.podium.length === 0 || cat.total_votes === 0) {
      reply += `   _No votes recorded yet_\n`;
    } else {
      cat.podium.forEach((n) => {
        const medal = n.rank === 1 ? "🥇" : n.rank === 2 ? "🥈" : "🥉";
        reply += `   ${medal} *${n.name}* — ${n.vote_count.toLocaleString("en-GH")} votes (${n.vote_share_percentage}%)\n`;
      });
    }
    reply += `\n`;
  });

  if (results.categories.length > 6) {
    reply += `_...and ${results.categories.length - 6} more categories._\n\n`;
  }

  reply += `🔗 *View Full Digital Certificate & Standings:*\n${siteUrl()}/results/${ev.slug}\n\n`;
  if (ev.is_live) {
    reply += `👉 *Cast your vote:* Reply *VOTE ${ev.slug}*`;
  }

  await sendWhatsAppMessage(phone, reply);
}


