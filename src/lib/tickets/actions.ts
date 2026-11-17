"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireVerifiedUser } from "@/lib/auth/require-user";
import type { GateCheckInResponse } from "./types";

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

    revalidatePath(`/events`, "layout");

    return {
      success: true,
      message: "Ticket purchase successful!",
      ticket: data as Record<string, unknown>,
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
