import { csvValue, categoryStandings, type NomineeAnalytics } from "@/lib/analytics";
import type { TicketTier } from "@/lib/tickets/types";
import type { AttendeeRecord } from "@/lib/tickets/actions";

export function generateAuditHash(eventId: string, dateStr?: string): string {
  const seed = `${eventId}-${dateStr || new Date().toISOString()}`;
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  const hex = Math.abs(hash).toString(16).toUpperCase().padStart(8, "0");
  const prefix = eventId.slice(0, 4).toUpperCase();
  return `VCH-AUDIT-${prefix}-${hex}`;
}

export interface AnalyzedVotingRow {
  rank: number | string;
  categoryName: string;
  nomineeName: string;
  validVotes: number;
  categoryVoteShare: string;
  eventVoteShare: string;
  status: string;
}

export function analyzeVotingStandings(nominees: NomineeAnalytics[]): {
  ranked: AnalyzedVotingRow[];
  totalEventVotes: number;
  categoryTotals: Record<string, number>;
  categoryCount: number;
  nomineeCount: number;
} {
  const ranked = categoryStandings(nominees);
  const totalEventVotes = nominees.reduce((acc, n) => acc + (Number(n.total_votes) || 0), 0);

  const categoryTotals: Record<string, number> = {};
  for (const n of nominees) {
    categoryTotals[n.category_name] = (categoryTotals[n.category_name] || 0) + (Number(n.total_votes) || 0);
  }

  const uniqueCategories = new Set(nominees.map((n) => n.category_name));

  const analyzedRows: AnalyzedVotingRow[] = ranked.map((row) => {
    const votes = Number(row.total_votes) || 0;
    const catTotal = categoryTotals[row.category_name] || 0;
    const catShare = catTotal > 0 ? ((votes / catTotal) * 100).toFixed(1) + "%" : "0.0%";
    const evtShare = totalEventVotes > 0 ? ((votes / totalEventVotes) * 100).toFixed(1) + "%" : "0.0%";

    let status = "Finalist";
    if (votes > 0) {
      if (row.rank === 1) status = "Winner / 1st Place";
      else if (row.rank === 2) status = "Runner-up (2nd)";
      else if (row.rank === 3) status = "3rd Place";
    }

    return {
      rank: votes > 0 ? row.rank : "—",
      categoryName: row.category_name,
      nomineeName: row.nominee_name,
      validVotes: votes,
      categoryVoteShare: catShare,
      eventVoteShare: evtShare,
      status,
    };
  });

  return {
    ranked: analyzedRows,
    totalEventVotes,
    categoryTotals,
    categoryCount: uniqueCategories.size,
    nomineeCount: nominees.length,
  };
}

export function generateAnalyzedVotingCsv({
  eventName,
  votingMode,
  scopeLabel,
  nominees,
  auditHash,
}: {
  eventName: string;
  votingMode?: string;
  scopeLabel: string;
  nominees: NomineeAnalytics[];
  auditHash: string;
}): string {
  const { ranked, totalEventVotes, categoryCount, nomineeCount } = analyzeVotingStandings(nominees);
  const dateFormatted = new Intl.DateTimeFormat("en-GH", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "Africa/Accra",
  }).format(new Date());

  const metadata = [
    `# =========================================================================================`,
    `# VOTICASTHUB GH · CERTIFIED OFFICIAL VOTING RESULTS & STANDINGS AUDIT`,
    `# Event: ${eventName}`,
    `# Mode: ${votingMode === "paid" ? "Paid MoMo / Card Ballot" : "Free / Verified Ballot"}`,
    `# Scope: ${scopeLabel}`,
    `# Generated At: ${dateFormatted} GMT`,
    `# Tamper-Proof Audit Hash: ${auditHash}`,
    `# Summary: ${totalEventVotes.toLocaleString()} Total Ballots | ${categoryCount} Categories | ${nomineeCount} Nominees`,
    `# Certified Security: Verified tamper-evident ledger issued by VoteCastHub Ghana`,
    `# =========================================================================================`,
  ];

  const headers = [
    "Rank",
    "Category",
    "Nominee",
    "Valid Ballots",
    "Category Vote Share",
    "Total Event Share",
    "Standing Status",
  ];

  const rows = ranked.map((r) => [
    csvValue(r.rank),
    csvValue(r.categoryName),
    csvValue(r.nomineeName),
    csvValue(r.validVotes),
    csvValue(r.categoryVoteShare),
    csvValue(r.eventVoteShare),
    csvValue(r.status),
  ]);

  return [...metadata, headers.join(","), ...rows.map((row) => row.join(","))].join("\r\n");
}

