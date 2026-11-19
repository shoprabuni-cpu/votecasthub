"use client";

import { useState, useEffect } from "react";
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
  generateAnalyzedFinancialCsv,
} from "@/lib/exports/audit-reports";

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export interface FinancialReportData {
  votingGrossMinor?: number;
  votingNetMinor?: number;
  votingUnitsCount?: number;
  ticketsGrossMinor?: number;
  ticketsNetMinor?: number;
  ticketsUnitsCount?: number;
  organizationName?: string;
}

export function OfficialAuditModal({
  isOpen,
  onClose,
  event,
  organizationId,
  nominees = [],
  ticketTiers = [],
  attendees = [],
  nomineePhotos = {},
  financialData,
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
  nomineePhotos?: Record<string, string>;
  financialData?: FinancialReportData;
  defaultDocType?: "voting" | "ticketing" | "financial";
}) {
  const hasTickets =
    event.event_type === "ticketing" ||
    event.event_type === "hybrid" ||
    ticketTiers.length > 0 ||
    attendees.length > 0;
  const hasVoting = event.event_type !== "ticketing" && nominees.length > 0;
  const hasFinancial =
    event.voting_mode === "paid" ||
    (financialData?.votingGrossMinor ?? 0) > 0 ||
    (financialData?.ticketsGrossMinor ?? 0) > 0;

  const [docType, setDocType] = useState<"voting" | "ticketing" | "financial">(
    defaultDocType === "financial" && hasFinancial
      ? "financial"
      : defaultDocType === "ticketing" && hasTickets
      ? "ticketing"
      : hasVoting
      ? "voting"
      : hasTickets
      ? "ticketing"
      : "financial"
  );

  const [auditHash, setAuditHash] = useState("");
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [isGeneratingWinnerCard, setIsGeneratingWinnerCard] = useState(false);

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

  const money = (minor: number) => `GH₵ ${(Number(minor) / 100).toFixed(2)}`;

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

  // Financial calculations
  const votingGross = financialData?.votingGrossMinor ?? 0;
  const votingNet = financialData?.votingNetMinor ?? Math.round(votingGross * 0.9);
  const votingFee = Math.max(0, votingGross - votingNet);
  const votingUnits = financialData?.votingUnitsCount ?? 0;

  const ticketsGross = financialData?.ticketsGrossMinor ?? 0;
  const ticketsNet = financialData?.ticketsNetMinor ?? Math.round(ticketsGross * 0.9);
  const ticketsFee = Math.max(0, ticketsGross - ticketsNet);
  const ticketsUnits = financialData?.ticketsUnitsCount ?? 0;

  const totalGross = votingGross + ticketsGross;
  const totalNet = votingNet + ticketsNet;
  const totalFee = votingFee + ticketsFee;
  const totalUnits = votingUnits + ticketsUnits;

  // Print Action
  function handlePrint() {
    document.body.classList.add("printing-audit-report");
    window.print();
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
    } else if (docType === "ticketing") {
      const csv = generateAnalyzedTicketingCsv({
        eventName: event.name,
        attendees,
        ticketTiers,
        auditHash,
      });
      downloadFile(csv, `${slugify(event.name)}_attendee_manifest_${auditHash}.csv`, "text/csv;charset=utf-8;");
    } else {
      const csv = generateAnalyzedFinancialCsv({
        eventName: event.name,
        organizationName: financialData?.organizationName,
        votingGrossMinor: votingGross,
        votingNetMinor: votingNet,
        votingUnitsCount: votingUnits,
        ticketsGrossMinor: ticketsGross,
        ticketsNetMinor: ticketsNet,
        ticketsUnitsCount: ticketsUnits,
        auditHash,
      });
      downloadFile(csv, `${slugify(event.name)}_financial_settlement_${auditHash}.csv`, "text/csv;charset=utf-8;");
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

  function loadImage(src: string): Promise<HTMLImageElement | null> {
    return new Promise((resolve) => {
      const img = new window.Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    });
  }

  // Standings / Financial Summary Graphic (Landscape 1200px)
  async function handleDownloadGraphic() {
    setIsGeneratingImage(true);
    try {
      const canvas = document.createElement("canvas");
      const width = 1200;
      const height =
        docType === "financial"
          ? 780
          : docType === "voting"
          ? Math.min(1600, 440 + Math.min(12, votingAnalysis.ranked.length) * 88)
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

      // Load VoteCastHub Logo
      const logo = await loadImage("/images/votecasthub-logo.png");
      if (logo) {
        ctx.drawImage(logo, 50, 45, 120, 52);
      } else {
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 26px Georgia";
        ctx.fillText("VOTECASTHUB GH", 50, 80);
      }

      // Title & Header Text
      ctx.fillStyle = "#d4af37";
      ctx.font = "bold 13px sans-serif";
      ctx.fillText(
        docType === "financial"
          ? "CERTIFIED FINANCIAL SETTLEMENT LEDGER · GHANA"
          : "CERTIFIED OFFICIAL AUDIT LEDGER · GHANA",
        190,
        62
      );

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

      if (docType === "financial") {
        // 3 Giant Financial Metric Boxes
        ctx.fillStyle = "rgba(16, 185, 129, 0.12)";
        ctx.fillRect(50, 180, 350, 130);
        ctx.strokeStyle = "rgba(16, 185, 129, 0.4)";
        ctx.lineWidth = 2;
        ctx.strokeRect(50, 180, 350, 130);

        ctx.fillStyle = "#4ade80";
        ctx.font = "bold 36px Georgia";
        ctx.fillText(money(totalNet), 75, 235);
        ctx.fillStyle = "#a7f3d0";
        ctx.font = "bold 12px sans-serif";
        ctx.fillText("ORGANIZER NET PAYOUT (90%)", 75, 265);
        ctx.fillStyle = "#9ba9a1";
        ctx.font = "11px sans-serif";
        ctx.fillText("Credited to designated MoMo / Bank", 75, 290);

        ctx.fillStyle = "rgba(255, 255, 255, 0.05)";
        ctx.fillRect(425, 180, 350, 130);
        ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
        ctx.strokeRect(425, 180, 350, 130);

        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 36px Georgia";
        ctx.fillText(money(totalGross), 450, 235);
        ctx.fillStyle = "#e2e8f0";
        ctx.font = "bold 12px sans-serif";
        ctx.fillText("GROSS REVENUE COLLECTED", 450, 265);
        ctx.fillStyle = "#9ba9a1";
        ctx.font = "11px sans-serif";
        ctx.fillText(`From ${totalUnits.toLocaleString()} total units paid`, 450, 290);

        ctx.fillStyle = "rgba(212, 175, 55, 0.08)";
        ctx.fillRect(800, 180, 350, 130);
        ctx.strokeStyle = "rgba(212, 175, 55, 0.35)";
        ctx.strokeRect(800, 180, 350, 130);

        ctx.fillStyle = "#fbbf24";
        ctx.font = "bold 36px Georgia";
        ctx.fillText(money(totalFee), 825, 235);
        ctx.fillStyle = "#fef3c7";
        ctx.font = "bold 12px sans-serif";
        ctx.fillText("PLATFORM SERVICE FEE (10%)", 825, 265);
        ctx.fillStyle = "#9ba9a1";
        ctx.font = "11px sans-serif";
        ctx.fillText("Absorbs telecom MoMo charges & SMS", 825, 290);

        // Financial Streams Breakdown
        let y = 370;
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 18px Georgia";
        ctx.fillText("REVENUE STREAMS RECONCILIATION", 50, y);
        y += 30;

        const streams = [
          ...(votingUnits > 0 || votingGross > 0
            ? [{ name: "Paid Voting Ballots", units: `${votingUnits.toLocaleString()} votes`, gross: money(votingGross), fee: money(votingFee), net: money(votingNet) }]
            : []),
          ...(ticketsUnits > 0 || ticketsGross > 0
            ? [{ name: "Event Ticket Passes", units: `${ticketsUnits.toLocaleString()} tickets`, gross: money(ticketsGross), fee: money(ticketsFee), net: money(ticketsNet) }]
            : []),
        ];

        streams.forEach((s, idx) => {
          ctx.fillStyle = idx % 2 === 0 ? "rgba(255, 255, 255, 0.04)" : "rgba(0, 0, 0, 0.2)";
          ctx.fillRect(50, y, width - 100, 65);

          ctx.fillStyle = "#ffffff";
          ctx.font = "bold 18px Georgia";
          ctx.fillText(s.name, 75, y + 38);

          ctx.fillStyle = "#9ba9a1";
          ctx.font = "14px sans-serif";
          ctx.fillText(s.units, 350, y + 38);

          ctx.fillStyle = "#ffffff";
          ctx.font = "bold 16px monospace";
          ctx.fillText(`Gross: ${s.gross}`, 560, y + 38);

          ctx.fillStyle = "#fbbf24";
          ctx.font = "bold 16px monospace";
          ctx.fillText(`Fee (10%): ${s.fee}`, 780, y + 38);

          ctx.fillStyle = "#4ade80";
          ctx.font = "bold 18px monospace";
          ctx.fillText(`Net (90%): ${s.net}`, 970, y + 38);

          y += 80;
        });

        // MoMo notice
        ctx.fillStyle = "#d4af37";
        ctx.font = "bold 13px sans-serif";
        ctx.fillText("SETTLEMENT CYCLE: AUTOMATIC T+1 CLEARING VIA PAYSTACK GHANA (BANK OF GHANA REGULATED)", 50, height - 60);
      } else if (docType === "voting") {
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

        // Preload Nominee Avatars in parallel
        const topRows = votingAnalysis.ranked.slice(0, 12);
        const avatarMap: Record<string, HTMLImageElement | null> = {};
        await Promise.all(
          topRows.map(async (r) => {
            const photoUrl = nomineePhotos[r.nomineeId];
            if (photoUrl) {
              avatarMap[r.nomineeId] = await loadImage(photoUrl);
            }
          })
        );

        // Render Standings Rows with Photos
        let y = 280;
        topRows.forEach((r, idx) => {
          ctx.fillStyle = idx % 2 === 0 ? "rgba(255, 255, 255, 0.03)" : "rgba(0, 0, 0, 0.2)";
          ctx.fillRect(50, y - 30, width - 100, 68);

          // Rank Badge
          ctx.fillStyle = r.rank === 1 ? "#fbbf24" : "#ffffff";
          ctx.font = "bold 18px sans-serif";
          ctx.fillText(r.rank === 1 ? "🥇 #1" : `#${r.rank}`, 68, y + 10);

          // Nominee Circular Avatar
          const cx = 150;
          const cy = y + 4;
          const radius = 20;
          const img = avatarMap[r.nomineeId];

          if (img) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(cx, cy, radius, 0, Math.PI * 2);
            ctx.closePath();
            ctx.clip();
            ctx.drawImage(img, cx - radius, cy - radius, radius * 2, radius * 2);
            ctx.restore();

            ctx.beginPath();
            ctx.arc(cx, cy, radius, 0, Math.PI * 2);
            ctx.strokeStyle = r.rank === 1 ? "#fbbf24" : "rgba(255, 255, 255, 0.4)";
            ctx.lineWidth = r.rank === 1 ? 2.5 : 1.2;
            ctx.stroke();
          } else {
            ctx.beginPath();
            ctx.arc(cx, cy, radius, 0, Math.PI * 2);
            ctx.fillStyle = r.rank === 1 ? "#78350f" : "#064e3b";
            ctx.fill();
            ctx.strokeStyle = r.rank === 1 ? "#fbbf24" : "rgba(255, 255, 255, 0.3)";
            ctx.lineWidth = 1.5;
            ctx.stroke();

            ctx.fillStyle = r.rank === 1 ? "#fbbf24" : "#ffffff";
            ctx.font = "bold 11px sans-serif";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(getInitials(r.nomineeName), cx, cy);
            ctx.textAlign = "start";
            ctx.textBaseline = "alphabetic";
          }

          // Nominee Name
          ctx.fillStyle = "#ffffff";
          ctx.font = "bold 18px Georgia";
          ctx.fillText(r.nomineeName.slice(0, 34), 190, y + 10);

          // Category Name
          ctx.fillStyle = "#9ba9a1";
          ctx.font = "14px sans-serif";
          ctx.fillText(r.categoryName.slice(0, 28), 580, y + 10);

          // Valid Votes
          ctx.fillStyle = "#4ade80";
          ctx.font = "bold 18px sans-serif";
          ctx.fillText(`${r.validVotes.toLocaleString()} votes`, 910, y + 10);

          // Category Share
          ctx.fillStyle = "#d4af37";
          ctx.font = "13px sans-serif";
          ctx.fillText(r.categoryVoteShare, 1075, y + 10);

          y += 75;
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
        ctx.fillText(
          ticketAnalysis.totalCapacity > 0 ? ticketAnalysis.totalCapacity.toLocaleString() : "Unlimited",
          500,
          212
        );
        ctx.fillStyle = "#9ba9a1";
        ctx.font = "12px sans-serif";
        ctx.fillText("CAPACITY ALLOWANCE", 500, 232);

        // Tiers Matrix
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
        "OFFICIAL TAMPER-PROOF RECORD · VOTICASTHUB GHANA · VERIFIED FINANCIAL & EVENT LEDGER",
        width / 2 - 260,
        height - 30
      );

      const link = document.createElement("a");
      link.download = `${slugify(event.name)}_${docType}_summary_${auditHash}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } finally {
      setIsGeneratingImage(false);
    }
  }

  // Winner Announcement Card (1080x1350 Portrait)
  async function handleDownloadWinnerCard() {
    setIsGeneratingWinnerCard(true);
    try {
      const topWinner =
        votingAnalysis.ranked.find((r) => r.rank === 1 && r.validVotes > 0) ||
        votingAnalysis.ranked[0];

      if (!topWinner) return;

      const canvas = document.createElement("canvas");
      const width = 1080;
      const height = 1350;
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Dark luxury emerald gradient background
      const grad = ctx.createLinearGradient(0, 0, width, height);
      grad.addColorStop(0, "#01130a");
      grad.addColorStop(0.3, "#072f1e");
      grad.addColorStop(0.7, "#052216");
      grad.addColorStop(1, "#01130a");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      // Gold Double Framing
      ctx.strokeStyle = "rgba(212, 175, 55, 0.45)";
      ctx.lineWidth = 3;
      ctx.strokeRect(36, 36, width - 72, height - 72);

      ctx.strokeStyle = "rgba(212, 175, 55, 0.2)";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(50, 50, width - 100, height - 100);

      // VoteCastHub Logo at top
      const logo = await loadImage("/images/votecasthub-logo.png");
      if (logo) {
        ctx.drawImage(logo, width / 2 - 80, 75, 160, 68);
      } else {
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 30px Georgia";
        ctx.textAlign = "center";
        ctx.fillText("VOTECASTHUB GH", width / 2, 120);
      }

      ctx.textAlign = "center";

      // Official declaration banner
      ctx.fillStyle = "#d4af37";
      ctx.font = "bold 13px sans-serif";
      ctx.letterSpacing = "2px";
      ctx.fillText("★ ★ ★  OFFICIAL CERTIFIED WINNER  ★ ★ ★", width / 2, 180);

      // Event Name
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 32px Georgia";
      ctx.fillText(event.name.slice(0, 40), width / 2, 230);

      // Category Pill
      ctx.fillStyle = "rgba(212, 175, 55, 0.15)";
      ctx.fillRect(width / 2 - 280, 260, 560, 46);
      ctx.strokeStyle = "rgba(212, 175, 55, 0.5)";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(width / 2 - 280, 260, 560, 46);

      ctx.fillStyle = "#fbbf24";
      ctx.font = "bold 18px Georgia";
      ctx.fillText(topWinner.categoryName.toUpperCase(), width / 2, 290);

      // Large Winner Portrait (300px diameter circular avatar)
      const cx = width / 2;
      const cy = 540;
      const radius = 150;
      const winnerPhotoUrl = nomineePhotos[topWinner.nomineeId];
      const winnerImg = winnerPhotoUrl ? await loadImage(winnerPhotoUrl) : null;

      if (winnerImg) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(winnerImg, cx - radius, cy - radius, radius * 2, radius * 2);
        ctx.restore();

        // Glowing Gold Double Ring
        ctx.beginPath();
        ctx.arc(cx, cy, radius + 6, 0, Math.PI * 2);
        ctx.strokeStyle = "#fbbf24";
        ctx.lineWidth = 4;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(cx, cy, radius + 12, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(251, 191, 36, 0.4)";
        ctx.lineWidth = 2;
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fillStyle = "#064e3b";
        ctx.fill();

        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.strokeStyle = "#fbbf24";
        ctx.lineWidth = 4;
        ctx.stroke();

        ctx.fillStyle = "#fbbf24";
        ctx.font = "bold 72px Georgia";
        ctx.textBaseline = "middle";
        ctx.fillText(getInitials(topWinner.nomineeName), cx, cy);
        ctx.textBaseline = "alphabetic";
      }

      // Winner Badge under photo
      ctx.fillStyle = "#d97706";
      ctx.fillRect(cx - 90, cy + radius - 20, 180, 40);
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 16px sans-serif";
      ctx.fillText("🥇 1ST PLACE", cx, cy + radius + 6);

      // Winner's Full Name
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 44px Georgia";
      ctx.fillText(topWinner.nomineeName, cx, 770);

      // Vote Tally Pill
      ctx.fillStyle = "rgba(16, 185, 129, 0.15)";
      ctx.fillRect(cx - 240, 810, 480, 65);
      ctx.strokeStyle = "rgba(16, 185, 129, 0.4)";
      ctx.lineWidth = 2;
      ctx.strokeRect(cx - 240, 810, 480, 65);

      ctx.fillStyle = "#4ade80";
      ctx.font = "bold 26px sans-serif";
      ctx.fillText(
        `🏆 ${topWinner.validVotes.toLocaleString()} Certified Ballots`,
        cx,
        852
      );

      ctx.fillStyle = "#d4af37";
      ctx.font = "16px sans-serif";
      ctx.fillText(`${topWinner.categoryVoteShare} of Category Vote Share`, cx, 915);

      // Separator
      ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
      ctx.beginPath();
      ctx.moveTo(150, 960);
      ctx.lineTo(width - 150, 960);
      ctx.stroke();

      // Audit Verification Seal
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 14px sans-serif";
      ctx.fillText("CERTIFIED TAMPER-EVIDENT RECORD · VOTICASTHUB GHANA", cx, 1010);

      ctx.fillStyle = "#4ade80";
      ctx.font = "bold 16px monospace";
      ctx.fillText(`LEDGER ID: ${auditHash}`, cx, 1045);

      ctx.fillStyle = "#9ba9a1";
      ctx.font = "12px sans-serif";
      ctx.fillText(
        `Authenticated record generated on ${dateFormatted}. Verified on votecasthub.com`,
        cx,
        1075
      );

      // Bottom Watermark
      ctx.fillStyle = "#475569";
      ctx.font = "11px sans-serif";
      ctx.fillText("POWERING ELECTIONS & AWARDS ACROSS GHANA", cx, 1280);

      const link = document.createElement("a");
      link.download = `${slugify(event.name)}_${slugify(topWinner.nomineeName)}_winner_card_${auditHash}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } finally {
      setIsGeneratingWinnerCard(false);
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

          {/* Doc Type Switcher */}
          <div className="flex items-center rounded-xl bg-stone-800/80 p-1 border border-stone-700 flex-wrap gap-1">
            {hasVoting && (
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
            )}
            {hasTickets && (
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
            )}
            {hasFinancial && (
              <button
                type="button"
                onClick={() => setDocType("financial")}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  docType === "financial"
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "text-stone-300 hover:text-white"
                }`}
              >
                💰 Financial &amp; Payout
              </button>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 py-2 text-xs font-bold shadow-xs transition-all cursor-pointer active:scale-95"
              title="Print document or save as clean PDF"
            >
              <span>🖨️ Print / Save PDF</span>
            </button>

            {docType === "voting" && votingAnalysis.ranked.length > 0 && (
              <button
                type="button"
                disabled={isGeneratingWinnerCard}
                onClick={handleDownloadWinnerCard}
                className="inline-flex items-center gap-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white px-3 py-2 text-xs font-bold transition-all cursor-pointer disabled:opacity-50 active:scale-95 shadow-xs"
                title="Download 1080x1350 Winner Portrait Card with Nominee Photo for WhatsApp/Instagram"
              >
                <span>🏆 {isGeneratingWinnerCard ? "Generating..." : "Winner Card (.PNG)"}</span>
              </button>
            )}

            <button
              type="button"
              disabled={isGeneratingImage}
              onClick={handleDownloadGraphic}
              className="inline-flex items-center gap-1.5 rounded-xl border border-stone-700 bg-stone-800 hover:bg-stone-700 text-stone-200 px-3 py-2 text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
              title="Download Retina-ready branded graphic"
            >
              <Icon name="image" size={13} />
              <span>{isGeneratingImage ? "Generating..." : "Summary Graphic (.PNG)"}</span>
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
                    {docType === "financial" ? "Financial & Settlement Clearing" : "Official Audit Division"}
                  </span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-serif font-bold text-stone-950 tracking-tight">
                  {event.name}
                </h1>
                <p className="text-xs text-stone-600">
                  <span className="font-semibold text-stone-800">
                    {docType === "financial"
                      ? "Official Financial Reconciliation & Settlement Statement"
                      : docType === "voting"
                      ? "Certified Voting Standings & Declaration of Results"
                      : "Official Gate Admittance & Attendee Manifest Report"}
                  </span>
                  {" · "}
                  {docType === "financial"
                    ? "Paystack Mobile Money & Card Settlement"
                    : event.voting_mode === "paid"
                    ? "Paid MoMo/Card Ballot"
                    : "Free Ballot"}
                </p>
              </div>

              {/* Tamper-Evident Security Seal */}
              <div className="rounded-xl border-2 border-emerald-800/30 bg-emerald-50/60 p-3.5 text-right space-y-1">
                <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-emerald-900">
                  <span className="h-2 w-2 rounded-full bg-emerald-600 animate-pulse" />
                  <span>Tamper-Evident Ledger</span>
                </div>
                <div className="font-mono text-xs font-bold text-emerald-950">
                  {auditHash}
                </div>
                <div className="text-[10px] text-stone-500">
                  Issued: {dateFormatted}
                </div>
              </div>
            </div>

            {/* Document Body: Financial Mode */}
            {docType === "financial" ? (
              <div className="mt-8 space-y-8">
                {/* 4 Executive Financial Summary Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="rounded-xl border-2 border-emerald-600 bg-emerald-50/80 p-4">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-900">
                      Net Organizer Payout (90%)
                    </p>
                    <p className="mt-1 text-2xl font-serif font-bold text-emerald-950 font-mono">
                      {money(totalNet)}
                    </p>
                    <p className="text-[10px] text-emerald-800 mt-1">Direct organizer balance</p>
                  </div>

                  <div className="rounded-xl border border-stone-200 bg-stone-50/80 p-4">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-stone-500">
                      Gross Collected
                    </p>
                    <p className="mt-1 text-2xl font-serif font-bold text-stone-900 font-mono">
                      {money(totalGross)}
                    </p>
                    <p className="text-[10px] text-stone-500 mt-1">Total incoming payments</p>
                  </div>

                  <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-amber-900">
                      Platform Fee (10%)
                    </p>
                    <p className="mt-1 text-2xl font-serif font-bold text-amber-950 font-mono">
                      {money(totalFee)}
                    </p>
                    <p className="text-[10px] text-amber-800 mt-1">Absorbs MoMo &amp; gateway costs</p>
                  </div>

                  <div className="rounded-xl border border-stone-200 bg-stone-50/80 p-4">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-stone-500">
                      Total Checkouts
                    </p>
                    <p className="mt-1 text-2xl font-serif font-bold text-stone-900 font-mono">
                      {totalUnits.toLocaleString()}
                    </p>
                    <p className="text-[10px] text-stone-500 mt-1">Confirmed transactions</p>
                  </div>
                </div>

                {/* Revenue Streams Table */}
                <div className="rounded-xl border border-stone-200 overflow-hidden break-inside-avoid">
                  <div className="bg-stone-100 px-4 py-2.5 border-b border-stone-200">
                    <h3 className="font-serif font-bold text-sm text-stone-900">
                      Event Revenue Streams Breakdown
                    </h3>
                  </div>
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-stone-200 bg-stone-50 text-[10px] font-bold uppercase text-stone-500">
                        <th className="py-2.5 px-3">Revenue Stream</th>
                        <th className="py-2.5 px-3 text-right">Units Paid</th>
                        <th className="py-2.5 px-3 text-right">Gross Volume</th>
                        <th className="py-2.5 px-3 text-right">Platform Fee (10%)</th>
                        <th className="py-2.5 px-3 text-right">Your Net Payout (90%)</th>
                        <th className="py-2.5 px-3 text-right">Settlement Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100 font-mono">
                      {votingUnits > 0 || votingGross > 0 ? (
                        <tr className="hover:bg-stone-50">
                          <td className="py-3 px-3 font-sans font-semibold text-stone-900">
                            Paid Voting Ballots
                          </td>
                          <td className="py-3 px-3 text-right text-stone-700">
                            {votingUnits.toLocaleString()} votes
                          </td>
                          <td className="py-3 px-3 text-right text-stone-900 font-semibold">
                            {money(votingGross)}
                          </td>
                          <td className="py-3 px-3 text-right text-amber-900">
                            {money(votingFee)}
                          </td>
                          <td className="py-3 px-3 text-right font-bold text-emerald-800">
                            {money(votingNet)}
                          </td>
                          <td className="py-3 px-3 text-right font-sans">
                            <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-900">
                              Settled / Available
                            </span>
                          </td>
                        </tr>
                      ) : null}

                      {ticketsUnits > 0 || ticketsGross > 0 ? (
                        <tr className="hover:bg-stone-50">
                          <td className="py-3 px-3 font-sans font-semibold text-stone-900">
                            Event Ticket Passes
                          </td>
                          <td className="py-3 px-3 text-right text-stone-700">
                            {ticketsUnits.toLocaleString()} tickets
                          </td>
                          <td className="py-3 px-3 text-right text-stone-900 font-semibold">
                            {money(ticketsGross)}
                          </td>
                          <td className="py-3 px-3 text-right text-amber-900">
                            {money(ticketsFee)}
                          </td>
                          <td className="py-3 px-3 text-right font-bold text-emerald-800">
                            {money(ticketsNet)}
                          </td>
                          <td className="py-3 px-3 text-right font-sans">
                            <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-900">
                              Settled / Available
                            </span>
                          </td>
                        </tr>
                      ) : null}

                      <tr className="bg-stone-100/90 font-bold border-t-2 border-stone-300">
                        <td className="py-3 px-3 font-sans text-stone-950">
                          Combined Total
                        </td>
                        <td className="py-3 px-3 text-right text-stone-950">
                          {totalUnits.toLocaleString()}
                        </td>
                        <td className="py-3 px-3 text-right text-stone-950">
                          {money(totalGross)}
                        </td>
                        <td className="py-3 px-3 text-right text-amber-950">
                          {money(totalFee)}
                        </td>
                        <td className="py-3 px-3 text-right text-emerald-900 text-sm">
                          {money(totalNet)}
                        </td>
                        <td className="py-3 px-3 text-right font-sans">
                          <span className="inline-flex rounded-full bg-emerald-200 px-2.5 py-0.5 text-[10px] font-bold text-emerald-950">
                            Reconciled
                          </span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Settlement & Payout Policy Information */}
                <div className="rounded-xl border border-stone-200 bg-stone-50/70 p-4 space-y-2 text-xs break-inside-avoid">
                  <h4 className="font-serif font-bold text-stone-900">
                    Official Settlement &amp; Disbursement Terms
                  </h4>
                  <ul className="list-disc list-inside text-stone-600 space-y-1 text-[11px] leading-relaxed">
                    <li>
                      <strong>Zero Extra Processing Deductions:</strong> The 10% platform share absorbs all Mobile Money (MTN MoMo, Telecel Cash, AT Money) and card processing charges. Organizers receive the exact 90% net earnings.
                    </li>
                    <li>
                      <strong>Automatic T+1 Clearing:</strong> Payout batches clear automatically into your designated bank account or registered Mobile Money wallet.
                    </li>
                    <li>
                      <strong>Bank of Ghana Regulated Infrastructure:</strong> All payments are processed through certified Bank of Ghana and PCI-DSS Level 1 compliant gateways.
                    </li>
                  </ul>
                </div>
              </div>
            ) : docType === "voting" ? (
              /* Document Body: Voting Mode */
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
                              const photoUrl = nomineePhotos[r.nomineeId];
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
                                    <div className="flex items-center gap-2">
                                      {photoUrl ? (
                                        <img
                                          src={photoUrl}
                                          alt={r.nomineeName}
                                          className="h-6 w-6 rounded-full object-cover border border-stone-300 shrink-0"
                                        />
                                      ) : (
                                        <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-emerald-100 text-emerald-950 font-bold text-[9px] shrink-0">
                                          {getInitials(r.nomineeName)}
                                        </span>
                                      )}
                                      <span className="font-semibold text-stone-950">{r.nomineeName}</span>
                                      {isWinner && (
                                        <span className="ml-1 text-[10px] font-bold uppercase text-emerald-800">
                                          🥇 Winner
                                        </span>
                                      )}
                                    </div>
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
                  {docType === "financial"
                    ? "Chief Financial Officer / Authorized Auditor"
                    : docType === "voting"
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
                    {docType === "financial" ? "Financial Clearing & Settlement Seal" : "Official Verification Seal"}
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
              Generated by VoteCastHub Ghana Ltd. · Financial Reference: {auditHash} · All rights reserved.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
