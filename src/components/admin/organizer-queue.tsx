"use client";

import Link from "next/link";
import { useState, useMemo } from "react";
import { Icon } from "@/components/icon";

type Organizer = {
  id: string;
  name: string;
  moderation_status: string;
  event_count: number;
  paystack_status: string;
  paystack_verified: boolean;
};

export function OrganizerQueue({ organizers }: { organizers: Organizer[] }) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    return organizers.filter((o) => {
      return (
        search.trim() === "" ||
        o.name.toLowerCase().includes(search.toLowerCase()) ||
        o.id.toLowerCase().includes(search.toLowerCase())
      );
    });
  }, [organizers, search]);

  const moderationStyles: Record<string, string> = {
    active: "bg-emerald-50 text-emerald-900 border-emerald-200",
    restricted: "bg-amber-50 text-amber-900 border-amber-200",
    closed: "bg-stone-100 text-stone-700 border-stone-300",
    suspended: "bg-red-50 text-red-900 border-red-200",
  };

  if (!organizers.length) {
    return (
      <div className="rounded-2xl border border-stone-200/90 bg-white p-12 text-center shadow-xs space-y-3">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-stone-100 text-stone-400">
          <Icon name="building" size={20} />
        </div>
        <h2 className="text-base font-serif font-bold text-stone-900">No organizer records found</h2>
        <p className="text-xs text-stone-500 max-w-sm mx-auto">
          No organizations are registered or you need to ensure your account has active platform admin privileges.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search Input */}
      <div className="relative max-w-sm">
        <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-stone-400">
          <Icon name="search" size={14} />
        </span>
        <input
          type="text"
          placeholder="Search by organizer name or ID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-xl border border-stone-300 bg-white pl-9 pr-3.5 py-2 text-xs text-stone-900 placeholder:text-stone-400 focus:border-emerald-600 focus:outline-none focus:ring-3 focus:ring-emerald-600/15"
        />
      </div>

      {/* Organizers Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((o) => (
          <article
            key={o.id}
            className="rounded-2xl border border-stone-200/90 bg-white p-5 shadow-xs flex flex-col justify-between space-y-4 hover:border-stone-300 transition-colors"
          >
            <div>
              <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                <span
                  className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                    moderationStyles[o.moderation_status] ?? "bg-stone-100 text-stone-700"
                  }`}
                >
                  {o.moderation_status}
                </span>

                <span className="text-[11px] font-medium text-stone-500">
                  {o.event_count} {o.event_count === 1 ? "event" : "events"}
                </span>
              </div>

              <h3 className="mt-3 text-base font-serif font-bold text-stone-900 leading-snug">
                {o.name}
              </h3>

              <div className="mt-2 text-xs text-stone-500 space-y-1">
                <div className="flex items-center gap-1.5 text-[11px]">
                  <span>Paystack:</span>
                  <span className="font-semibold text-stone-700">{o.paystack_status}</span>
                  {o.paystack_verified && (
                    <span className="text-emerald-700 font-bold">✓ Verified</span>
                  )}
                </div>
                <div className="font-mono text-[10px] text-stone-400 truncate">
                  ID: {o.id}
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-stone-100">
              <Link
                href={`/admin/organizers/${o.id}`}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-stone-200 bg-white py-2 text-xs font-semibold text-stone-800 shadow-2xs hover:bg-stone-50 hover:border-stone-300 transition-all cursor-pointer"
              >
                <span>Inspect Account</span>
                <Icon name="arrowRight" size={13} />
              </Link>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
