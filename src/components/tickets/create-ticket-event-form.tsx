"use client";

import { useActionState, useState } from "react";
import { createTicketEventAction, type ActionState } from "@/lib/tickets/actions";
import { Icon } from "@/components/icon";

type Props = {
  organizationId: string;
};

export function CreateTicketEventForm({ organizationId }: Props) {
  const [state, formAction, isPending] = useActionState<ActionState, FormData>(
    createTicketEventAction,
    {}
  );

  const [showTier2, setShowTier2] = useState(false);

  // Default default dates: tomorrow 6pm to midnight
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  tomorrow.setHours(18, 0, 0, 0);
  const tomorrowEnd = new Date(tomorrow.getTime() + 6 * 60 * 60 * 1000);

  const formatLocal = (d: Date) => {
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  return (
    <form action={formAction} className="space-y-8">
      <input type="hidden" name="organizationId" value={organizationId} />

      {state?.error && (
        <div className="rounded-2xl border border-red-200 bg-red-50/80 p-4 text-xs font-semibold text-red-900 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-300">
          ⚠️ {state.error}
        </div>
      )}

      {/* 1. Event Essentials */}
      <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-xs dark:border-stone-800 dark:bg-stone-900 space-y-4">
        <div className="flex items-center gap-2 border-b border-stone-100 pb-3 dark:border-stone-800">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-bold text-xs">
            1
          </span>
          <h2 className="text-base font-serif font-bold text-stone-900 dark:text-white">
            Event Information
          </h2>
        </div>

        <div>
          <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
            Event Name / Title <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            name="name"
            required
            placeholder="e.g. Accra Tech Summit 2026, Detty December Party, Live Concert"
            className="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-2.5 text-sm font-medium text-stone-900 focus:border-emerald-600 focus:bg-white focus:outline-none dark:border-stone-700 dark:bg-stone-800/80 dark:text-white dark:focus:border-emerald-500"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
            Short Description
          </label>
          <textarea
            name="description"
            rows={3}
            placeholder="Introduce the event to your attendees (dress code, performers, what to expect)..."
            className="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-2.5 text-sm font-medium text-stone-900 focus:border-emerald-600 focus:bg-white focus:outline-none dark:border-stone-700 dark:bg-stone-800/80 dark:text-white dark:focus:border-emerald-500"
          />
        </div>
      </div>

      {/* 2. Venue & Schedule */}
      <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-xs dark:border-stone-800 dark:bg-stone-900 space-y-4">
        <div className="flex items-center gap-2 border-b border-stone-100 pb-3 dark:border-stone-800">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-bold text-xs">
            2
          </span>
          <h2 className="text-base font-serif font-bold text-stone-900 dark:text-white">
            Venue & Schedule
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
              Venue Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="venueName"
              required
              placeholder="e.g. Grand Arena, AICC / Fantasy Dome"
              className="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-2.5 text-sm font-medium text-stone-900 focus:border-emerald-600 focus:bg-white focus:outline-none dark:border-stone-700 dark:bg-stone-800/80 dark:text-white dark:focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
              Physical Address / Area
            </label>
            <input
              type="text"
              name="venueAddress"
              placeholder="e.g. Castle Road, Ridge, Accra"
              className="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-2.5 text-sm font-medium text-stone-900 focus:border-emerald-600 focus:bg-white focus:outline-none dark:border-stone-700 dark:bg-stone-800/80 dark:text-white dark:focus:border-emerald-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
          <div>
            <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
              Doors Open Time
            </label>
            <input
              type="text"
              name="doorsOpenTime"
              placeholder="e.g. 5:00 PM Gate Open"
              className="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-2.5 text-sm font-medium text-stone-900 focus:border-emerald-600 focus:bg-white focus:outline-none dark:border-stone-700 dark:bg-stone-800/80 dark:text-white dark:focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
              Event Starts At <span className="text-red-500">*</span>
            </label>
            <input
              type="datetime-local"
              name="startsAt"
              required
              defaultValue={formatLocal(tomorrow)}
              className="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-2 text-sm font-medium text-stone-900 focus:border-emerald-600 focus:bg-white focus:outline-none dark:border-stone-700 dark:bg-stone-800/80 dark:text-white dark:focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
              Event Ends At <span className="text-red-500">*</span>
            </label>
            <input
              type="datetime-local"
              name="endsAt"
              required
              defaultValue={formatLocal(tomorrowEnd)}
              className="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-2 text-sm font-medium text-stone-900 focus:border-emerald-600 focus:bg-white focus:outline-none dark:border-stone-700 dark:bg-stone-800/80 dark:text-white dark:focus:border-emerald-500"
            />
          </div>
        </div>
      </div>

      {/* 3. Ticket Tiers */}
      <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-xs dark:border-stone-800 dark:bg-stone-900 space-y-4">
        <div className="flex items-center justify-between border-b border-stone-100 pb-3 dark:border-stone-800">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-bold text-xs">
              3
            </span>
            <h2 className="text-base font-serif font-bold text-stone-900 dark:text-white">
              Initial Ticket Tier
            </h2>
          </div>
          <span className="text-[11px] font-semibold text-stone-500 dark:text-stone-400">
            You can add more tiers anytime later in Studio
          </span>
        </div>

        {/* Tier 1 */}
        <div className="rounded-xl border border-stone-200 bg-stone-50/60 p-4 dark:border-stone-800 dark:bg-stone-950/60">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-stone-700 dark:text-stone-300 mb-1">
                Tier Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="tierName"
                required
                defaultValue="Regular"
                placeholder="e.g. Regular / Early Bird / Free Pass"
                className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs font-semibold text-stone-900 focus:border-emerald-600 focus:outline-none dark:border-stone-700 dark:bg-stone-800 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-stone-700 dark:text-stone-300 mb-1">
                Price (GH₵) <span className="text-stone-400 font-normal">(0 for Free)</span>
              </label>
              <input
                type="number"
                name="tierPriceGhs"
                step="0.5"
                min="0"
                defaultValue="50"
                required
                className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs font-semibold text-stone-900 focus:border-emerald-600 focus:outline-none dark:border-stone-700 dark:bg-stone-800 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-stone-700 dark:text-stone-300 mb-1">
                Total Capacity <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                name="tierCapacity"
                min="1"
                defaultValue="200"
                required
                className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs font-semibold text-stone-900 focus:border-emerald-600 focus:outline-none dark:border-stone-700 dark:bg-stone-800 dark:text-white"
              />
            </div>
          </div>
        </div>

        {/* Optional Tier 2 */}
        {showTier2 ? (
          <div className="rounded-xl border border-emerald-300 bg-emerald-50/40 p-4 dark:border-emerald-800/60 dark:bg-emerald-950/30">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-emerald-900 dark:text-emerald-300">
                Tier 2 (e.g. VIP / Table)
              </span>
              <button
                type="button"
                onClick={() => setShowTier2(false)}
                className="text-[11px] font-semibold text-red-600 hover:text-red-800 dark:text-red-400 cursor-pointer"
              >
                ✕ Remove
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-stone-700 dark:text-stone-300 mb-1">
                  Tier Name
                </label>
                <input
                  type="text"
                  name="tier2Name"
                  placeholder="e.g. VIP / Front Row"
                  defaultValue="VIP"
                  className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs font-semibold text-stone-900 focus:border-emerald-600 focus:outline-none dark:border-stone-700 dark:bg-stone-800 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-stone-700 dark:text-stone-300 mb-1">
                  Price (GH₵)
                </label>
                <input
                  type="number"
                  name="tier2PriceGhs"
                  step="0.5"
                  min="0"
                  defaultValue="150"
                  className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs font-semibold text-stone-900 focus:border-emerald-600 focus:outline-none dark:border-stone-700 dark:bg-stone-800 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-stone-700 dark:text-stone-300 mb-1">
                  Total Capacity
                </label>
                <input
                  type="number"
                  name="tier2Capacity"
                  min="1"
                  defaultValue="50"
                  className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs font-semibold text-stone-900 focus:border-emerald-600 focus:outline-none dark:border-stone-700 dark:bg-stone-800 dark:text-white"
                />
              </div>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowTier2(true)}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-800 hover:text-emerald-950 dark:text-emerald-400 dark:hover:text-emerald-300 cursor-pointer"
          >
            <span>＋ Add VIP / Secondary Tier</span>
          </button>
        )}
      </div>

      {/* Submit Button */}
      <div className="flex items-center justify-end gap-3 pt-4">
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-6 py-3.5 text-sm font-bold text-white shadow-md hover:bg-emerald-800 active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
        >
          {isPending ? (
            <>
              <span className="size-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              <span>Creating Ticket Event...</span>
            </>
          ) : (
            <>
              <span>Create Ticketed Event</span>
              <span>→</span>
            </>
          )}
        </button>
      </div>
    </form>
  );
}
