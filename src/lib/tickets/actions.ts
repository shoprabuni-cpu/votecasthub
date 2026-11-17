"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireVerifiedUser } from "@/lib/auth/require-user";
import type { GateCheckInResponse } from "./types";
import { normalizeGhanaPhone, sendTicketConfirmationSms } from "@/lib/sms/send-ticket-sms";

export type ActionState = {
  success?: boolean;
  message?: string;
  error?: string;
  ticket?: Record<string, unknown>;
};

/**
 * Organizer: Create a new Ticket Tier
 */
export async function createTicketTierAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    const { supabase } = await requireVerifiedUser();

    const eventId = formData.get("eventId")?.toString()?.trim();
    const name = formData.get("name")?.toString()?.trim();
    const priceGhs = parseFloat(formData.get("priceGhs")?.toString() ?? "0");
    const capacity = parseInt(formData.get("capacity")?.toString() ?? "100", 10);
    const description = formData.get("description")?.toString()?.trim() || null;

    if (!eventId) return { error: "Event ID is required." };
    if (!name || name.length < 1) return { error: "Ticket name is required (e.g. Regular, VIP)." };
    if (isNaN(priceGhs) || priceGhs < 0) return { error: "Price must be 0 or greater." };
    if (isNaN(capacity) || capacity < 1) return { error: "Quantity must be at least 1." };

    const priceMinor = Math.round(priceGhs * 100);

    const { error } = await supabase.from("event_ticket_tiers").insert({
      event_id: eventId,
      name,
      price_minor: priceMinor,
      capacity,
      description,
      is_active: true,
    });

    if (error) {
      return { error: error.message };
    }

    revalidatePath(`/organizer`, "layout");
    revalidatePath(`/events`, "layout");
    return { success: true, message: `Created "${name}" ticket tier.` };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to create ticket tier." };
  }
}

/**
 * Organizer: Delete a Ticket Tier (if 0 tickets sold)
 */
export async function deleteTicketTierAction(
  tierId: string,
  eventId: string
): Promise<ActionState> {
  try {
    const { supabase } = await requireVerifiedUser();

    const { data: tier } = await supabase
      .from("event_ticket_tiers")
      .select("id, name, sold_count")
      .eq("id", tierId)
      .eq("event_id", eventId)
      .maybeSingle();

    if (!tier) return { error: "Ticket tier not found." };
    if (tier.sold_count > 0) {
      return { error: `Cannot delete "${tier.name}" because ${tier.sold_count} tickets have already been sold.` };
    }

    const { error } = await supabase
      .from("event_ticket_tiers")
      .delete()
      .eq("id", tierId)
      .eq("event_id", eventId);

    if (error) return { error: error.message };

    revalidatePath(`/organizer`, "layout");
    revalidatePath(`/events`, "layout");
    return { success: true, message: `Deleted ticket tier.` };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to delete ticket tier." };
  }
}

/**
 * Organizer: Update Event Venue, Address, and Doors Open Time
 */
export async function updateTicketVenueAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    const { supabase } = await requireVerifiedUser();

    const eventId = formData.get("eventId")?.toString()?.trim();
    const venueName = formData.get("venueName")?.toString()?.trim() || null;
    const venueAddress = formData.get("venueAddress")?.toString()?.trim() || null;
    const doorsOpenTime = formData.get("doorsOpenTime")?.toString()?.trim() || null;

    if (!eventId) return { error: "Event ID is required." };

    const { error } = await supabase
      .from("events")
      .update({
        venue_name: venueName,
        venue_address: venueAddress,
        doors_open_time: doorsOpenTime,
        updated_at: new Date().toISOString(),
      })
      .eq("id", eventId);

    if (error) return { error: error.message };

    revalidatePath(`/organizer`, "layout");
    revalidatePath(`/events`, "layout");
    return { success: true, message: "Venue & timing details saved." };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to update venue details." };
  }
}

/**
 * Attendee: Purchase Event Tickets (Generates unique CODE PAX)
 */
export async function purchaseTicketAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    const supabase = await createClient();

    const eventId = formData.get("eventId")?.toString()?.trim();
    const tierId = formData.get("tierId")?.toString()?.trim();
    const quantity = parseInt(formData.get("quantity")?.toString() ?? "1", 10);
    const customerName = formData.get("customerName")?.toString()?.trim();
    const customerPhone = formData.get("customerPhone")?.toString()?.trim();
    const customerEmail = formData.get("customerEmail")?.toString()?.trim() || null;

    if (!eventId || !tierId) return { error: "Event and ticket tier are required." };
    if (!customerName || customerName.length < 2) return { error: "Please enter your full name." };
    if (!customerPhone || customerPhone.replace(/\D/g, "").length < 9) {
      return { error: "Please enter a valid Ghana phone number." };
    }
    if (isNaN(quantity) || quantity < 1 || quantity > 20) {
      return { error: "Please select between 1 and 20 tickets." };
    }

    const { data, error } = await supabase.rpc("purchase_event_ticket", {
      p_event_id: eventId,
      p_tier_id: tierId,
      p_quantity: quantity,
      p_customer_name: customerName,
      p_customer_phone: customerPhone,
      p_customer_email: customerEmail,
      p_channel: "web",
    });

    if (error) {
      return { error: error.message };
    }

    const ticketData = data as Record<string, unknown>;

    // Send instant SMS with CODE PAX to customer phone
    if (customerPhone && ticketData?.pax_code) {
      sendTicketConfirmationSms({
        phone: customerPhone,
        customerName,
        eventName: (ticketData.event_name as string) || "Event",
        tierName: (ticketData.tier_name as string) || "Standard",
        paxCode: ticketData.pax_code as string,
        venueName: (ticketData.venue_name as string) || null,
      }).catch((smsErr) => console.error("Ticket SMS async error:", smsErr));
    }

    revalidatePath(`/events`, "layout");

    return {
      success: true,
      message: "Ticket purchase successful!",
      ticket: ticketData,
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to complete ticket order." };
  }
}

