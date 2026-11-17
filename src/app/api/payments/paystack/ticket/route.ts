import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { paymentAdmin } from "@/lib/payments/admin";
import { allow, opaque, siteUrl } from "@/lib/payments/gateway";
import { initializeCheckout } from "@/lib/payments/checkout";
import { normalizeGhanaPhone, sendTicketConfirmationSms } from "@/lib/sms/send-ticket-sms";

export const runtime = "nodejs";

const schema = z.object({
  eventId: z.string().uuid(),
  tierId: z.string().uuid(),
  quantity: z.number().int().min(1).max(20),
  customerName: z.string().trim().min(2).max(100),
  customerPhone: z.string().trim().min(9).max(20),
  customerEmail: z.string().trim().email().max(254).optional().or(z.literal("")),
});

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const parsed = schema.safeParse(json);
    if (!parsed.success) {
      return Response.json({ error: "Please check your name, phone number, and ticket quantity." }, { status: 400 });
    }

    const { eventId, tierId, quantity, customerName, customerPhone, customerEmail } = parsed.data;
    const db = paymentAdmin();

    const ip = request.headers.get("x-vercel-forwarded-for") || request.headers.get("x-forwarded-for") || "unknown";
    if (!(await allow(`ticket-ip:${opaque(ip)}`, 25, 600))) {
      return Response.json({ error: "Too many ticket requests. Please try again in a few minutes." }, { status: 429 });
    }

    // Verify event
    const { data: event, error: eventErr } = await db
      .from("events")
      .select("id, organization_id, name, venue_name, status, starts_at, ends_at")
      .eq("id", eventId)
      .maybeSingle();

    if (eventErr || !event || event.status === "closed") {
      return Response.json({ error: "This event is currently closed or unavailable." }, { status: 409 });
    }

    // Verify ticket tier
    const { data: tier, error: tierErr } = await db
      .from("event_ticket_tiers")
      .select("id, name, price_minor, capacity, sold_count, is_active")
      .eq("id", tierId)
      .eq("event_id", eventId)
      .eq("is_active", true)
      .maybeSingle();

    if (tierErr || !tier) {
      return Response.json({ error: "This ticket tier is no longer active." }, { status: 409 });
    }

    if (tier.sold_count + quantity > tier.capacity) {
      const remaining = Math.max(0, tier.capacity - tier.sold_count);
      return Response.json({ error: `Only ${remaining} ticket${remaining === 1 ? "" : "s"} remaining in this tier.` }, { status: 409 });
    }

    const totalMinor = Number(tier.price_minor) * quantity;

    // Free Ticket: issue immediately
    if (totalMinor === 0) {
      const { data: ticket, error: purchaseErr } = await db.rpc("purchase_event_ticket", {
        p_event_id: eventId,
        p_tier_id: tierId,
        p_quantity: quantity,
        p_customer_name: customerName,
        p_customer_phone: customerPhone,
        p_customer_email: customerEmail || null,
        p_channel: "web",
        p_initial_status: "valid",
      });

      if (purchaseErr) {
        return Response.json({ error: purchaseErr.message }, { status: 409 });
      }

      const ticketObj = ticket as Record<string, unknown>;
      if (customerPhone && ticketObj?.pax_code) {
        sendTicketConfirmationSms({
          phone: customerPhone,
          customerName,
          eventName: event.name,
          tierName: tier.name,
          paxCode: String(ticketObj.pax_code),
          venueName: event.venue_name,
        }).catch(() => {});
      }

      return Response.json({ success: true, isFree: true, ticket: ticketObj });
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
    const { data: reservedTicket, error: reserveErr } = await db.rpc("purchase_event_ticket", {
      p_event_id: eventId,
      p_tier_id: tierId,
      p_quantity: quantity,
      p_customer_name: customerName,
      p_customer_phone: customerPhone,
      p_customer_email: customerEmail || null,
      p_order_reference: orderRef,
      p_channel: "web",
      p_initial_status: "pending",
    });

    if (reserveErr) {
      return Response.json({ error: reserveErr.message }, { status: 409 });
    }

    const buyerEmail = customerEmail && customerEmail.includes("@")
      ? customerEmail
      : `${normalizeGhanaPhone(customerPhone)}@tickets.votecasthub.com`;

    const origin = siteUrl();
    const subaccountParams = account?.subaccount_code
      ? {
          subaccount: account.subaccount_code,
          bearer: "account",
          transaction_charge: Math.floor(totalMinor / 10), // 10% platform fee
        }
      : {};

    const authorizationUrl = await initializeCheckout(orderRef, {
      email: buyerEmail,
      amount: totalMinor,
      currency: "GHS",
      ...subaccountParams,
      callback_url: `${origin}/payments/complete?reference=${orderRef}`,
      metadata: {
        kind: "paid_ticket",
        order_reference: orderRef,
        event_id: eventId,
        tier_id: tierId,
        quantity,
        customer_name: customerName,
        customer_phone: customerPhone,
      },
    });

    return Response.json({
      success: true,
      isFree: false,
      authorization_url: authorizationUrl,
      order_reference: orderRef,
    });
  } catch (err) {
    console.error("paid_ticket_checkout_failed:", err);
    return Response.json(
      { error: "Ticket checkout could not be initiated. Please try again shortly." },
      { status: 503 }
    );
  }
}
