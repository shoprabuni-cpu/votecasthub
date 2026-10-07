"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { EventDetailsForm } from "@/components/events/event-details-form";
import { Icon } from "@/components/icon";
import type { VotingRule } from "@/lib/voting-rules";

type EventEditDrawerProps = {
  eventId: string;
  organizationId: string;
  smsBalance: number | null;
  initial: {
    name: string;
    description: string | null;
    price: number;
    startsAt: string;
    endsAt: string;
    resultsVisibility: string;
    votingMode: "free" | "paid";
    verificationMethod?: "phone" | "email" | "invite_code" | "voter_list";
    votingRule?: VotingRule;
    freeVoteLimit?: number | null;
    votingRules?: string | null;
  };
};

/** Trigger button + slide-over drawer for editing event draft details */
export function EventEditDrawer({ eventId, organizationId, smsBalance, initial }: EventEditDrawerProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);

  // Only render portal after hydration
  useEffect(() => {
    setMounted(true);
  }, []);

  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  // Prevent body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const drawer = mounted
    ? createPortal(
        <>
          {/* Overlay */}
          <div
            aria-hidden="true"
            onClick={() => setOpen(false)}
            className={`fixed inset-0 z-40 bg-stone-900/40 backdrop-blur-[2px] transition-opacity duration-300 ${
              open ? "opacity-100" : "opacity-0 pointer-events-none"
            }`}
          />

          {/* Slide-over panel */}
          <div
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-label="Edit Event Details"
            className={`fixed inset-y-0 right-0 z-50 flex w-full max-w-2xl flex-col bg-stone-50/95 shadow-2xl transition-transform duration-300 ease-[cubic-bezier(0.25,1,0.5,1)] ${
              open ? "translate-x-0" : "translate-x-full"
            }`}
          >
            {/* Drawer Header */}
            <div className="flex items-center justify-between border-b border-stone-200 bg-white px-5 py-4 sm:px-7 shrink-0">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-700">
                  Event Setup
                </p>
                <h2 className="text-base font-serif font-semibold text-stone-900 tracking-tight">
                  Edit Draft Details
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close edit drawer"
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-500 shadow-2xs hover:bg-stone-50 hover:text-stone-900 transition-all active:scale-95"
              >
                <Icon name="close" size={15} />
              </button>
            </div>

            {/* Scrollable form area */}
            <div className="flex-1 overflow-y-auto px-5 py-6 sm:px-7">
              <EventDetailsForm
                eventId={eventId}
                organizationId={organizationId}
                smsBalance={smsBalance}
                initial={initial}
              />
            </div>
          </div>
        </>,
        document.body
      )
    : null;

  return (
    <>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        id="btn-edit-event-details"
        className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3.5 py-2 text-xs font-semibold text-stone-800 shadow-2xs hover:bg-stone-50 hover:border-emerald-600 hover:text-emerald-900 transition-all active:scale-95 cursor-pointer"
      >
        <Icon name="pencil" size={14} />
        <span>Edit Details</span>
      </button>

      {drawer}
    </>
  );
}