/**
 * Gate Usher: Check in Ticket by PAX Code or QR payload
 */
export async function gateCheckInAction(
  paxCode: string,
  usherName = "Gate Usher"
): Promise<GateCheckInResponse> {
  try {
    const supabase = await createClient();

    if (!paxCode || paxCode.trim().length < 3) {
      return { status: "invalid", message: "Please enter a valid PAX Code." };
    }

    const cleanCode = paxCode.trim().toUpperCase();

    const { data, error } = await supabase.rpc("check_in_ticket", {
      p_pax_code: cleanCode,
      p_usher_name: usherName,
    });

    if (error) {
      return { status: "invalid", message: error.message };
    }

    return data as GateCheckInResponse;
  } catch (err) {
    return {
      status: "invalid",
      message: err instanceof Error ? err.message : "Network error validating ticket.",
    };
  }
}

export type AttendeeRecord = {
  id: string;
  pax_code: string;
  order_reference: string;
  customer_name: string;
  customer_phone: string;
  customer_email?: string | null;
  quantity: number;
  price_minor: number;
  channel: string;
  status: string;
  tier_name: string;
  checked_in_at?: string | null;
  checked_in_by?: string | null;
  created_at: string;
};

/**
 * Organizer: Fetch full attendee roster for an event
 */
export async function getEventAttendeesAction(eventId: string): Promise<AttendeeRecord[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("get_event_attendees", { p_event_id: eventId });
    if (error) return [];
    return (data ?? []) as AttendeeRecord[];
  } catch {
    return [];
  }
}

export type FoundTicket = {
  id: string;
  pax_code: string;
  order_reference: string;
  customer_name: string;
  customer_phone: string;
  quantity: number;
  tier_name: string;
  status: string;
  created_at: string;
  event_name: string;
  event_slug: string;
  image_path?: string | null;
  imageUrl?: string | null;
  venue_name?: string | null;
  venue_address?: string | null;
  doors_open_time?: string | null;
  starts_at: string;
  ends_at: string;
};

/**
 * Public: Search and retrieve tickets by phone number or PAX Code
 */
export async function findPublicTicketsAction(query: string): Promise<FoundTicket[]> {
  const clean = query?.trim();
  if (!clean || clean.length < 3) return [];
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("find_public_tickets", { p_query: clean });
    if (error || !data) return [];
    const tickets = data as (FoundTicket & { image_path: string | null })[];

    const paths = [...new Set(tickets.flatMap((t) => (t.image_path ? [t.image_path] : [])))];
    const { data: images } = paths.length
      ? await supabase.storage.from("nominee-images").createSignedUrls(paths, 3600)
      : { data: [] };
    const urls = new Map(
      (images ?? []).flatMap((img) => (img.path && img.signedUrl ? [[img.path, img.signedUrl] as const] : []))
    );

    return tickets.map((t) => ({
      ...t,
      imageUrl: t.image_path ? urls.get(t.image_path) ?? null : null,
    }));
  } catch {
    return [];
  }
}

/**
 * Organizer: Send SMS broadcast announcement to all ticket holders of an event
 */
export async function broadcastTicketSmsAction(
  eventId: string,
  message: string
): Promise<{ success: boolean; sentCount?: number; error?: string }> {
  try {
    const supabase = await createClient();
    const cleanMsg = message.trim();
    if (!cleanMsg || cleanMsg.length < 5) {
      return { success: false, error: "Please enter a message of at least 5 characters." };
    }

    await requireVerifiedUser();

    const { data: tickets, error } = await supabase
      .from("event_tickets")
      .select("customer_phone")
      .eq("event_id", eventId)
      .in("status", ["valid", "checked_in"]);

    if (error) return { success: false, error: error.message };

    const rawPhones = (tickets ?? []).map((t) => t.customer_phone).filter(Boolean);
    const normalizedRecipients = [...new Set(rawPhones.map(normalizeGhanaPhone))].filter((p) => p.length >= 9);

    if (normalizedRecipients.length === 0) {
      return { success: false, error: "No ticket holders found to message." };
    }

    const apiKey = process.env.ARKESEL_API_KEY;
    const senderId = process.env.ARKESEL_SENDER_ID || "VoteCastHub";

    if (!apiKey) {
      console.info(`[Ticket Broadcast Dev Mode] Simulated broadcast to ${normalizedRecipients.length} phones: "${cleanMsg}"`);
      return { success: true, sentCount: normalizedRecipients.length };
    }

    const res = await fetch("https://sms.arkesel.com/api/v2/sms/send", {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sender: senderId,
        message: cleanMsg,
        recipients: normalizedRecipients,
      }),
    });

    if (!res.ok) {
      return { success: false, error: `Arkesel returned status ${res.status}` };
    }

    return { success: true, sentCount: normalizedRecipients.length };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Broadcast failed" };
  }
}