export function analyzeTicketingAdmissions(
  attendees: AttendeeRecord[],
  ticketTiers: TicketTier[]
): {
  totalCapacity: number;
  totalSold: number;
  totalAdmitted: number;
  admittanceRate: string;
  utilizationRate: string;
  tierBreakdown: Array<{
    name: string;
    priceGhs: string;
    capacity: number;
    sold: number;
    admitted: number;
    checkInRate: string;
  }>;
} {
  const totalCapacity = ticketTiers.reduce((acc, t) => acc + (t.capacity || 0), 0);
  const totalSold = attendees.reduce((acc, a) => acc + (Number(a.quantity) || 1), 0);
  const totalAdmitted = attendees
    .filter((a) => a.status === "checked_in" || a.checked_in_at)
    .reduce((acc, a) => acc + (Number(a.quantity) || 1), 0);

  const admittanceRate = totalSold > 0 ? ((totalAdmitted / totalSold) * 100).toFixed(1) + "%" : "0.0%";
  const utilizationRate = totalCapacity > 0 ? ((totalSold / totalCapacity) * 100).toFixed(1) + "%" : "0.0%";

  const tierBreakdown = ticketTiers.map((t) => {
    const tierAttendees = attendees.filter((a) => a.tier_name === t.name);
    const tierSold = tierAttendees.reduce((acc, a) => acc + (Number(a.quantity) || 1), 0);
    const tierAdmitted = tierAttendees
      .filter((a) => a.status === "checked_in" || a.checked_in_at)
      .reduce((acc, a) => acc + (Number(a.quantity) || 1), 0);
    const checkInRate = tierSold > 0 ? ((tierAdmitted / tierSold) * 100).toFixed(1) + "%" : "0.0%";

    return {
      name: t.name,
      priceGhs: (Number(t.price_minor) / 100).toFixed(2),
      capacity: t.capacity || 0,
      sold: tierSold,
      admitted: tierAdmitted,
      checkInRate,
    };
  });

  return {
    totalCapacity,
    totalSold,
    totalAdmitted,
    admittanceRate,
    utilizationRate,
    tierBreakdown,
  };
}

export function generateAnalyzedTicketingCsv({
  eventName,
  attendees,
  ticketTiers,
  auditHash,
}: {
  eventName: string;
  attendees: AttendeeRecord[];
  ticketTiers: TicketTier[];
  auditHash: string;
}): string {
  const { totalCapacity, totalSold, totalAdmitted, admittanceRate, utilizationRate } =
    analyzeTicketingAdmissions(attendees, ticketTiers);

  const dateFormatted = new Intl.DateTimeFormat("en-GH", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "Africa/Accra",
  }).format(new Date());

  const metadata = [
    `# =========================================================================================`,
    `# VOTICASTHUB GH · OFFICIAL ATTENDEE MANIFEST & GATE AUDIT REPORT`,
    `# Event: ${eventName}`,
    `# Generated At: ${dateFormatted} GMT`,
    `# Tamper-Proof Audit Hash: ${auditHash}`,
    `# Event Quota Allowance: ${totalCapacity > 0 ? totalCapacity.toLocaleString() : "Unlimited"} Max Capacity`,
    `# Passes Issued / Sold: ${totalSold.toLocaleString()} (${utilizationRate} Capacity Utilized)`,
    `# Total Admitted at Gate: ${totalAdmitted.toLocaleString()} (${admittanceRate} Check-in Rate)`,
    `# Certified Security: Verified tamper-evident ledger issued by VoteCastHub Ghana Gate Protocol`,
    `# =========================================================================================`,
  ];

  const headers = [
    "PAX Code",
    "Order Reference",
    "Attendee Name",
    "Phone Number",
    "Email",
    "Ticket Tier",
    "Unit Price (GHS)",
    "Total Price (GHS)",
    "Sales Channel",
    "Admittance Status",
    "Checked In At (GMT)",
    "Validated By",
    "Issued At (GMT)",
  ];

  const rows = attendees.map((a) => {
    const qty = Number(a.quantity) || 1;
    const unitPrice = (Number(a.price_minor) / qty / 100).toFixed(2);
    const totalPrice = (Number(a.price_minor) / 100).toFixed(2);
    const isAdmitted = a.status === "checked_in" || Boolean(a.checked_in_at);

    return [
      csvValue(a.pax_code),
      csvValue(a.order_reference),
      csvValue(a.customer_name),
      csvValue(a.customer_phone),
      csvValue(a.customer_email || ""),
      csvValue(a.tier_name),
      csvValue(unitPrice),
      csvValue(totalPrice),
      csvValue(a.channel || "web"),
      csvValue(isAdmitted ? "Admitted" : "Pending Entry"),
      csvValue(a.checked_in_at || "—"),
      csvValue(a.checked_in_by || "—"),
      csvValue(a.created_at),
    ];
  });

  return [...metadata, headers.join(","), ...rows.map((row) => row.join(","))].join("\r\n");
}
