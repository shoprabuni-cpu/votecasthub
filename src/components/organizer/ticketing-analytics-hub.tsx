"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import type { TicketTier } from "@/lib/tickets/types";
import type { AttendeeRecord } from "@/lib/tickets/actions";
import { Icon } from "@/components/icon";
import { TicketIcon } from "@/components/brand-icons";
import { csvValue } from "@/lib/analytics";
import { OfficialAuditModal } from "@/components/organizer/official-audit-modal";
import { generateAuditHash, generateAnalyzedTicketingCsv } from "@/lib/exports/audit-reports";

type Props = {
  eventId: string;
  eventName: string;
  organizationId: string;
  tiers: TicketTier[];
  attendees: AttendeeRecord[];
  ended: boolean;
};

export function TicketingAnalyticsHub({
  eventId,
  eventName,
  organizationId,
  tiers = [],
  attendees = [],
  ended,
}: Props) {
  const [searchQuery, setSearchQuery] = useState("");
  const [tierFilter, setTierFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "checked_in" | "valid">("all");
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);

  const money = (amount: number) => `GH₵ ${(Number(amount) / 100).toFixed(2)}`;

  // Total Metrics
  const totalCapacity = useMemo(
    () => tiers.reduce((acc, t) => acc + (Number(t.capacity) || 0), 0),
    [tiers]
  );

  const totalTicketsSold = useMemo(
    () => attendees.reduce((acc, a) => acc + (Number(a.quantity) || 1), 0),
    [attendees]
  );

  const totalCheckedIn = useMemo(
    () =>
      attendees
        .filter((a) => a.status === "checked_in" || !!a.checked_in_at)
        .reduce((acc, a) => acc + (Number(a.quantity) || 1), 0),
    [attendees]
  );

  const remainingAllowance = Math.max(0, totalCapacity - totalTicketsSold);
  const capacityPercent = totalCapacity > 0 ? Math.min(100, (totalTicketsSold / totalCapacity) * 100) : 0;
  const checkInRate = totalTicketsSold > 0 ? ((totalCheckedIn / totalTicketsSold) * 100).toFixed(1) : "0.0";

  const totalRevenueMinor = useMemo(
    () => attendees.reduce((acc, a) => acc + (Number(a.price_minor) || 0), 0),
    [attendees]
  );
  // Net payout after 10% platform ticketing fee
  const netRevenueMinor = Math.round(totalRevenueMinor * 0.9);
  const platformFeeMinor = totalRevenueMinor - netRevenueMinor;

  // Filtered Attendees
  const filteredAttendees = useMemo(() => {
    return attendees.filter((record) => {
      // Tier match
      if (tierFilter !== "all" && record.tier_name !== tierFilter) return false;

      // Status match
      if (statusFilter === "checked_in") {
        if (record.status !== "checked_in" && !record.checked_in_at) return false;
      } else if (statusFilter === "valid") {
        if (record.status === "checked_in" || !!record.checked_in_at) return false;
      }

      // Search match
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      return (
        record.customer_name?.toLowerCase().includes(q) ||
        record.customer_phone?.toLowerCase().includes(q) ||
        record.pax_code?.toLowerCase().includes(q) ||
        record.order_reference?.toLowerCase().includes(q) ||
        record.tier_name?.toLowerCase().includes(q)
      );
    });
  }, [attendees, tierFilter, statusFilter, searchQuery]);

  // CSV Export Handler
  function handleExportCsv() {
    if (attendees.length === 0) return;

    const auditHash = generateAuditHash(eventId);
    const csvContent = "\uFEFF" + generateAnalyzedTicketingCsv({
      eventName,
      attendees,
      ticketTiers: tiers,
      auditHash,
    });

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${eventName.replace(/[^a-zA-Z0-9_-]/g, "_")}_attendees_manifest_${auditHash}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const dateFormatter = new Intl.DateTimeFormat("en-GH", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Africa/Accra",
  });

  return (
    <div className="space-y-6">
      {/* =========================================================================
          1. TICKETING & CAPACITY ALLOWANCE MASTER BANNER
          ========================================================================= */}
      <div className="rounded-3xl border border-amber-200/90 bg-gradient-to-br from-amber-50/70 via-white to-amber-50/30 p-6 sm:p-8 shadow-xs dark:border-amber-900/50 dark:from-amber-950/40 dark:via-[#0c120e] dark:to-amber-950/20">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-amber-100 pb-5 dark:border-amber-900/40">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300">
                <TicketIcon size={14} />
              </span>
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-400">
                Ticket Sales &amp; Gate Admissions
              </span>
            </div>
            <h3 className="mt-1 text-2xl font-serif font-bold text-stone-900 dark:text-white">
              Inventory Allowance &amp; Gate Reporting
            </h3>
            <p className="text-xs text-stone-600 mt-0.5 dark:text-stone-300">
              Track real-time pass sales, tier quota consumption, and usher check-ins.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/gate"
              className="inline-flex items-center gap-1.5 rounded-xl bg-amber-900 px-4 py-2.5 text-xs font-bold text-white hover:bg-amber-800 transition-all shadow-xs active:scale-95 dark:bg-amber-700 dark:hover:bg-amber-600"
            >
              <span>📱 Open Gate Scanner</span>
            </Link>

            <button
              type="button"
              onClick={() => setIsReportModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-900 hover:bg-emerald-800 text-white px-3.5 py-2.5 text-xs font-bold transition-all shadow-xs active:scale-95 cursor-pointer dark:bg-emerald-800 dark:hover:bg-emerald-700"
            >
              <span>📜 Gate Report (PDF/Print)</span>
            </button>

            <button
              type="button"
              onClick={handleExportCsv}
              disabled={attendees.length === 0}
              className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-stone-800 hover:bg-stone-50 transition-all shadow-2xs active:scale-95 disabled:opacity-50 cursor-pointer dark:border-[#1c2721] dark:bg-[#141d18] dark:text-stone-200 dark:hover:bg-[#1c2721]"
            >
              <Icon name="download" size={13} />
              <span>Attendee Manifest CSV</span>
            </button>
          </div>
        </div>

        {/* 4 Summary Stat Cards */}
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 1. Passes Issued / Sold */}
          <div className="rounded-2xl border border-amber-200 bg-white p-5 shadow-2xs dark:border-amber-900/60 dark:bg-[#0c120e]">
            <span className="text-xs text-amber-950 font-bold block dark:text-amber-300">
              Total Passes Issued
            </span>
            <p className="mt-2 text-3xl font-bold font-mono text-stone-900 dark:text-white">
              {totalTicketsSold.toLocaleString()}
            </p>
            <span className="text-[11px] text-stone-500 mt-1 block dark:text-stone-400">
              {capacityPercent.toFixed(1)}% of total capacity booked
            </span>
          </div>

          {/* 2. Capacity Allowance Remaining */}
          <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-2xs dark:border-[#1c2721] dark:bg-[#0c120e]">
            <span className="text-xs text-stone-500 font-bold block dark:text-stone-400">
              Inventory Allowance Left
            </span>
            <p className="mt-2 text-3xl font-bold font-mono text-emerald-800 dark:text-emerald-400">
              {remainingAllowance.toLocaleString()}
            </p>
            <span className="text-[11px] text-stone-400 mt-1 block dark:text-stone-500">
              Out of {totalCapacity.toLocaleString()} max event seats
            </span>
          </div>

          {/* 3. Gate Admissions / Check-in Rate */}
          <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-2xs dark:border-[#1c2721] dark:bg-[#0c120e]">
            <div className="flex items-center justify-between">
              <span className="text-xs text-stone-500 font-bold dark:text-stone-400">Gate Admissions</span>
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            </div>
            <p className="mt-2 text-3xl font-bold font-mono text-stone-900 dark:text-white">
              {totalCheckedIn.toLocaleString()}
            </p>
            <span className="text-[11px] text-stone-400 mt-1 block dark:text-stone-500">
              {checkInRate}% attendance rate at gate
            </span>
          </div>

          {/* 4. Net Payout Revenue */}
          <div className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-2xs dark:border-emerald-900/60 dark:bg-[#0c120e]">
            <span className="text-xs text-emerald-950 font-bold block dark:text-emerald-300">
              Organizer Net Payout
            </span>
            <p className="mt-2 text-3xl font-bold font-mono text-emerald-900 dark:text-emerald-400">
              {money(netRevenueMinor)}
            </p>
            <span className="text-[11px] text-stone-500 mt-1 block dark:text-stone-400">
              Gross: {money(totalRevenueMinor)} (10% platform fee)
            </span>
          </div>
        </div>
      </div>

      {/* =========================================================================
          2. TICKET TIER INVENTORY & ALLOWANCE BREAKDOWN
          ========================================================================= */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-bold text-stone-900 dark:text-white">
              Tier Capacity &amp; Allowance Breakdown
            </h4>
            <p className="text-[11px] text-stone-500 dark:text-stone-400">
              Real-time quota monitoring across all ticket tiers
            </p>
          </div>
          <Link
            href={`/organizer/${organizationId}/events/${eventId}?step=tickets`}
            className="text-xs font-semibold text-emerald-700 hover:underline dark:text-emerald-400"
          >
            Manage Tiers →
          </Link>
        </div>

        {tiers.length > 0 ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {tiers.map((tier) => {
              const tierSold = Number(tier.sold_count) || 0;
              const tierCap = Number(tier.capacity) || 1;
              const tierLeft = Math.max(0, tierCap - tierSold);
              const soldPercent = Math.min(100, (tierSold / tierCap) * 100);
              const tierGrossMinor = tierSold * Number(tier.price_minor || 0);

              const isSoldOut = tierLeft === 0;
              const isClose = !isSoldOut && soldPercent >= 80;

              return (
                <div
                  key={tier.id}
                  className="rounded-2xl border border-stone-200/90 bg-white p-4 shadow-2xs dark:border-[#1c2721] dark:bg-[#0c120e]"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="font-bold text-stone-900 dark:text-white text-sm">
                        {tier.name}
                      </span>
                      <p className="font-mono text-xs font-semibold text-emerald-700 dark:text-emerald-400 mt-0.5">
                        {tier.price_minor ? money(tier.price_minor) : "Free Pass"}
                      </p>
                    </div>

                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        isSoldOut
                          ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
                          : isClose
                          ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                          : "bg-emerald-50 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-300"
                      }`}
                    >
                      {isSoldOut ? "Sold Out" : `${tierLeft} left`}
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="mt-3.5 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] text-stone-500 dark:text-stone-400">
                      <span>Allowance Sold:</span>
                      <strong className="font-mono text-stone-800 dark:text-white">
                        {tierSold} / {tierCap} ({soldPercent.toFixed(0)}%)
                      </strong>
                    </div>
                    <div className="h-2 w-full rounded-full bg-stone-100 dark:bg-[#141d18] overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          isSoldOut
                            ? "bg-red-500"
                            : isClose
                            ? "bg-amber-500"
                            : "bg-emerald-600"
                        }`}
                        style={{ width: `${soldPercent}%` }}
                      />
                    </div>
                  </div>

                  {/* Tier Revenue */}
                  <div className="mt-3 flex items-center justify-between border-t border-stone-100 pt-2.5 text-[11px] text-stone-500 dark:border-[#1c2721] dark:text-stone-400">
                    <span>Tier Revenue:</span>
                    <strong className="font-mono font-bold text-stone-900 dark:text-white">
                      {money(tierGrossMinor)}
                    </strong>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-stone-200 bg-stone-50/50 p-6 text-center dark:border-[#1c2721] dark:bg-[#0c120e]">
            <p className="text-xs text-stone-500 dark:text-stone-400">
              No ticket tiers created yet for this event.
            </p>
            <Link
              href={`/organizer/${organizationId}/events/${eventId}?step=tickets`}
              className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-emerald-700 hover:underline dark:text-emerald-400"
            >
              <span>+ Add Ticket Tiers</span>
            </Link>
          </div>
        )}
      </div>

      {/* =========================================================================
          3. ATTENDEE GUEST LIST & PASSES ROSTER
          ========================================================================= */}
      <div className="rounded-3xl border border-stone-200/90 bg-white shadow-xs overflow-hidden dark:border-[#1c2721] dark:bg-[#0c120e]">
        {/* Header & Filters */}
        <div className="border-b border-stone-100 p-5 dark:border-[#1c2721]">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h4 className="text-base font-serif font-bold text-stone-900 dark:text-white">
                Attendee Guest List ({attendees.length})
              </h4>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Verified ticket holders and admission passes
              </p>
            </div>

            {/* Search Input */}
            <div className="relative flex-1 max-w-sm">
              <Icon
                name="search"
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, phone or #PAX-code..."
                className="w-full rounded-xl border border-stone-200 bg-stone-50/70 py-1.5 pl-8 pr-7 text-xs font-medium text-stone-900 placeholder:text-stone-400 focus:border-emerald-600 focus:bg-white focus:outline-none dark:border-[#1c2721] dark:bg-[#141d18] dark:text-white dark:placeholder:text-stone-500"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-stone-400 hover:text-stone-600 dark:hover:text-stone-200"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Filter Pills */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {/* Status Segment */}
            <div className="inline-flex items-center gap-1 rounded-lg border border-stone-200/80 bg-stone-100 p-0.5 dark:border-[#1c2721] dark:bg-[#141d18]">
              <button
                type="button"
                onClick={() => setStatusFilter("all")}
                className={`rounded-md px-2.5 py-1 text-xs font-semibold transition cursor-pointer ${
                  statusFilter === "all"
                    ? "bg-white text-stone-900 shadow-2xs dark:bg-[#0c120e] dark:text-white"
                    : "text-stone-600 hover:text-stone-900 dark:text-stone-400 dark:hover:text-white"
                }`}
              >
                All Passes ({attendees.length})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("checked_in")}
                className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold transition cursor-pointer ${
                  statusFilter === "checked_in"
                    ? "bg-emerald-600 text-white shadow-2xs"
                    : "text-stone-600 hover:text-stone-900 dark:text-stone-400 dark:hover:text-white"
                }`}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                <span>Admitted ({totalCheckedIn})</span>
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("valid")}
                className={`rounded-md px-2.5 py-1 text-xs font-semibold transition cursor-pointer ${
                  statusFilter === "valid"
                    ? "bg-amber-600 text-white shadow-2xs"
                    : "text-stone-600 hover:text-stone-900 dark:text-stone-400 dark:hover:text-white"
                }`}
              >
                Pending Entry ({Math.max(0, totalTicketsSold - totalCheckedIn)})
              </button>
            </div>

            {/* Tier Select if multiple */}
            {tiers.length > 1 && (
              <select
                value={tierFilter}
                onChange={(e) => setTierFilter(e.target.value)}
                className="rounded-lg border border-stone-200 bg-stone-50 px-2.5 py-1 text-xs font-semibold text-stone-800 dark:border-[#1c2721] dark:bg-[#141d18] dark:text-stone-200"
              >
                <option value="all">All Tiers</option>
                {tiers.map((t) => (
                  <option key={t.id} value={t.name}>
                    {t.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Attendee Roster Table */}
        {filteredAttendees.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-stone-200/80 bg-stone-50/80 text-[11px] font-bold uppercase tracking-wider text-stone-500 dark:border-[#1c2721] dark:bg-[#141d18] dark:text-stone-400">
                <tr>
                  <th className="px-5 py-3">Pass / PAX Code</th>
                  <th className="px-5 py-3">Attendee Name</th>
                  <th className="px-5 py-3">Phone</th>
                  <th className="px-5 py-3">Tier</th>
                  <th className="px-5 py-3 text-center">Qty</th>
                  <th className="px-5 py-3">Channel</th>
                  <th className="px-5 py-3">Gate Status</th>
                  <th className="px-5 py-3 text-right">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 dark:divide-[#1c2721]">
                {filteredAttendees.map((attendee) => {
                  const isAdmitted =
                    attendee.status === "checked_in" || !!attendee.checked_in_at;
                  const purchaseDate = new Date(attendee.created_at);

                  return (
                    <tr
                      key={attendee.id}
                      className="hover:bg-stone-50/60 dark:hover:bg-[#141d18]/50 transition-colors"
                    >
                      {/* PAX Code */}
                      <td className="px-5 py-3">
                        <span className="font-mono text-xs font-bold text-amber-800 dark:text-amber-400">
                          {attendee.pax_code}
                        </span>
                      </td>

                      {/* Attendee Name */}
                      <td className="px-5 py-3 font-semibold text-stone-900 dark:text-white">
                        {attendee.customer_name || "Guest"}
                      </td>

                      {/* Customer Phone */}
                      <td className="px-5 py-3 font-mono text-stone-600 dark:text-stone-300">
                        {attendee.customer_phone || "—"}
                      </td>

                      {/* Tier Name */}
                      <td className="px-5 py-3">
                        <span className="inline-flex rounded-md border border-stone-200 bg-stone-50 px-2 py-0.5 text-[10px] font-bold uppercase text-stone-800 dark:border-[#1c2721] dark:bg-[#141d18] dark:text-stone-300">
                          {attendee.tier_name}
                        </span>
                      </td>

                      {/* Quantity */}
                      <td className="px-5 py-3 font-mono font-bold text-stone-900 dark:text-white text-center">
                        x{attendee.quantity}
                      </td>

                      {/* Channel */}
                      <td className="px-5 py-3 text-stone-600 dark:text-stone-300 capitalize">
                        {attendee.channel === "whatsapp" ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-semibold">
                            <span>WhatsApp</span>
                          </span>
                        ) : attendee.channel === "telegram" ? (
                          <span className="inline-flex items-center gap-1 text-sky-700 dark:text-sky-400 font-semibold">
                            <span>Telegram</span>
                          </span>
                        ) : (
                          <span>Online Web</span>
                        )}
                      </td>

                      {/* Gate Status */}
                      <td className="px-5 py-3">
                        {isAdmitted ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-[10px] font-bold text-emerald-900 dark:bg-emerald-950/60 dark:border-emerald-800 dark:text-emerald-300">
                            <span>✓ Admitted</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-[10px] font-bold text-amber-900 dark:bg-amber-950/60 dark:border-amber-800 dark:text-amber-300">
                            <span>⏳ Pending Entry</span>
                          </span>
                        )}
                      </td>

                      {/* Date */}
                      <td className="px-5 py-3 text-right font-mono text-[11px] text-stone-400 dark:text-stone-500">
                        {dateFormatter.format(purchaseDate)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center text-xs text-stone-400 dark:text-stone-500 italic">
            {searchQuery
              ? `No attendees match "${searchQuery}".`
              : "No tickets issued yet for this event."}
          </div>
        )}
      </div>

      {isReportModalOpen && (
        <OfficialAuditModal
          isOpen={isReportModalOpen}
          onClose={() => setIsReportModalOpen(false)}
          event={{
            id: eventId,
            name: eventName,
            slug: eventName.toLowerCase().replace(/[^a-z0-9_-]/g, "_"),
            status: ended ? "closed" : "published",
            event_type: "ticketing",
          }}
          organizationId={organizationId}
          ticketTiers={tiers}
          attendees={attendees}
          defaultDocType="ticketing"
        />
      )}
    </div>
  );
}
