"use client";

import { useState } from "react";
import { purchaseTicketAction, type ActionState } from "@/lib/tickets/actions";
import type { TicketTier } from "@/lib/tickets/types";
import { VisualTicketPass, type TicketPassData } from "./visual-ticket-pass";

export function PublicTicketWidget({
  eventId,
  eventName,
  eventImageUrl,
  venueName,
  venueAddress,
  doorsOpenTime,
  tiers = [],
}: {
  eventId: string;
  eventName: string;
  eventImageUrl?: string | null;
  venueName?: string | null;
  venueAddress?: string | null;
  doorsOpenTime?: string | null;
  tiers: TicketTier[];
}) {
  const [selectedTierId, setSelectedTierId] = useState<string>(tiers[0]?.id ?? "");
  const [quantity, setQuantity] = useState<number>(1);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [purchasedTicket, setPurchasedTicket] = useState<TicketPassData | null>(null);

  const activeTiers = tiers.filter((t) => t.is_active);
  const selectedTier = activeTiers.find((t) => t.id === selectedTierId) ?? activeTiers[0];

  if (!activeTiers.length) {
    return (
      <div className="rounded-2xl border border-stone-200 bg-stone-50 p-6 text-center dark:border-[#1c2721] dark:bg-[#070a08]">
        <p className="text-sm font-semibold text-stone-600 dark:text-stone-300">
          Tickets for this event are not yet on sale.
        </p>
      </div>
    );
  }

  const unitPriceGhs = (selectedTier?.price_minor ?? 0) / 100;
  const totalPriceGhs = unitPriceGhs * quantity;
  const remaining = (selectedTier?.capacity ?? 0) - (selectedTier?.sold_count ?? 0);
  const isSoldOut = remaining <= 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!selectedTierId) {
      setError("Please select a ticket tier.");
      return;
    }
    if (!customerName.trim() || customerName.trim().length < 2) {
      setError("Please enter your full name.");
      return;
    }
    if (!customerPhone.trim() || customerPhone.replace(/\D/g, "").length < 9) {
      setError("Please enter a valid Ghana phone number (for MoMo and SMS ticket).");
      return;
    }

    setLoading(true);

    try {
      const isFree = (selectedTier.price_minor ?? 0) === 0;

      if (isFree) {
        const formData = new FormData();
        formData.append("eventId", eventId);
        formData.append("tierId", selectedTierId);
        formData.append("quantity", String(quantity));
        formData.append("customerName", customerName.trim());
        formData.append("customerPhone", customerPhone.trim());
        if (customerEmail.trim()) formData.append("customerEmail", customerEmail.trim());

        const res: ActionState = await purchaseTicketAction({}, formData);
        if (res.error) {
          setError(res.error);
        } else if (res.success && res.ticket) {
          const t = res.ticket;
          setPurchasedTicket({
            pax_code: String(t.pax_code ?? ""),
            customer_name: customerName,
            tier_name: selectedTier.name,
            event_name: eventName,
            venue_name: venueName,
            venue_address: venueAddress,
            doors_open_time: doorsOpenTime,
            event_image_url: eventImageUrl,
            quantity,
            price_minor: 0,
            order_reference: String(t.order_reference ?? ""),
            status: "valid",
          });
        }
      } else {
        // Paid Ticket: Call Paystack checkout API
        const response = await fetch("/api/payments/paystack/ticket", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            eventId,
            tierId: selectedTierId,
            quantity,
            customerName: customerName.trim(),
            customerPhone: customerPhone.trim(),
            customerEmail: customerEmail.trim(),
          }),
        });

        const data = await response.json();
        if (!response.ok || data.error) {
          setError(data.error || "Failed to initiate ticket payment.");
        } else if (data.authorization_url) {
          // Redirect to Paystack Mobile Money / Card checkout
          window.location.href = data.authorization_url;
          return;
        } else if (data.isFree && data.ticket) {
          const t = data.ticket;
          setPurchasedTicket({
            pax_code: String(t.pax_code ?? ""),
            customer_name: customerName,
            tier_name: selectedTier.name,
            event_name: eventName,
            venue_name: venueName,
            venue_address: venueAddress,
            doors_open_time: doorsOpenTime,
            event_image_url: eventImageUrl,
            quantity,
            price_minor: selectedTier.price_minor * quantity,
            order_reference: String(t.order_reference ?? ""),
            status: "valid",
          });
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to place order.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div id="tickets-widget" className="w-full">
      {/* Success Modal / Confirmation Card */}
      {purchasedTicket ? (
        <div className="space-y-4">
          <div className="rounded-2xl border border-emerald-300 bg-emerald-50 p-4 text-center dark:border-emerald-700/60 dark:bg-[#0b1f14]">
            <p className="text-sm font-bold text-emerald-950 dark:text-emerald-200">
              🎉 Congratulations! Your tickets have been confirmed.
            </p>
            <p className="mt-1 text-xs text-emerald-800 dark:text-emerald-300">
              An SMS with your ticket code <strong>{purchasedTicket.pax_code}</strong> has been sent to {customerPhone}.
            </p>
          </div>

          <VisualTicketPass ticket={purchasedTicket} />
        </div>
      ) : (
        /* Purchase Form */
        <form
          onSubmit={handleSubmit}
          className="rounded-3xl border border-emerald-200/90 bg-white p-5 shadow-lg dark:border-[#1c2721] dark:bg-[#070a08] sm:p-7"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-100 pb-4 dark:border-[#1c2721]">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100/80 px-2.5 py-0.5 text-[11px] font-bold text-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">
                🎟️ OFFICIAL TICKETS
              </span>
              <h3 className="mt-1 text-lg font-bold text-stone-900 dark:text-white sm:text-xl">
                Get Your Entry Ticket
              </h3>
            </div>
            {venueName && (
              <span className="text-xs font-semibold text-stone-500 dark:text-stone-400">
                📍 {venueName}
              </span>
            )}
          </div>

          {/* 1. Select Ticket Tier */}
          <div className="mt-5 space-y-2.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 dark:text-stone-300">
              Select Ticket Tier
            </label>
            <div className="grid gap-2.5 sm:grid-cols-2">
              {activeTiers.map((tier) => {
                const isSelected = tier.id === selectedTierId;
                const tierRemaining = tier.capacity - tier.sold_count;
                const tierSoldOut = tierRemaining <= 0;

                return (
                  <button
                    key={tier.id}
                    type="button"
                    disabled={tierSoldOut}
                    onClick={() => {
                      setSelectedTierId(tier.id);
                      setQuantity(1);
                    }}
                    className={`flex flex-col justify-between rounded-2xl border p-3.5 text-left transition-all cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 ${
                      isSelected
                        ? "border-emerald-600 bg-emerald-50/70 shadow-xs ring-2 ring-emerald-600/20 dark:border-emerald-500 dark:bg-[#0e2417]"
                        : "border-stone-200 bg-stone-50/60 hover:border-emerald-300 dark:border-[#1c2721] dark:bg-[#0a0d0b] dark:hover:border-emerald-700"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-stone-900 dark:text-white">
                        {tier.name}
                      </span>
                      <span className="text-sm font-black text-emerald-800 dark:text-emerald-400">
                        GHS {(tier.price_minor / 100).toFixed(2)}
                      </span>
                    </div>

                    {tier.description && (
                      <p className="mt-1 line-clamp-1 text-xs text-stone-500 dark:text-stone-400">
                        {tier.description}
                      </p>
                    )}

                    <div className="mt-2 text-[11px] font-semibold text-stone-500 dark:text-stone-400">
                      {tierSoldOut ? (
                        <span className="text-red-600 font-bold">SOLD OUT</span>
                      ) : tierRemaining < 10 ? (
                        <span className="text-amber-600 font-bold">Only {tierRemaining} left!</span>
                      ) : (
                        <span>Available</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Quantity Selector */}
          <div className="mt-5 flex items-center justify-between rounded-2xl border border-stone-200 bg-stone-50/70 p-3.5 dark:border-[#1c2721] dark:bg-[#0a0d0b]">
            <div>
              <p className="text-sm font-bold text-stone-900 dark:text-white">Quantity</p>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                GHS {unitPriceGhs.toFixed(2)} each
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                disabled={quantity <= 1}
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                className="flex size-9 items-center justify-center rounded-xl border border-stone-300 bg-white font-bold text-stone-800 shadow-2xs hover:bg-stone-50 disabled:opacity-40 cursor-pointer dark:border-[#202d24] dark:bg-[#121814] dark:text-stone-200"
              >
                -
              </button>
              <span className="w-6 text-center font-bold text-base text-stone-900 dark:text-white">
                {quantity}
              </span>
              <button
                type="button"
                disabled={quantity >= Math.min(10, remaining)}
                onClick={() => setQuantity((q) => q + 1)}
                className="flex size-9 items-center justify-center rounded-xl border border-stone-300 bg-white font-bold text-stone-800 shadow-2xs hover:bg-stone-50 disabled:opacity-40 cursor-pointer dark:border-[#202d24] dark:bg-[#121814] dark:text-stone-200"
              >
                +
              </button>
            </div>
          </div>

          {/* 3. Attendee Details (Only Name & Phone) */}
          <div className="mt-5 space-y-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 dark:text-stone-300">
                Your Full Name *
              </label>
              <input
                type="text"
                required
                maxLength={80}
                placeholder="e.g. Kofi Mensah"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="mt-1.5 min-h-12 w-full rounded-xl border border-stone-200 bg-white px-3.5 text-sm text-stone-900 shadow-xs focus:border-emerald-600 focus:outline-hidden focus:ring-3 focus:ring-emerald-600/20 dark:border-[#1c2721] dark:bg-[#030504] dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 dark:text-stone-300">
                Phone Number (for MoMo payment &amp; SMS ticket) *
              </label>
              <input
                type="tel"
                required
                maxLength={15}
                placeholder="e.g. 054 123 4567"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                className="mt-1.5 min-h-12 w-full rounded-xl border border-stone-200 bg-white px-3.5 text-sm text-stone-900 shadow-xs focus:border-emerald-600 focus:outline-hidden focus:ring-3 focus:ring-emerald-600/20 dark:border-[#1c2721] dark:bg-[#030504] dark:text-white"
              />
              <p className="mt-1 text-[11px] text-stone-500 dark:text-stone-400">
                Supports MTN Mobile Money, Telecel Cash, and AT Money.
              </p>
            </div>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700 dark:border-red-900/60 dark:bg-red-950/60 dark:text-red-300">
              ⚠️ {error}
            </div>
          )}

          {/* Total & Submit Button */}
          <div className="mt-6 pt-4 border-t border-stone-100 dark:border-[#1c2721]">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-semibold text-stone-600 dark:text-stone-300">
                Total Payable:
              </span>
              <span className="text-xl font-black text-stone-900 dark:text-white">
                GHS {totalPriceGhs.toFixed(2)}
              </span>
            </div>

            <button
              type="submit"
              disabled={loading || isSoldOut}
              className="flex min-h-12 w-full items-center justify-center rounded-xl bg-emerald-900 px-6 font-bold text-white shadow-md hover:bg-emerald-800 disabled:opacity-50 transition-all cursor-pointer dark:bg-emerald-600 dark:hover:bg-emerald-500"
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <span className="size-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  <span>Processing Ticket...</span>
                </span>
              ) : isSoldOut ? (
                "Sold Out"
              ) : (
                `Pay GHS ${totalPriceGhs.toFixed(2)} with MoMo`
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
