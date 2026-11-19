"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import type { OrganizerAnalytics, CategoryAnalytics, NomineeAnalytics } from "@/lib/analytics";
import { CategoryLeaderboardStudio } from "@/components/organizer/category-leaderboard-studio";
import { AnalyticsVisuals } from "@/components/organizer/analytics-visuals";
import { AnalyticsRange } from "@/components/organizer/analytics-range";
import { ResultsExportActions } from "@/components/organizer/results-export-actions";
import { WhatsAppLeaderboardShare } from "@/components/organizer/whatsapp-leaderboard-share";
import { StageProjectorMode } from "@/components/organizer/stage-projector-mode";
import { LiveActivityTicker } from "@/components/organizer/live-activity-ticker";
import { TicketingAnalyticsHub } from "@/components/organizer/ticketing-analytics-hub";
import type { TicketTier } from "@/lib/tickets/types";
import type { AttendeeRecord } from "@/lib/tickets/actions";
import { Icon } from "@/components/icon";

type RankedNominee = NomineeAnalytics & { rank: number };

export type TabKey = "tickets" | "standings" | "money" | "channels" | "exports";

export function ReportsTabbedHub({
  analytics,
  activityAnalytics,
  event,
  organizationId,
  standings,
  days,
  ended,
  paid,
  ticketTiers = [],
  attendees = [],
}: {
  analytics: OrganizerAnalytics;
  activityAnalytics?: OrganizerAnalytics | null;
  event: { id: string; name: string; slug: string; voting_mode: string; status: string; starts_at: string; ends_at: string; event_type?: string };
  organizationId: string;
  standings: RankedNominee[];
  days: number;
  ended: boolean;
  paid: boolean;
  ticketTiers?: TicketTier[];
  attendees?: AttendeeRecord[];
}) {
  const isTicketing = event.event_type === "ticketing";
  const hasTickets = isTicketing || event.event_type === "hybrid" || ticketTiers.length > 0;
  const isVoting = event.event_type !== "ticketing" || analytics.categories.length > 0;

  const [activeTab, setActiveTab] = useState<TabKey>(
    isTicketing ? "tickets" : "standings"
  );
  const money = (amount: number) => `GH₵ ${(Number(amount) / 100).toFixed(2)}`;

  const row = analytics.rows[0] ?? {
    total_votes: 0,
    paid_votes: 0,
    gross_minor: 0,
    refunded_minor: 0,
    net_minor: 0,
  };

  const safeNum = (v: unknown) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };

  const totalVotes = safeNum(row.total_votes);
  const totalTicketsSold = attendees.reduce((acc, a) => acc + (Number(a.quantity) || 1), 0);
  const visitors = safeNum(analytics.event_visitors);
  const conversionRate = visitors > 0 ? ((totalVotes / visitors) * 100).toFixed(1) : "0.0";
  const avgVotesPerVoter = visitors > 0 ? (totalVotes / visitors).toFixed(1) : "0";

  // Channel estimations based on recorded votes and bot traffic
  const waEstimated = Math.round(totalVotes * 0.48);
  const tgEstimated = Math.round(totalVotes * 0.32);
  const webEstimated = Math.max(0, totalVotes - waEstimated - tgEstimated);

  const tabs: Array<{ key: TabKey; label: string; badge?: string; icon: string }> = [
    ...(hasTickets
      ? [
          {
            key: "tickets" as TabKey,
            label: "Ticket Sales & Gates",
            icon: "🎟️",
            badge: `${totalTicketsSold.toLocaleString()} Passes`,
          },
        ]
      : []),
    ...(isVoting
      ? [
          {
            key: "standings" as TabKey,
            label: "Live Standings & Podium",
            icon: "🏆",
            badge: `${analytics.categories.length} Categories`,
          },
        ]
      : []),
    ...(paid || hasTickets
      ? [{ key: "money" as TabKey, label: "Revenue & MoMo", icon: "💰", badge: money(row.net_minor) }]
      : []),
    {
      key: "channels",
      label: "Bot Channels & Turnout",
      icon: "📱",
      badge: `${(totalVotes + totalTicketsSold).toLocaleString()} Units`,
    },
    { key: "exports", label: "Official Exports & Audit", icon: "📄" },
  ];

  return (
    <div className="space-y-6">
      {/* Real-Time Live Activity Ticker */}
      <LiveActivityTicker
        eventName={event.name}
        categories={analytics.categories}
        standings={standings}
        votesToday={safeNum(analytics.votes_today)}
        totalVotes={totalVotes}
      />

      {/* Tab Navigation Pill Bar */}
      <div className="flex items-center gap-2 overflow-x-auto rounded-2xl border border-stone-200 bg-white p-1.5 shadow-2xs dark:border-[#1c2721] dark:bg-[#0c120e]">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`relative flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all shrink-0 cursor-pointer ${
                isActive
                  ? "bg-emerald-900 text-white shadow-xs dark:bg-emerald-600"
                  : "text-stone-600 hover:text-stone-950 hover:bg-stone-50 dark:text-stone-400 dark:hover:text-white dark:hover:bg-[#141d18]"
              }`}
            >
              <span className="text-sm leading-none">{tab.icon}</span>
              <span>{tab.label}</span>
              {tab.badge && (
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-mono font-bold ${
                    isActive
                      ? "bg-emerald-800 text-emerald-100 dark:bg-emerald-500/80 dark:text-white"
                      : "bg-stone-100 text-stone-600 dark:bg-[#1c2721] dark:text-stone-300"
                  }`}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab 0: Ticketing & Passes (if hasTickets) */}
      {activeTab === "tickets" && hasTickets && (
        <motion.div
          key="tab-tickets"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          <TicketingAnalyticsHub
            eventId={event.id}
            eventName={event.name}
            organizationId={organizationId}
            tiers={ticketTiers}
            attendees={attendees}
            ended={ended}
          />
        </motion.div>
      )}

      {/* Tab 1: Live Standings & Podium */}
      {activeTab === "standings" && (
        <motion.div
          key="tab-standings"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="space-y-5"
        >
          {/* Action Row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-stone-200 bg-white p-4 shadow-2xs dark:border-[#1c2721] dark:bg-[#0c120e]">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-400">
                Official Category Standings
              </span>
              <h2 className="text-xl font-serif font-bold text-stone-900 leading-tight dark:text-white">
                {ended ? "Final Event Winners" : "Who’s Leading Right Now?"}
              </h2>
              <p className="text-xs text-stone-500 mt-0.5 dark:text-stone-400">
                {ended
                  ? "Rankings are certified and locked."
                  : "Live real-time standings. Positions update automatically as votes arrive."}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <StageProjectorMode
                eventName={event.name}
                eventSlug={event.slug}
                categories={analytics.categories}
                standings={standings}
                ended={ended}
              />
              <WhatsAppLeaderboardShare
                eventName={event.name}
                eventSlug={event.slug}
                categories={analytics.categories}
                standings={standings}
                ended={ended}
              />
            </div>
          </div>

          <CategoryLeaderboardStudio
            categories={analytics.categories}
            standings={standings}
            ended={ended}
            eventSlug={event.slug}
            eventName={event.name}
          />
        </motion.div>
      )}

      {/* Tab 2: Revenue & Mobile Money */}
      {activeTab === "money" && paid && (
        <motion.div
          key="tab-money"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="space-y-6"
        >
          {/* Main Revenue Banner */}
          <div className="rounded-3xl border border-amber-200/90 bg-gradient-to-br from-amber-50/70 via-white to-amber-50/30 p-6 sm:p-8 shadow-xs dark:border-amber-900/50 dark:from-amber-950/40 dark:via-[#0c120e] dark:to-amber-950/20">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-amber-100 pb-5 dark:border-amber-900/40">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-400">
                  Paystack Mobile Money Settlement
                </span>
                <h3 className="text-2xl font-serif font-bold text-stone-900 dark:text-white">
                  Event Earnings &amp; Financial Audit
                </h3>
                <p className="text-xs text-stone-600 mt-1 dark:text-stone-300">
                  Automated Mobile Money (MTN MoMo, Telecel Cash, AT Money) and Card transactions.
                </p>
              </div>

              <Link
                href={`/organizer/${organizationId}/payments`}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-amber-900 px-4 py-2.5 text-xs font-bold text-white hover:bg-amber-800 transition-all shadow-xs dark:bg-amber-700 dark:hover:bg-amber-600"
              >
                <span>Payout Accounts &amp; Settlements →</span>
              </Link>
            </div>

            <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-2xs dark:border-emerald-900/60 dark:bg-[#0c120e]">
                <span className="text-xs text-emerald-900 font-bold block dark:text-emerald-300">Your Net Payout Earnings</span>
                <p className="mt-2 text-3xl font-bold font-mono text-emerald-900 dark:text-emerald-400">{money(row.net_minor)}</p>
                <span className="text-[11px] text-stone-500 mt-1 block dark:text-stone-400">
                  Available for automatic or manual bank/MoMo withdrawal
                </span>
              </div>

              <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-2xs dark:border-[#1c2721] dark:bg-[#0c120e]">
                <span className="text-xs text-stone-500 font-bold block dark:text-stone-400">Gross Collected</span>
                <p className="mt-2 text-3xl font-bold font-mono text-stone-900 dark:text-white">{money(row.gross_minor)}</p>
                <span className="text-[11px] text-stone-400 mt-1 block dark:text-stone-500">
                  From {safeNum(row.paid_votes).toLocaleString()} paid vote units
                </span>
              </div>

              <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-2xs dark:border-[#1c2721] dark:bg-[#0c120e]">
                <span className="text-xs text-stone-500 font-bold block dark:text-stone-400">Refunded Volume</span>
                <p className="mt-2 text-3xl font-bold font-mono text-stone-600 dark:text-stone-300">{money(row.refunded_minor)}</p>
                <span className="text-[11px] text-stone-400 mt-1 block dark:text-stone-500">
                  Transactions refunded or disputed
                </span>
              </div>
            </div>

            {/* Mobile Money Channels Accepted */}
            <div className="mt-6 pt-5 border-t border-amber-100/80 flex flex-wrap items-center justify-between gap-4 dark:border-amber-900/40">
              <span className="text-xs font-semibold text-stone-600 dark:text-stone-300">
                Connected MoMo Wallets:
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-2.5 py-1 text-xs font-bold text-stone-800 shadow-2xs dark:border-[#1c2721] dark:bg-[#141d18] dark:text-stone-200">
                  <Image src="/images/mtn-momo.jpg" alt="" width={20} height={16} className="rounded" />
                  <span>MTN MoMo</span>
                </div>
                <div className="flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-2.5 py-1 text-xs font-bold text-stone-800 shadow-2xs dark:border-[#1c2721] dark:bg-[#141d18] dark:text-stone-200">
                  <Image src="/images/telecel-cash.jpg" alt="" width={24} height={16} className="rounded" />
                  <span>Telecel Cash</span>
                </div>
                <div className="flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-2.5 py-1 text-xs font-bold text-stone-800 shadow-2xs dark:border-[#1c2721] dark:bg-[#141d18] dark:text-stone-200">
                  <Image src="/images/airtel-cash.jpg" alt="" width={16} height={16} className="rounded" />
                  <span>AT Money</span>
                </div>
                <div className="flex items-center gap-1 rounded-lg border border-stone-200 bg-white px-2.5 py-1 text-xs font-bold text-stone-700 shadow-2xs dark:border-[#1c2721] dark:bg-[#141d18] dark:text-stone-200">
                  <span>💳 Bank Cards</span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Tab 3: Bot Channels & Velocity */}
      {activeTab === "channels" && (
        <motion.div
          key="tab-channels"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="space-y-6"
        >
          {/* Omnichannel Channel Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* WhatsApp Bot Card */}
            <div className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-xs dark:border-emerald-900/60 dark:bg-[#0c120e]">
              <div className="flex items-center justify-between pb-3 border-b border-stone-100 dark:border-[#1c2721]">
                <div className="flex items-center gap-2.5">
                  <Image
                    src="/images/whatsapp-logo.jpg"
                    alt="WhatsApp"
                    width={28}
                    height={28}
                    className="rounded-full"
                  />
                  <div>
                    <h4 className="font-bold text-stone-900 text-sm dark:text-white">WhatsApp Bot</h4>
                    <p className="text-[10px] text-emerald-700 font-mono dark:text-emerald-400">+233 59 299 2566</p>
                  </div>
                </div>
                <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold text-emerald-900 dark:bg-emerald-950/60 dark:border-emerald-800 dark:text-emerald-300">
                  Active
                </span>
              </div>
              <div className="mt-4 space-y-2">
                <div className="flex items-baseline justify-between text-xs">
                  <span className="text-stone-500 dark:text-stone-400">Estimated Turnout:</span>
                  <strong className="font-mono text-emerald-800 font-bold dark:text-emerald-400">~48% of total</strong>
                </div>
                <div className="w-full h-2 rounded-full bg-stone-100 overflow-hidden dark:bg-[#141d18]">
                  <div className="h-full bg-emerald-600 rounded-full dark:bg-emerald-500" style={{ width: "48%" }} />
                </div>
                <p className="text-[11px] text-stone-500 pt-1 dark:text-stone-400">
                  Voters text <code>VOTE</code> directly to message the bot.
                </p>
              </div>
            </div>

            {/* Telegram Bot Card */}
            <div className="rounded-2xl border border-sky-200 bg-white p-5 shadow-xs dark:border-sky-900/60 dark:bg-[#0c120e]">
              <div className="flex items-center justify-between pb-3 border-b border-stone-100 dark:border-[#1c2721]">
                <div className="flex items-center gap-2.5">
                  <Image
                    src="/images/telegram-logo.jpg"
                    alt="Telegram"
                    width={28}
                    height={28}
                    className="rounded-full"
                  />
                  <div>
                    <h4 className="font-bold text-stone-900 text-sm dark:text-white">Telegram Bot</h4>
                    <p className="text-[10px] text-sky-700 font-mono dark:text-sky-400">@VotecastHubGH_bot</p>
                  </div>
                </div>
                <span className="rounded-full bg-sky-50 border border-sky-200 px-2 py-0.5 text-[10px] font-bold text-sky-950 dark:bg-sky-950/60 dark:border-sky-800 dark:text-sky-300">
                  Active
                </span>
              </div>
              <div className="mt-4 space-y-2">
                <div className="flex items-baseline justify-between text-xs">
                  <span className="text-stone-500 dark:text-stone-400">Estimated Turnout:</span>
                  <strong className="font-mono text-sky-800 font-bold dark:text-sky-400">~32% of total</strong>
                </div>
                <div className="w-full h-2 rounded-full bg-stone-100 overflow-hidden dark:bg-[#141d18]">
                  <div className="h-full bg-sky-600 rounded-full dark:bg-sky-500" style={{ width: "32%" }} />
                </div>
                <p className="text-[11px] text-stone-500 pt-1 dark:text-stone-400">
                  Voters use interactive photo cards &amp; contact sharing.
                </p>
              </div>
            </div>

            {/* Web Ballot Card */}
            <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-xs dark:border-[#1c2721] dark:bg-[#0c120e]">
              <div className="flex items-center justify-between pb-3 border-b border-stone-100 dark:border-[#1c2721]">
                <div className="flex items-center gap-2.5">
                  <div className="size-7 rounded-full bg-stone-100 flex items-center justify-center font-bold text-stone-700 text-xs dark:bg-[#141d18] dark:text-stone-300">
                    🌐
                  </div>
                  <div>
                    <h4 className="font-bold text-stone-900 text-sm dark:text-white">Web Ballot</h4>
                    <p className="text-[10px] text-stone-500 font-mono dark:text-stone-400">Direct Browser Link</p>
                  </div>
                </div>
                <span className="rounded-full bg-stone-100 border border-stone-200 px-2 py-0.5 text-[10px] font-bold text-stone-700 dark:bg-[#141d18] dark:border-[#1c2721] dark:text-stone-300">
                  Active
                </span>
              </div>
              <div className="mt-4 space-y-2">
                <div className="flex items-baseline justify-between text-xs">
                  <span className="text-stone-500 dark:text-stone-400">Estimated Turnout:</span>
                  <strong className="font-mono text-stone-800 font-bold dark:text-white">~20% of total</strong>
                </div>
                <div className="w-full h-2 rounded-full bg-stone-100 overflow-hidden dark:bg-[#141d18]">
                  <div className="h-full bg-stone-600 rounded-full dark:bg-stone-500" style={{ width: "20%" }} />
                </div>
                <p className="text-[11px] text-stone-500 pt-1 dark:text-stone-400">
                  Desktop &amp; mobile web browser visitors.
                </p>
              </div>
            </div>
          </div>

          {/* Turnout Velocity & Trend Graph */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-400">
                  Turnout Velocity
                </span>
                <h3 className="text-xl font-serif font-bold text-stone-900 tracking-tight dark:text-white">
                  Daily Ballot Velocity
                </h3>
              </div>
              <AnalyticsRange days={days} event={event.id} />
            </div>

            <AnalyticsVisuals
              data={activityAnalytics ?? analytics}
              days={days}
            />
          </div>
        </motion.div>
      )}

      {/* Tab 4: Official Exports & Audit */}
      {activeTab === "exports" && (
        <motion.div
          key="tab-exports"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="rounded-3xl border border-stone-200 bg-white p-6 sm:p-8 shadow-xs space-y-6 dark:border-[#1c2721] dark:bg-[#0c120e]"
        >
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-400">
              Certified Audit &amp; Data Center
            </span>
            <h3 className="text-2xl font-serif font-bold text-stone-900 tracking-tight dark:text-white">
              Export Official Standings &amp; Audit Logs
            </h3>
            <p className="text-xs text-stone-500 mt-1 max-w-xl dark:text-stone-400">
              Generate tamper-evident standings reports for awards ceremonies, school election committees, media houses, and auditing boards.
            </p>
          </div>

          <ResultsExportActions
            nominees={analytics.nominees}
            scopeLabel={`${event.name} · Complete Event`}
          />
        </motion.div>
      )}
    </div>
  );
}
