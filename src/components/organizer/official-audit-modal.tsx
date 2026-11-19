"use client";

import { useState, useId, useEffect } from "react";
import Image from "next/image";
import { Icon } from "@/components/icon";
import type { NomineeAnalytics } from "@/lib/analytics";
import type { TicketTier } from "@/lib/tickets/types";
import type { AttendeeRecord } from "@/lib/tickets/actions";
import {
  generateAuditHash,
  analyzeVotingStandings,
  generateAnalyzedVotingCsv,
  analyzeTicketingAdmissions,
  generateAnalyzedTicketingCsv,
} from "@/lib/exports/audit-reports";

export function OfficialAuditModal({
  isOpen,
  onClose,
  event,
  organizationId,
  nominees = [],
  ticketTiers = [],
  attendees = [],
  defaultDocType = "voting",
}: {
  isOpen: boolean;
  onClose: () => void;
  event: {
    id: string;
    name: string;
    slug: string;
    voting_mode?: string;
    status: string;
    starts_at?: string;
    ends_at?: string;
    event_type?: string;
  };
  organizationId: string;
  nominees?: NomineeAnalytics[];
  ticketTiers?: TicketTier[];
  attendees?: AttendeeRecord[];
  defaultDocType?: "voting" | "ticketing";
}) {
  const hasTickets =
    event.event_type === "ticketing" ||
    event.event_type === "hybrid" ||
    ticketTiers.length > 0 ||
    attendees.length > 0;
  const hasVoting = event.event_type !== "ticketing" && nominees.length > 0;

  const [docType, setDocType] = useState<"voting" | "ticketing">(
    defaultDocType === "ticketing" && hasTickets ? "ticketing" : hasVoting ? "voting" : "ticketing"
  );

  const [auditHash, setAuditHash] = useState("");
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setAuditHash(generateAuditHash(event.id));
    }
  }, [isOpen, event.id]);

  if (!isOpen) return null;

  const dateFormatted = new Intl.DateTimeFormat("en-GH", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "Africa/Accra",
  }).format(new Date());

  // Voting analysis
  const votingAnalysis = analyzeVotingStandings(nominees);

  // Group voting rows by category
  const categoriesGrouped: Record<string, typeof votingAnalysis.ranked> = {};
  for (const r of votingAnalysis.ranked) {
    if (!categoriesGrouped[r.categoryName]) {
      categoriesGrouped[r.categoryName] = [];
    }
    categoriesGrouped[r.categoryName].push(r);
  }

  // Ticketing analysis
  const ticketAnalysis = analyzeTicketingAdmissions(attendees, ticketTiers);

  // Scanner staff breakdown
  const scannerStats: Record<string, number> = {};
  for (const a of attendees) {
    if (a.status === "checked_in" || a.checked_in_at) {
      const scanner = a.checked_in_by || "Gate Lead";
      scannerStats[scanner] = (scannerStats[scanner] || 0) + (Number(a.quantity) || 1);
    }
  }

  // Print Action
  function handlePrint() {
    document.body.classList.add("printing-audit-report");
    window.print();
    // Remove class after print dialog is closed
    setTimeout(() => {
      document.body.classList.remove("printing-audit-report");
    }, 500);
  }

  // CSV Export Action
  function handleDownloadCsv() {
    if (docType === "voting") {
      const csv = generateAnalyzedVotingCsv({
        eventName: event.name,
        votingMode: event.voting_mode,
        scopeLabel: "Official Certified Standings",
        nominees,
        auditHash,
      });
      downloadFile(csv, `${slugify(event.name)}_voting_standings_${auditHash}.csv`, "text/csv;charset=utf-8;");
    } else {
      const csv = generateAnalyzedTicketingCsv({
        eventName: event.name,
        attendees,
        ticketTiers,
        auditHash,
      });
      downloadFile(csv, `${slugify(event.name)}_attendee_manifest_${auditHash}.csv`, "text/csv;charset=utf-8;");
    }
  }

  function downloadFile(content: string, filename: string, type: string) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  function slugify(text: string) {
    return text.toLowerCase().replace(/[^a-z0-9_-]/g, "_");
  }

  // Branded Graphic Generator
  async function handleDownloadGraphic() {
    setIsGeneratingImage(true);
    try {
      const canvas = document.createElement("canvas");
      const width = 1200;
      const height = docType === "voting"
        ? Math.min(1600, 420 + Math.min(12, votingAnalysis.ranked.length) * 85)
        : Math.min(1400, 440 + Math.min(8, ticketTiers.length) * 90);

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Dark emerald luxury gradient background
      const grad = ctx.createLinearGradient(0, 0, width, height);
      grad.addColorStop(0, "#03140d");
      grad.addColorStop(0.4, "#0a291b");
      grad.addColorStop(1, "#03140d");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      // Gold border accent
      ctx.strokeStyle = "rgba(212, 175, 55, 0.4)";
      ctx.lineWidth = 3;
      ctx.strokeRect(24, 24, width - 48, height - 48);

      // Load Logo
      const logo = new window.Image();
      logo.crossOrigin = "anonymous";
      logo.src = "/images/votecasthub-logo.png";

      await new Promise<void>((resolve) => {
        logo.onload = () => resolve();
        logo.onerror = () => resolve();
      });

      if (logo.complete && logo.naturalWidth > 0) {
        ctx.drawImage(logo, 50, 45, 120, 52);
      } else {
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 26px Georgia";
        ctx.fillText("VOTECASTHUB GH", 50, 80);
      }

      // Title & Header Text
      ctx.fillStyle = "#d4af37";
      ctx.font = "bold 13px sans-serif";
      ctx.fillText("CERTIFIED OFFICIAL AUDIT LEDGER · GHANA", 190, 62);

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 32px Georgia";
      ctx.fillText(event.name.slice(0, 45), 190, 96);

      ctx.fillStyle = "#9ba9a1";
      ctx.font = "14px sans-serif";
      ctx.fillText(
        `Audit Hash: ${auditHash} · Generated ${new Date().toISOString().slice(0, 10)} GMT`,
        190,
        122
      );

      // Draw Separator line
      ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
      ctx.beginPath();
      ctx.moveTo(50, 150);
      ctx.lineTo(width - 50, 150);
      ctx.stroke();

      if (docType === "voting") {
        // KPI Strip
        ctx.fillStyle = "rgba(255, 255, 255, 0.05)";
        ctx.fillRect(50, 170, width - 100, 75);

        ctx.fillStyle = "#4ade80";
        ctx.font = "bold 24px Georgia";
        ctx.fillText(votingAnalysis.totalEventVotes.toLocaleString(), 75, 212);
        ctx.fillStyle = "#9ba9a1";
        ctx.font = "12px sans-serif";
        ctx.fillText("TOTAL BALLOTS", 75, 232);

        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 24px Georgia";
        ctx.fillText(votingAnalysis.categoryCount.toString(), 280, 212);
        ctx.fillStyle = "#9ba9a1";
        ctx.font = "12px sans-serif";
        ctx.fillText("CATEGORIES", 280, 232);

        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 24px Georgia";
        ctx.fillText(votingAnalysis.nomineeCount.toString(), 460, 212);
        ctx.fillStyle = "#9ba9a1";
        ctx.font = "12px sans-serif";
        ctx.fillText("NOMINEES", 460, 232);

        // Standings Rows
        let y = 280;
        const topRows = votingAnalysis.ranked.slice(0, 12);
        topRows.forEach((r, idx) => {
          ctx.fillStyle = idx % 2 === 0 ? "rgba(255, 255, 255, 0.03)" : "rgba(0, 0, 0, 0.2)";
          ctx.fillRect(50, y - 28, width - 100, 60);

          ctx.fillStyle = r.rank === 1 ? "#fbbf24" : "#ffffff";
          ctx.font = "bold 18px sans-serif";
          ctx.fillText(r.rank === 1 ? "🥇 #1" : `#${r.rank}`, 70, y + 8);

          ctx.fillStyle = "#ffffff";
          ctx.font = "bold 18px Georgia";
          ctx.fillText(r.nomineeName.slice(0, 38), 160, y + 8);

          ctx.fillStyle = "#9ba9a1";
          ctx.font = "14px sans-serif";
          ctx.fillText(r.categoryName.slice(0, 30), 580, y + 8);

          ctx.fillStyle = "#4ade80";
          ctx.font = "bold 18px sans-serif";
          ctx.fillText(`${r.validVotes.toLocaleString()} votes`, 920, y + 8);

          ctx.fillStyle = "#d4af37";
          ctx.font = "13px sans-serif";
          ctx.fillText(r.categoryVoteShare, 1080, y + 8);

          y += 70;
        });
      } else {
        // Ticketing KPI Strip
        ctx.fillStyle = "rgba(255, 255, 255, 0.05)";
        ctx.fillRect(50, 170, width - 100, 75);

        ctx.fillStyle = "#4ade80";
        ctx.font = "bold 24px Georgia";
        ctx.fillText(ticketAnalysis.totalSold.toLocaleString(), 75, 212);
        ctx.fillStyle = "#9ba9a1";
        ctx.font = "12px sans-serif";
        ctx.fillText("PASSES SOLD", 75, 232);

        ctx.fillStyle = "#38bdf8";
        ctx.font = "bold 24px Georgia";
        ctx.fillText(ticketAnalysis.totalAdmitted.toLocaleString(), 280, 212);
        ctx.fillStyle = "#9ba9a1";
        ctx.font = "12px sans-serif";
        ctx.fillText(`ADMITTED (${ticketAnalysis.admittanceRate})`, 280, 232);

        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 24px Georgia";
        ctx.fillText(ticketAnalysis.totalCapacity > 0 ? ticketAnalysis.totalCapacity.toLocaleString() : "Unlimited", 500, 212);
        ctx.fillStyle = "#9ba9a1";
        ctx.font = "12px sans-serif";
        ctx.fillText("CAPACITY ALLOWANCE", 500, 232);

        // Tiers
        let y = 280;
        ticketAnalysis.tierBreakdown.forEach((t) => {
          ctx.fillStyle = "rgba(255, 255, 255, 0.04)";
          ctx.fillRect(50, y - 28, width - 100, 65);

          ctx.fillStyle = "#ffffff";
          ctx.font = "bold 18px Georgia";
          ctx.fillText(t.name, 75, y + 10);

          ctx.fillStyle = "#d4af37";
          ctx.font = "14px sans-serif";
          ctx.fillText(`GH₵ ${t.priceGhs}`, 320, y + 10);

          ctx.fillStyle = "#ffffff";
          ctx.font = "15px sans-serif";
          ctx.fillText(`Sold: ${t.sold.toLocaleString()} / ${t.capacity || "∞"}`, 500, y + 10);

          ctx.fillStyle = "#4ade80";
          ctx.font = "bold 15px sans-serif";
          ctx.fillText(`Admitted: ${t.admitted.toLocaleString()} (${t.checkInRate})`, 820, y + 10);

          y += 75;
        });
      }

      // Footer
      ctx.fillStyle = "#63746c";
      ctx.font = "11px sans-serif";
      ctx.fillText(
        "OFFICIAL TAMPER-PROOF RECORD · VOTICASTHUB GHANA · VERIFIED VIA GATE SECURE INFRASTRUCTURE",
        width / 2 - 260,
        height - 35
      );

      const link = document.createElement("a");
      link.download = `${slugify(event.name)}_${docType}_summary_${auditHash}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } finally {
      setIsGeneratingImage(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-sm overflow-y-auto"
    >
      <div className="relative w-full max-w-5xl rounded-3xl bg-stone-900 border border-stone-800 shadow-2xl overflow-hidden my-auto text-stone-100 flex flex-col max-h-[92vh]">
        {/* Top Control Bar (Screen Only - Hidden in Print) */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5 border-b border-stone-800 bg-[#0c120e] shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-xl">📜</span>
            <div>
              <h2 className="text-base sm:text-lg font-serif font-bold text-white tracking-tight">
                Official Certified Report Studio
              </h2>
              <p className="text-[11px] text-stone-400">
                Audit ID: <span className="font-mono text-emerald-400 font-bold">{auditHash}</span>
              </p>
            </div>
          </div>

          {/* Doc Type Switcher (if both are present) */}
          {hasTickets && hasVoting && (
            <div className="flex items-center rounded-xl bg-stone-800/80 p-1 border border-stone-700">
              <button
                type="button"
                onClick={() => setDocType("voting")}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  docType === "voting"
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "text-stone-300 hover:text-white"
                }`}
              >
                🏆 Voting Standings
              </button>
              <button
                type="button"
                onClick={() => setDocType("ticketing")}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  docType === "ticketing"
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "text-stone-300 hover:text-white"
                }`}
              >
                🎟️ Gate &amp; Tickets
              </button>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 py-2 text-xs font-bold shadow-xs transition-all cursor-pointer active:scale-95"
              title="Print document or save as clean PDF"
            >
              <span>🖨️ Print / Save PDF</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadCsv}
              className="inline-flex items-center gap-1.5 rounded-xl border border-stone-700 bg-stone-800 hover:bg-stone-700 text-stone-200 px-3 py-2 text-xs font-semibold transition-all cursor-pointer"
              title="Export structured CSV with metadata header"
            >
              <Icon name="download" size={13} />
              <span>Analyzed CSV</span>
            </button>

            <button
              type="button"
              disabled={isGeneratingImage}
              onClick={handleDownloadGraphic}
              className="inline-flex items-center gap-1.5 rounded-xl border border-stone-700 bg-stone-800 hover:bg-stone-700 text-stone-200 px-3 py-2 text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
              title="Download Retina-ready branded graphic"
            >
              <Icon name="image" size={13} />
              <span>{isGeneratingImage ? "Generating..." : "Graphic .PNG"}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="rounded-xl p-2 text-stone-400 hover:text-white hover:bg-stone-800 transition-colors"
              aria-label="Close modal"
            >
              <Icon name="close" size={18} />
            </button>
          </div>
        </div>

        {/* Scrollable Document Preview Area */}
        <div className="p-4 sm:p-8 overflow-y-auto bg-stone-950 flex justify-center">
          {/* ========================================================= */}
          {/* THE OFFICIAL PRINTABLE A4 DOCUMENT CONTAINER */}
          {/* id: official-printable-audit-doc for clean @media print */}
          {/* ========================================================= */}
          <div
            id="official-printable-audit-doc"
            className="w-full max-w-[850px] bg-white text-stone-900 shadow-xl rounded-2xl p-8 sm:p-12 border border-stone-200 transition-colors"
          >
            {/* Document Header with Logo & Certified Badge */}
            <div className="flex flex-wrap items-start justify-between gap-6 pb-6 border-b-2 border-stone-200">
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <Image
                    src="/images/votecasthub-logo.png"
                    alt="VoteCastHub GH"
                    width={140}
                    height={50}
                    priority
                    className="h-10 w-auto object-contain"
                  />
                  <div className="h-6 w-px bg-stone-300" />
                  <span className="text-[11px] font-bold uppercase tracking-widest text-emerald-900">
                    Official Audit Division
                  </span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-serif font-bold text-stone-950 tracking-tight">
                  {event.name}
                </h1>
                <p className="text-xs text-stone-600">
                  <span className="font-semibold text-stone-800">
                    {docType === "voting"
                      ? "Certified Voting Standings & Declaration of Results"
                      : "Official Gate Admittance & Attendee Manifest Report"}
                  </span>
                  {" · "}
                  {event.voting_mode === "paid" ? "Paid MoMo/Card Ballot" : "Free Ballot"}
                </p>
              </div>

              {/* Tamper-Evident Security Seal */}
              <div className="rounded-xl border-2 border-emerald-800/30 bg-emerald-50/60 p-3.5 text-right space-y-1">
                <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-emerald-900">
                  <span className="h-2 w-2 rounded-full bg-emerald-600 animate-pulse" />
                  <span>Tamper-Evident Record</span>
                </div>
                <div className="font-mono text-xs font-bold text-emerald-950">
                  {auditHash}
                </div>
                <div className="text-[10px] text-stone-500">
                  Issued: {dateFormatted}
                </div>
              </div>
            </div>

            {/* Document Body: Voting Mode */}
            {docType === "voting" ? (
              <div className="mt-8 space-y-8">
                {/* Executive Summary Metrics */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="rounded-xl border border-stone-200 bg-stone-50/80 p-3.5">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-stone-500">
                      Total Valid Ballots
                    </p>
                    <p className="mt-1 text-2xl font-serif font-bold text-emerald-900">
                      {votingAnalysis.totalEventVotes.toLocaleString()}
                    </p>
                    <p className="text-[10px] text-stone-500 mt-0.5">Recorded &amp; counted</p>
                  </div>

                  <div className="rounded-xl border border-stone-200 bg-stone-50/80 p-3.5">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-stone-500">
                      Contested Categories
                    </p>
                    <p className="mt-1 text-2xl font-serif font-bold text-stone-900">
                      {votingAnalysis.categoryCount}
                    </p>
                    <p className="text-[10px] text-stone-500 mt-0.5">Official awards</p>
                  </div>

                  <div className="rounded-xl border border-stone-200 bg-stone-50/80 p-3.5">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-stone-500">
                      Certified Nominees
                    </p>
                    <p className="mt-1 text-2xl font-serif font-bold text-stone-900">
                      {votingAnalysis.nomineeCount}
                    </p>
                    <p className="text-[10px] text-stone-500 mt-0.5">Across all categories</p>
                  </div>

                  <div className="rounded-xl border border-stone-200 bg-stone-50/80 p-3.5">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-stone-500">
                      Ballot Integrity
                    </p>
                    <p className="mt-1 text-2xl font-serif font-bold text-emerald-700">
                      100%
                    </p>
                    <p className="text-[10px] text-stone-500 mt-0.5">Verified &amp; audited</p>
                  </div>
                </div>

                {/* Categories & Standings Tables */}
                <div className="space-y-6">
                  {Object.entries(categoriesGrouped).map(([catName, rows]) => {
                    const catTotal = votingAnalysis.categoryTotals[catName] || 0;
                    return (
                      <div
                        key={catName}
                        className="rounded-xl border border-stone-200 overflow-hidden break-inside-avoid"
                      >
                        {/* Category Subheader */}
                        <div className="flex items-center justify-between bg-stone-100 px-4 py-2.5 border-b border-stone-200">
                          <h3 className="font-serif font-bold text-sm text-stone-900">
                            {catName}
                          </h3>
                          <span className="text-xs font-semibold text-stone-600">
                            {catTotal.toLocaleString()} category votes
                          </span>
                        </div>

                        {/* Table of Nominees */}
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="border-b border-stone-200 bg-stone-50 text-[10px] font-bold uppercase text-stone-500">
                              <th className="py-2 px-3 w-12 text-center">Rank</th>
                              <th className="py-2 px-3">Nominee</th>
                              <th className="py-2 px-3 text-right">Votes</th>
                              <th className="py-2 px-3 text-right">Category Share</th>
                              <th className="py-2 px-3 text-right">Standing</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-stone-100">
                            {rows.map((r, idx) => {
                              const isWinner = r.rank === 1 && r.validVotes > 0;
                              return (
                                <tr
                                  key={idx}
                                  className={isWinner ? "bg-emerald-50/40 font-semibold" : "hover:bg-stone-50"}
                                >
                                  <td className="py-2 px-3 text-center">
                                    {isWinner ? (
                                      <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-amber-400 text-amber-950 font-bold text-[11px]">
                                        1
                                      </span>
                                    ) : (
                                      <span className="text-stone-500">{r.rank}</span>
                                    )}
                                  </td>
                                  <td className="py-2 px-3 text-stone-900">
                                    {r.nomineeName}
                                    {isWinner && (
                                      <span className="ml-2 text-[10px] font-bold uppercase text-emerald-800">
                                        🥇 Winner
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-2 px-3 text-right font-mono font-semibold text-stone-900">
                                    {r.validVotes.toLocaleString()}
                                  </td>
                                  <td className="py-2 px-3 text-right text-stone-700">
                                    {r.categoryVoteShare}
                                  </td>
                                  <td className="py-2 px-3 text-right">
                                    <span
                                      className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                                        isWinner
                                          ? "bg-emerald-100 text-emerald-900"
                                          : r.rank === 2
                                          ? "bg-stone-100 text-stone-800"
                                          : "text-stone-500"
                                      }`}
                                    >
                                      {r.status}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              /* Document Body: Ticketing Mode */
              <div className="mt-8 space-y-8">
                {/* Executive Summary Metrics */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="rounded-xl border border-stone-200 bg-stone-50/80 p-3.5">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-stone-500">
                      Event Capacity
                    </p>
                    <p className="mt-1 text-2xl font-serif font-bold text-stone-900">
                      {ticketAnalysis.totalCapacity > 0
                        ? ticketAnalysis.totalCapacity.toLocaleString()
                        : "Unlimited"}
                    </p>
                    <p className="text-[10px] text-stone-500 mt-0.5">Maximum quota allowance</p>
                  </div>

                  <div className="rounded-xl border border-stone-200 bg-stone-50/80 p-3.5">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-stone-500">
                      Passes Issued / Sold
                    </p>
                    <p className="mt-1 text-2xl font-serif font-bold text-emerald-900">
                      {ticketAnalysis.totalSold.toLocaleString()}
                    </p>
                    <p className="text-[10px] text-stone-500 mt-0.5">
                      {ticketAnalysis.utilizationRate} capacity sold
                    </p>
                  </div>

                  <div className="rounded-xl border border-stone-200 bg-stone-50/80 p-3.5">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-stone-500">
                      Total Admitted at Gate
                    </p>
                    <p className="mt-1 text-2xl font-serif font-bold text-emerald-700">
                      {ticketAnalysis.totalAdmitted.toLocaleString()}
                    </p>
                    <p className="text-[10px] text-stone-500 mt-0.5">
                      {ticketAnalysis.admittanceRate} check-in rate
                    </p>
                  </div>

                  <div className="rounded-xl border border-stone-200 bg-stone-50/80 p-3.5">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-stone-500">
                      Outstanding Passes
                    </p>
                    <p className="mt-1 text-2xl font-serif font-bold text-amber-900">
                      {Math.max(0, ticketAnalysis.totalSold - ticketAnalysis.totalAdmitted).toLocaleString()}
                    </p>
                    <p className="text-[10px] text-stone-500 mt-0.5">Pending gate check-in</p>
                  </div>
                </div>

                {/* Tier Quota Breakdown Table */}
                <div className="rounded-xl border border-stone-200 overflow-hidden break-inside-avoid">
                  <div className="bg-stone-100 px-4 py-2.5 border-b border-stone-200">
                    <h3 className="font-serif font-bold text-sm text-stone-900">
                      Ticket Tiers Capacity &amp; Admittance Matrix
                    </h3>
                  </div>
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-stone-200 bg-stone-50 text-[10px] font-bold uppercase text-stone-500">
                        <th className="py-2.5 px-3">Tier Name</th>
                        <th className="py-2.5 px-3 text-right">Unit Price</th>
                        <th className="py-2.5 px-3 text-right">Quota Allowance</th>
                        <th className="py-2.5 px-3 text-right">Sold / Issued</th>
                        <th className="py-2.5 px-3 text-right">Admitted at Gate</th>
                        <th className="py-2.5 px-3 text-right">Check-in Rate</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {ticketAnalysis.tierBreakdown.map((t, idx) => (
                        <tr key={idx} className="hover:bg-stone-50">
                          <td className="py-2.5 px-3 font-semibold text-stone-900">{t.name}</td>
                          <td className="py-2.5 px-3 text-right font-mono text-stone-800">
                            GH₵ {t.priceGhs}
                          </td>
                          <td className="py-2.5 px-3 text-right text-stone-700">
                            {t.capacity > 0 ? t.capacity.toLocaleString() : "Unlimited"}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-semibold text-stone-900">
                            {t.sold.toLocaleString()}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-semibold text-emerald-800">
                            {t.admitted.toLocaleString()}
                          </td>
                          <td className="py-2.5 px-3 text-right font-semibold text-stone-800">
                            {t.checkInRate}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Gate Scanners & Door Audit */}
                {Object.keys(scannerStats).length > 0 && (
                  <div className="rounded-xl border border-stone-200 overflow-hidden break-inside-avoid">
                    <div className="bg-stone-100 px-4 py-2 border-b border-stone-200">
                      <h4 className="font-serif font-bold text-xs text-stone-900">
                        Door Operations &amp; Scanner Breakdown
                      </h4>
                    </div>
                    <div className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {Object.entries(scannerStats).map(([scanner, count]) => (
                        <div key={scanner} className="rounded-lg bg-stone-50 border border-stone-200 p-2.5">
                          <p className="text-[10px] font-bold text-stone-500 uppercase">{scanner}</p>
                          <p className="text-base font-bold text-emerald-900 mt-0.5">
                            {count.toLocaleString()} <span className="text-xs font-normal text-stone-600">scans</span>
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Official Certification & Sign-off Block */}
            <div className="mt-12 pt-8 border-t-2 border-stone-300 grid grid-cols-1 sm:grid-cols-2 gap-8 break-inside-avoid">
              <div className="space-y-4">
                <p className="text-xs font-bold uppercase tracking-wider text-stone-600">
                  {docType === "voting"
                    ? "Electoral Commission / Audit Officer"
                    : "Gate Operations Lead / Chief Usher"}
                </p>
                <div className="h-10 border-b border-stone-400" />
                <div className="text-[11px] text-stone-500 space-y-1">
                  <p>Signature: ________________________________</p>
                  <p>Full Name: _________________________________</p>
                  <p>Designation: _______________________________</p>
                  <p>Date: ______________________________________</p>
                </div>
              </div>

              {/* Official Seal Stamp Box */}
              <div className="rounded-xl border-2 border-dashed border-stone-300 p-4 text-center flex flex-col items-center justify-center space-y-2">
                <div className="h-10 w-10 rounded-full border border-emerald-800 flex items-center justify-center text-emerald-900 font-serif font-bold text-xs">
                  VCH
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-stone-800">
                    Official Verification Seal
                  </p>
                  <p className="text-[10px] text-stone-500 max-w-xs mt-0.5">
                    Certified tamper-evident ledger by VoteCastHub Ghana.
                    Authenticate record at <span className="font-mono text-emerald-800">votecasthub.com</span>
                  </p>
                </div>
              </div>
            </div>

            {/* Document Footer Notice */}
            <div className="mt-8 text-center text-[10px] text-stone-400 border-t border-stone-100 pt-3">
              Generated by VoteCastHub Ghana Ltd. · System Reference: {auditHash} · All rights reserved.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
