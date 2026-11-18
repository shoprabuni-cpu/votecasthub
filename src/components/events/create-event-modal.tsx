"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { TicketIcon, VoteIcon } from "@/components/brand-icons";

type Props = {
  organizationId: string;
  trigger?: React.ReactNode;
  className?: string;
};

export function CreateEventModal({ organizationId, trigger, className }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      const original = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = original;
      };
    }
  }, [isOpen]);

  const modalContent = isOpen ? (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-event-modal-title"
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6"
    >
      {/* Full Screen Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
        onClick={() => setIsOpen(false)}
      />

      {/* Centered Modal Card */}
      <div className="relative z-10 w-full max-w-xl overflow-hidden rounded-2xl border border-stone-200 bg-white p-6 sm:p-7 shadow-2xl dark:border-stone-800 dark:bg-stone-900">
        {/* Close Button */}
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="absolute right-4 top-4 rounded-lg p-2 text-stone-400 hover:bg-stone-100 hover:text-stone-700 dark:hover:bg-stone-800 dark:hover:text-stone-200 transition-colors cursor-pointer"
          aria-label="Close"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="mb-5">
          <h2
            id="create-event-modal-title"
            className="text-xl sm:text-2xl font-serif font-bold text-stone-900 dark:text-white tracking-tight"
          >
            Create an Event
          </h2>
          <p className="mt-1 text-xs sm:text-sm text-stone-600 dark:text-stone-400">
            Select the kind of event you want to set up:
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {/* Card 1: Tickets */}
          <Link
            href={`/organizer/${organizationId}/events/new?type=ticketing`}
            onClick={() => setIsOpen(false)}
            className="group flex flex-col justify-between rounded-xl border border-stone-200 bg-stone-50/70 p-4 transition-all hover:border-emerald-600 hover:bg-emerald-50/40 dark:border-stone-800 dark:bg-stone-950/60 dark:hover:border-emerald-700 dark:hover:bg-emerald-950/20"
          >
            <div>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-700 text-white shadow-xs mb-3">
                <TicketIcon size={22} />
              </div>
              <h3 className="text-sm font-bold text-stone-900 dark:text-white group-hover:text-emerald-800 dark:group-hover:text-emerald-400">
                Ticketed Event
              </h3>
              <p className="mt-1 text-[11px] text-stone-500 dark:text-stone-400 leading-relaxed">
                Concerts, summits, conferences, festivals & parties.
              </p>
              <ul className="mt-3 space-y-1 text-[11px] text-stone-600 dark:text-stone-400">
                <li className="flex items-center gap-1.5">
                  <span className="text-emerald-600 font-bold">✓</span> Auto-generated PAX pass codes
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="text-emerald-600 font-bold">✓</span> Multiple tiers (VIP / Regular)
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="text-emerald-600 font-bold">✓</span> Gate camera QR scanner
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="text-emerald-600 font-bold">✓</span> Instant MoMo & SMS passes
                </li>
              </ul>
            </div>

            <div className="mt-4 pt-3 border-t border-stone-200/80 dark:border-stone-800 text-xs font-bold text-emerald-800 dark:text-emerald-400 flex items-center justify-between">
              <span>Continue with Tickets</span>
              <span>→</span>
            </div>
          </Link>

          {/* Card 2: Voting Awards */}
          <Link
            href={`/organizer/${organizationId}/events/new?type=voting`}
            onClick={() => setIsOpen(false)}
            className="group flex flex-col justify-between rounded-xl border border-stone-200 bg-stone-50/70 p-4 transition-all hover:border-emerald-600 hover:bg-emerald-50/40 dark:border-stone-800 dark:bg-stone-950/60 dark:hover:border-emerald-700 dark:hover:bg-emerald-950/20"
          >
            <div>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-stone-800 text-white shadow-xs mb-3">
                <VoteIcon size={22} />
              </div>
              <h3 className="text-sm font-bold text-stone-900 dark:text-white group-hover:text-emerald-800 dark:group-hover:text-emerald-400">
                Voting Contest & Awards
              </h3>
              <p className="mt-1 text-[11px] text-stone-500 dark:text-stone-400 leading-relaxed">
                Pageants, school elections, music awards & competitive polls.
              </p>
              <ul className="mt-3 space-y-1 text-[11px] text-stone-600 dark:text-stone-400">
                <li className="flex items-center gap-1.5">
                  <span className="text-emerald-600 font-bold">✓</span> Award categories & nominees
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="text-emerald-600 font-bold">✓</span> Free or paid votes (MoMo)
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="text-emerald-600 font-bold">✓</span> Anti-fraud voting limits
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="text-emerald-600 font-bold">✓</span> USSD (*920#) & bot channels
                </li>
              </ul>
            </div>

            <div className="mt-4 pt-3 border-t border-stone-200/80 dark:border-stone-800 text-xs font-bold text-stone-700 dark:text-stone-300 group-hover:text-emerald-800 dark:group-hover:text-emerald-400 flex items-center justify-between">
              <span>Continue with Voting</span>
              <span>→</span>
            </div>
          </Link>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <>
      {trigger ? (
        <div onClick={() => setIsOpen(true)} className="contents cursor-pointer">
          {trigger}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className={
            className ??
            "inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-xs font-semibold text-white shadow-xs transition-all hover:bg-emerald-800 active:scale-95 cursor-pointer"
          }
        >
          <span>Create event</span>
          <span className="text-base leading-none">＋</span>
        </button>
      )}

      {mounted && typeof document !== "undefined" && createPortal(modalContent, document.body)}
    </>
  );
}
