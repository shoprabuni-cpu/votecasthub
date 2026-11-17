"use client";

import { useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/icon";

type Props = {
  organizationId: string;
  trigger?: React.ReactNode;
  className?: string;
};

export function CreateEventModal({ organizationId, trigger, className }: Props) {
  const [isOpen, setIsOpen] = useState(false);

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

      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-event-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
        >
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
            onClick={() => setIsOpen(false)}
          />

          {/* Modal Content */}
          <div className="relative w-full max-w-xl overflow-hidden rounded-3xl border border-stone-200 bg-white p-6 sm:p-8 shadow-2xl dark:border-stone-800 dark:bg-stone-950 animate-in zoom-in-95 duration-200">
            {/* Close Button */}
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="absolute right-5 top-5 rounded-full p-2 text-stone-400 hover:bg-stone-100 hover:text-stone-700 dark:hover:bg-stone-900 dark:hover:text-stone-200 transition-colors cursor-pointer"
              aria-label="Close modal"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="mb-6">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100/80 dark:bg-emerald-950/80 px-3 py-1 text-[11px] font-bold text-emerald-900 dark:text-emerald-300 uppercase tracking-wider">
                <Icon name="sparkle" size={12} />
                New Event Studio
              </span>
              <h2 id="create-event-title" className="mt-2 text-2xl sm:text-3xl font-serif font-bold text-stone-900 dark:text-white tracking-tight">
                What type of event are you hosting?
              </h2>
              <p className="mt-1.5 text-xs sm:text-sm text-stone-500 dark:text-stone-400">
                Choose the setup that fits your event. Each comes with its own tailored forms and dashboard.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Option 1: Ticketing Event */}
              <Link
                href={`/organizer/${organizationId}/events/new?type=ticketing`}
                onClick={() => setIsOpen(false)}
                className="group relative flex flex-col justify-between rounded-2xl border-2 border-emerald-500/30 bg-emerald-50/40 p-5 text-left transition-all hover:border-emerald-600 hover:bg-emerald-50/80 hover:shadow-md dark:border-emerald-800/40 dark:bg-emerald-950/30 dark:hover:border-emerald-500"
              >
                <div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm mb-3 group-hover:scale-105 transition-transform">
                    <span className="text-2xl">🎟️</span>
                  </div>
                  <h3 className="font-bold text-base text-stone-900 dark:text-white group-hover:text-emerald-800 dark:group-hover:text-emerald-400">
                    Ticketed Event
                  </h3>
                  <p className="mt-1 text-xs text-stone-600 dark:text-stone-300 leading-relaxed">
                    For concerts, conferences, summits, comedy shows, festivals & parties.
                  </p>
                  <ul className="mt-3 space-y-1 text-[11px] text-stone-500 dark:text-stone-400">
                    <li className="flex items-center gap-1.5">
                      <span className="text-emerald-600 font-bold">✓</span> Auto-generated PAX Codes
                    </li>
                    <li className="flex items-center gap-1.5">
                      <span className="text-emerald-600 font-bold">✓</span> Multiple Ticket Tiers (VIP/Regular)
                    </li>
                    <li className="flex items-center gap-1.5">
                      <span className="text-emerald-600 font-bold">✓</span> Live Camera Gate QR Scanner
                    </li>
                    <li className="flex items-center gap-1.5">
                      <span className="text-emerald-600 font-bold">✓</span> Instant MoMo & SMS Passes
                    </li>
                  </ul>
                </div>

                <div className="mt-5 inline-flex items-center gap-1.5 text-xs font-bold text-emerald-800 dark:text-emerald-400 group-hover:translate-x-0.5 transition-transform">
                  <span>Create Ticket Event</span>
                  <span>→</span>
                </div>
              </Link>

              {/* Option 2: Voting Awards */}
              <Link
                href={`/organizer/${organizationId}/events/new?type=voting`}
                onClick={() => setIsOpen(false)}
                className="group relative flex flex-col justify-between rounded-2xl border-2 border-stone-200 bg-stone-50/60 p-5 text-left transition-all hover:border-emerald-600/60 hover:bg-stone-50 hover:shadow-md dark:border-stone-800 dark:bg-stone-900/60 dark:hover:border-emerald-700"
              >
                <div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-stone-800 text-white shadow-sm mb-3 group-hover:scale-105 transition-transform">
                    <span className="text-2xl">🗳️</span>
                  </div>
                  <h3 className="font-bold text-base text-stone-900 dark:text-white group-hover:text-emerald-800 dark:group-hover:text-emerald-400">
                    Voting Contest & Awards
                  </h3>
                  <p className="mt-1 text-xs text-stone-600 dark:text-stone-300 leading-relaxed">
                    For pageants, school elections, music awards & competitive polls.
                  </p>
                  <ul className="mt-3 space-y-1 text-[11px] text-stone-500 dark:text-stone-400">
                    <li className="flex items-center gap-1.5">
                      <span className="text-emerald-600 font-bold">✓</span> Award Categories & Nominees
                    </li>
                    <li className="flex items-center gap-1.5">
                      <span className="text-emerald-600 font-bold">✓</span> Free or Paid Votes (MoMo)
                    </li>
                    <li className="flex items-center gap-1.5">
                      <span className="text-emerald-600 font-bold">✓</span> Fraud Prevention & OTP Rules
                    </li>
                    <li className="flex items-center gap-1.5">
                      <span className="text-emerald-600 font-bold">✓</span> USSD & Bot Voting Channels
                    </li>
                  </ul>
                </div>

                <div className="mt-5 inline-flex items-center gap-1.5 text-xs font-bold text-stone-700 dark:text-stone-300 group-hover:text-emerald-800 dark:group-hover:text-emerald-400 group-hover:translate-x-0.5 transition-transform">
                  <span>Create Voting Contest</span>
                  <span>→</span>
                </div>
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