/**
 * Organizer: Create a dedicated Ticketed Event with initial ticket tiers
 */
export async function createTicketEventAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  let redirectUrl: string | null = null;
  try {
    const { supabase } = await requireVerifiedUser();

    const organizationId = formData.get("organizationId")?.toString()?.trim();
    const name = formData.get("name")?.toString()?.trim();
    const venueName = formData.get("venueName")?.toString()?.trim();
    const venueAddress = formData.get("venueAddress")?.toString()?.trim() || null;
    const doorsOpenTime = formData.get("doorsOpenTime")?.toString()?.trim() || null;
    const startsAtRaw = formData.get("startsAt")?.toString()?.trim();
    const endsAtRaw = formData.get("endsAt")?.toString()?.trim();
    const description = formData.get("description")?.toString()?.trim() || null;

    if (!organizationId) return { error: "Organization ID is required." };
    if (!name || name.length < 2) return { error: "Event title must be at least 2 characters." };
    if (!venueName || venueName.length < 2) return { error: "Venue name is required (e.g. Grand Arena, AICC)." };
    if (!startsAtRaw || !endsAtRaw) return { error: "Event start and end dates are required." };

    const startDate = new Date(startsAtRaw);
    const endDate = new Date(endsAtRaw);
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return { error: "Invalid date format." };
    }
    if (startDate >= endDate) {
      return { error: "Event end time must be after start time." };
    }

    // Generate unique slug
    const cleanBase = name
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 88);
    const slug = `${cleanBase || "ticket-event"}-${Math.random().toString(36).substring(2, 8)}`;

    // Call create_event RPC
    const { data: newEventId, error: createError } = await supabase.rpc("create_event", {
      p_organization_id: organizationId,
      p_name: name,
      p_slug: slug,
      p_description: description,
      p_unit_price_minor: 0,
      p_starts_at: startDate.toISOString(),
      p_ends_at: endDate.toISOString(),
      p_results_visibility: "hidden",
      p_voting_mode: "free",
      p_free_vote_limit_per_phone: null,
      p_voting_rule: "one_per_category",
      p_voting_rules: null,
    });

    if (createError || !newEventId) {
      return { error: createError?.message || "Failed to create ticketing event." };
    }

    // Update event_type and venue details
    await supabase
      .from("events")
      .update({
        event_type: "ticketing",
        venue_name: venueName,
        venue_address: venueAddress,
        doors_open_time: doorsOpenTime,
      })
      .eq("id", newEventId);

    // Create Initial Ticket Tier 1 (e.g. Regular / Standard)
    const tierName = formData.get("tierName")?.toString()?.trim() || "Regular";
    const tierPriceGhs = parseFloat(formData.get("tierPriceGhs")?.toString() ?? "0") || 0;
    const tierCapacity = parseInt(formData.get("tierCapacity")?.toString() ?? "100", 10) || 100;

    await supabase.from("event_ticket_tiers").insert({
      event_id: newEventId,
      name: tierName,
      price_minor: Math.round(tierPriceGhs * 100),
      capacity: tierCapacity,
      is_active: true,
      sort_order: 1,
    });

    // Optional Tier 2 (e.g. VIP / Table)
    const tier2Name = formData.get("tier2Name")?.toString()?.trim();
    if (tier2Name) {
      const tier2PriceGhs = parseFloat(formData.get("tier2PriceGhs")?.toString() ?? "0") || 0;
      const tier2Capacity = parseInt(formData.get("tier2Capacity")?.toString() ?? "50", 10) || 50;
      await supabase.from("event_ticket_tiers").insert({
        event_id: newEventId,
        name: tier2Name,
        price_minor: Math.round(tier2PriceGhs * 100),
        capacity: tier2Capacity,
        is_active: true,
        sort_order: 2,
      });
    }

    revalidatePath(`/organizer/${organizationId}/events`);
    redirectUrl = `/organizer/${organizationId}/events/${newEventId}`;
  } catch (err: any) {
    if (err?.digest?.startsWith?.("NEXT_REDIRECT")) throw err;
    return { error: err instanceof Error ? err.message : "Failed to create ticketing event." };
  }

  if (redirectUrl) {
    redirect(redirectUrl);
  }
  return { success: true };
}
