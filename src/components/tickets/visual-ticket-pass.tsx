"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import QRCode from "qrcode";
import { Icon } from "@/components/icon";

export interface TicketPassData {
  pax_code: string;
  customer_name: string;
  tier_name: string;
  event_name: string;
  venue_name?: string | null;
  venue_address?: string | null;
  doors_open_time?: string | null;
  event_image_url?: string | null;
  quantity: number;
  price_minor: number;
  order_reference?: string;
  status: "valid" | "checked_in" | "cancelled";
  checked_in_at?: string | null;
}

export function VisualTicketPass({
  ticket,
  showActions = true,
}: {
  ticket: TicketPassData;
  showActions?: boolean;
}) {
  const [qrDataUrl, setQrDataUrl] = useState<string>("");

  useEffect(() => {
    // Generate secure QR payload containing the PAX Code and order ref
    const payload = JSON.stringify({
      pax: ticket.pax_code,
      order: ticket.order_reference,
      event: ticket.event_name,
    });

    QRCode.toDataURL(payload, {
      width: 240,
      margin: 1,
      color: {
        dark: "#000000",
        light: "#ffffff",
      },
    })
      .then(setQrDataUrl)
      .catch(console.error);
  }, [ticket.pax_code, ticket.order_reference, ticket.event_name]);

  const isValid = ticket.status === "valid";
  const isCheckedIn = ticket.status === "checked_in";

  return (
    <div className="relative mx-auto w-full max-w-md overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-xl transition-all dark:border-[#1c2721] dark:bg-[#070a08]">
      {/* 1. Header / Event Flyer */}
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-emerald-950">
        {ticket.event_image_url ? (
          <Image
            src={ticket.event_image_url}
            alt={ticket.event_name}
            fill
            unoptimized
            className="object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-emerald-950 via-[#071d12] to-emerald-900 p-6 text-center">
            <span className="font-serif text-2xl font-bold tracking-tight text-white/90">
              {ticket.event_name}
            </span>
          </div>
        )}

        {/* Status Pill on Flyer */}
        <div className="absolute top-3 right-3 z-10">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold shadow-md ${
              isValid
                ? "bg-emerald-600 text-white"
                : isCheckedIn
                ? "bg-amber-600 text-white"
                : "bg-red-600 text-white"
            }`}
          >
            <span className="size-2 rounded-full bg-white animate-pulse" />
            {isValid ? "VALID ENTRY" : isCheckedIn ? "CHECKED IN" : "CANCELLED"}
          </span>
        </div>

        {/* Tier Chip */}
        <div className="absolute bottom-3 left-3 z-10">
          <span className="rounded-xl bg-black/75 backdrop-blur-md px-3 py-1 text-xs font-bold text-emerald-300 border border-emerald-500/30">
            {ticket.tier_name}
          </span>
        </div>
      </div>

      {/* 2. Event Info Strip */}
      <div className="p-5 pb-4">
        <h2 className="text-xl font-bold tracking-tight text-stone-900 dark:text-white sm:text-2xl">
          {ticket.event_name}
        </h2>

        <div className="mt-3 space-y-1.5 text-xs text-stone-600 dark:text-stone-300">
          {ticket.venue_name && (
            <p className="flex items-center gap-2 font-medium">
              <span className="text-emerald-700 dark:text-emerald-400">📍</span>
              <span className="font-semibold text-stone-900 dark:text-white">
                {ticket.venue_name}
              </span>
              {ticket.venue_address && <span>({ticket.venue_address})</span>}
            </p>
          )}

          {ticket.doors_open_time && (
            <p className="flex items-center gap-2">
              <span className="text-emerald-700 dark:text-emerald-400">⏰</span>
              <span>Doors open: <strong>{ticket.doors_open_time}</strong></span>
            </p>
          )}
        </div>
      </div>

      {/* 3. Ticket Perforated Cut Line with Side Notches */}
      <div className="relative flex items-center justify-between py-2">
        {/* Left Cut Notch */}
        <div className="size-6 -ml-3 rounded-full bg-stone-100 border border-stone-200 dark:bg-black dark:border-[#1c2721]" />
        {/* Dashed Cut Line */}
        <div className="w-full border-t-2 border-dashed border-stone-300 dark:border-stone-700 mx-2" />
        {/* Right Cut Notch */}
        <div className="size-6 -mr-3 rounded-full bg-stone-100 border border-stone-200 dark:bg-black dark:border-[#1c2721]" />
      </div>

      {/* 4. Attendee & Auto-Generated "CODE PAX" Section */}
      <div className="p-5 pt-3">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400">
              Ticket Holder
            </p>
            <p className="text-base font-bold text-stone-900 dark:text-white">
              {ticket.customer_name}
            </p>
            <p className="text-xs text-emerald-800 dark:text-emerald-400 font-semibold">
              {ticket.quantity} {ticket.quantity === 1 ? "Person" : "Persons"} ({ticket.tier_name})
            </p>
          </div>

          <div className="text-right">
            <p className="text-[11px] font-bold uppercase tracking-widest text-emerald-700 dark:text-emerald-400">
              VERIFICATION
            </p>
            {/* Auto-generated memorable PAX Code */}
            <div className="inline-block rounded-xl bg-emerald-50 px-3 py-1.5 border border-emerald-200 dark:bg-[#0f281b] dark:border-emerald-600/60 shadow-xs">
              <span className="text-base font-mono font-black tracking-wider text-emerald-950 dark:text-emerald-200">
                {ticket.pax_code}
              </span>
            </div>
          </div>
        </div>

        {/* 5. QR Code Card */}
        <div className="mt-5 flex flex-col items-center justify-center rounded-2xl border border-stone-200 bg-stone-50 p-4 dark:border-[#1c2721] dark:bg-[#0c100e]">
          {qrDataUrl ? (
            <div className="rounded-xl bg-white p-2.5 shadow-sm">
              <Image
                src={qrDataUrl}
                alt={`QR code for ${ticket.pax_code}`}
                width={170}
                height={170}
                className="size-40"
              />
            </div>
          ) : (
            <div className="flex size-40 items-center justify-center rounded-xl bg-white">
              <span className="size-6 animate-spin rounded-full border-2 border-emerald-700 border-t-transparent" />
            </div>
          )}

          <p className="mt-2.5 text-center text-xs font-semibold text-stone-600 dark:text-stone-400">
            Show this QR code or mention <strong className="text-stone-900 dark:text-white">{ticket.pax_code}</strong> at the gate.
          </p>
        </div>

        {/* 6. Action buttons */}
        {showActions && (
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-stone-200 bg-white px-4 text-xs font-bold text-stone-800 shadow-xs hover:bg-stone-50 transition-all dark:border-[#1c2721] dark:bg-[#111713] dark:text-stone-200 dark:hover:bg-[#18221b] cursor-pointer"
            >
              <Icon name="download" size={14} />
              <span>Save / Print</span>
            </button>

            <Link
              href="/"
              className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-900 px-4 text-xs font-bold text-white shadow-xs hover:bg-emerald-800 transition-all dark:bg-emerald-600 dark:hover:bg-emerald-500 cursor-pointer"
            >
              <span>Back to Home</span>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
