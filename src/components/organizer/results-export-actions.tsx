"use client";

import { useState } from "react";
import { categoryStandings, type NomineeAnalytics } from "@/lib/analytics";
import type { TicketTier } from "@/lib/tickets/types";
import type { AttendeeRecord } from "@/lib/tickets/actions";
import { Icon } from "@/components/icon";
import { OfficialAuditModal } from "@/components/organizer/official-audit-modal";
import {
  generateAuditHash,
  generateAnalyzedVotingCsv,
  generateAnalyzedTicketingCsv,
} from "@/lib/exports/audit-reports";

export function ResultsExportActions({
  nominees,
  scopeLabel,
  event,
  organizationId = "",
  ticketTiers = [],
  attendees = [],
  nomineePhotos = {},
}: {
  nominees: NomineeAnalytics[];
  scopeLabel: string;
  event?: {
    id: string;
    name: string;
    slug: string;
    voting_mode?: string;
    status: string;
    starts_at?: string;
    ends_at?: string;
    event_type?: string;
  };
  organizationId?: string;
  ticketTiers?: TicketTier[];
  attendees?: AttendeeRecord[];
  nomineePhotos?: Record<string, string>;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState<"voting" | "ticketing">("voting");

  const ranked = categoryStandings(nominees);
  const eventId = event?.id || "vch-event";
  const eventName = event?.name || scopeLabel.split("·")[0]?.trim() || "Event Standings";
  const hasTickets =
    event?.event_type === "ticketing" ||
    event?.event_type === "hybrid" ||
    ticketTiers.length > 0 ||
    attendees.length > 0;
  const hasVoting = event?.event_type !== "ticketing" && nominees.length > 0;

  function handleDownloadVotingCsv() {
    const auditHash = generateAuditHash(eventId);
    const csv = generateAnalyzedVotingCsv({
      eventName,
      votingMode: event?.voting_mode,
      scopeLabel,
      nominees,
      auditHash,
    });

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `votecasthub_${slugify(eventName)}_standings_${auditHash}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function handleDownloadTicketsCsv() {
    const auditHash = generateAuditHash(eventId);
    const csv = generateAnalyzedTicketingCsv({
      eventName,
      attendees,
      ticketTiers,
      auditHash,
    });

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `votecasthub_${slugify(eventName)}_attendees_${auditHash}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function slugify(text: string) {
    return text.toLowerCase().replace(/[^a-z0-9_-]/g, "_");
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2.5" aria-label="Export results">
        {/* Primary Action: Official Certified Report (PDF / Print) */}
        <button
          type="button"
          onClick={() => {
            setModalType("voting");
            setModalOpen(true);
          }}
          className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-900 hover:bg-emerald-800 text-white px-4 py-2 text-xs font-bold shadow-xs transition-all cursor-pointer active:scale-95 dark:bg-emerald-800 dark:hover:bg-emerald-700"
        >
          <span>📜 Official Certified PDF / Print Report</span>
        </button>

        {/* Voting CSV */}
        {hasVoting && (
          <button
            type="button"
            disabled={!ranked.length}
            onClick={handleDownloadVotingCsv}
            className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3.5 py-2 text-xs font-semibold text-stone-800 shadow-2xs hover:bg-stone-50 hover:border-emerald-600 disabled:opacity-50 transition-all cursor-pointer dark:border-stone-800 dark:bg-[#0c120e] dark:text-stone-200 dark:hover:bg-stone-900"
          >
            <Icon name="download" size={13} />
            <span>Analyzed Standings CSV</span>
          </button>
        )}

        {/* Ticketing Gate Report & CSV if available */}
        {hasTickets && (
          <>
            <button
              type="button"
              onClick={() => {
                setModalType("ticketing");
                setModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3.5 py-2 text-xs font-semibold text-stone-800 shadow-2xs hover:bg-stone-50 hover:border-emerald-600 transition-all cursor-pointer dark:border-stone-800 dark:bg-[#0c120e] dark:text-stone-200 dark:hover:bg-stone-900"
            >
              <span>🎟️ Gate &amp; Capacity Report</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadTicketsCsv}
              className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3.5 py-2 text-xs font-semibold text-stone-800 shadow-2xs hover:bg-stone-50 hover:border-emerald-600 transition-all cursor-pointer dark:border-stone-800 dark:bg-[#0c120e] dark:text-stone-200 dark:hover:bg-stone-900"
            >
              <Icon name="download" size={13} />
              <span>Attendee Manifest CSV</span>
            </button>
          </>
        )}
      </div>

      {/* Official Audit Modal */}
      {modalOpen && (
        <OfficialAuditModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          event={
            event || {
              id: eventId,
              name: eventName,
              slug: slugify(eventName),
              status: "published",
            }
          }
          organizationId={organizationId}
          nominees={nominees}
          ticketTiers={ticketTiers}
          attendees={attendees}
          nomineePhotos={nomineePhotos}
          defaultDocType={modalType}
        />
      )}
    </div>
  );
}
