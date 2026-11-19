"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import type { EventFullResults } from "@/lib/events/results";

export function EventResultsView({ data }: { data: EventFullResults }) {
  const { event, categories, audit_hash, total_ballots, total_categories, total_nominees } = data;
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedHash, setCopiedHash] = useState(false);

  // Filter categories and contenders
  const displayedCategories = useMemo(() => {
    return categories
      .filter((cat) => (activeCategory === "all" ? true : cat.category_id === activeCategory))
      .map((cat) => {
        if (!searchTerm.trim()) return cat;
        const q = searchTerm.toLowerCase();
        const filteredContenders = cat.contenders.filter(
          (c) =>
            c.name.toLowerCase().includes(q) ||
            (c.public_code && c.public_code.toLowerCase().includes(q))
        );
        return {
          ...cat,
          contenders: filteredContenders,
        };
      })
      .filter((cat) => (searchTerm.trim() ? cat.contenders.length > 0 : true));
  }, [categories, activeCategory, searchTerm]);

  const origin = typeof window !== "undefined" ? window.location.origin : "https://votecasthub.com";
  const shareUrl = `${origin}/results/${event.slug}`;

  // WhatsApp preformatted share message
  const whatsappShareText = useMemo(() => {
    let lines = [
      `🏆 *${event.name.toUpperCase()}* 🏆`,
      event.is_ended ? `🏁 *Official Final Awards Results*` : `⚡ *Live Standings & Vote Tallies*`,
      `🏛️ Organizer: ${event.organization_name}`,
      `📊 Total Recorded Ballots: ${total_ballots.toLocaleString("en-GH")}`,
      `🔐 Audit Hash: ${audit_hash}`,
      "",
    ];

    // Include top 3 categories and their winners
    categories.slice(0, 5).forEach((cat) => {
      lines.push(`🎖️ *${cat.category_name}*`);
      if (cat.winner) {
        lines.push(`  🥇 1st: *${cat.winner.name}* (${cat.winner.vote_count.toLocaleString("en-GH")} votes · ${cat.winner.vote_share_percentage}%)`);
      } else {
        lines.push(`  _No votes recorded yet_`);
      }
    });

    lines.push("");
    lines.push(`🔗 View the full certified certificate & rankings:`);
    lines.push(shareUrl);
    lines.push(`\n🇬🇭 Powered by VoteCastHub Ghana`);

    return lines.join("\n");
  }, [event, total_ballots, audit_hash, categories, shareUrl]);

  const whatsappHref = `https://wa.me/?text=${encodeURIComponent(whatsappShareText)}`;
  const telegramHref = `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(`🏆 Check out official results for ${event.name} on VoteCastHub GH!`)}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      // ignore
    }
  };

  const handleCopyHash = async () => {
    try {
      await navigator.clipboard.writeText(audit_hash);
      setCopiedHash(true);
      setTimeout(() => setCopiedHash(false), 2500);
    } catch {
      // ignore
    }
  };

  // If results are private/locked
  if (!data.is_public) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <div className="rounded-3xl border border-stone-200 bg-white p-8 shadow-sm sm:p-12 dark:border-[#1c2721] dark:bg-[#0c120e]">
          <span className="text-4xl">🔒</span>
          <h2 className="mt-4 font-serif text-2xl font-bold text-stone-900 dark:text-stone-100">
            Results Are Confidential / Organizer Only
          </h2>
          <p className="mt-2 text-sm text-stone-600 dark:text-stone-300">
            {data.lock_reason ||
              "The organizer has configured results visibility to remain confidential or reserved for the official awards night ceremony."}
          </p>

          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              href={`/events/${event.slug}`}
              className="rounded-xl bg-emerald-900 px-5 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500"
            >
              View Voting Page →
            </Link>
            <Link
              href="/results"
              className="rounded-xl border border-stone-300 bg-white px-5 py-2.5 text-sm font-semibold text-stone-700 shadow-2xs hover:bg-stone-50 dark:border-[#223028] dark:bg-[#121a15] dark:text-stone-300"
            >
              Browse Other Results
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-16">
      {/* Top Breadcrumb & Share Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Link
          href="/results"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-600 hover:text-emerald-800 dark:text-stone-400 dark:hover:text-emerald-400"
        >
          ← Back to all awards results
        </Link>

        {/* Share buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <a
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-600/30 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 dark:border-emerald-500/30 dark:bg-emerald-950/40 dark:text-emerald-300"
          >
            <span>💬 Share WhatsApp</span>
          </a>
          <a
            href={telegramHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-xl border border-sky-600/30 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-800 hover:bg-sky-100 dark:border-sky-500/30 dark:bg-sky-950/40 dark:text-sky-300"
          >
            <span>✈️ Telegram</span>
          </a>
          <button
            onClick={handleCopyLink}
            className="inline-flex items-center gap-1.5 rounded-xl border border-stone-300 bg-white px-3 py-1.5 text-xs font-semibold text-stone-700 shadow-2xs hover:bg-stone-50 dark:border-[#223028] dark:bg-[#121a15] dark:text-stone-300"
          >
            <span>{copiedLink ? "✓ Link Copied" : "🔗 Copy Link"}</span>
          </button>
        </div>
      </div>

      {/* Main Awards Banner Header */}
      <div className="relative overflow-hidden rounded-3xl border border-emerald-900/20 bg-linear-to-br from-stone-900 via-[#0a1810] to-[#04110a] p-6 text-white shadow-xl sm:p-10 dark:border-emerald-500/20">
        <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-3">
            {/* Live / Certified Badge */}
            <div className="flex flex-wrap items-center gap-2">
              {!event.is_ended ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/40 bg-emerald-900/60 px-3 py-1 text-xs font-bold text-emerald-300 backdrop-blur-md">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                  </span>
                  Live Standings · Votes Updating in Real-Time
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/40 bg-amber-950/60 px-3 py-1 text-xs font-bold text-amber-300 backdrop-blur-md">
                  🏆 Official Final Outcomes Certified
                </span>
              )}

              <span className="rounded-full bg-white/10 px-2.5 py-1 font-mono text-[11px] text-stone-300">
                {event.voting_mode === "paid" ? `GH₵${(event.unit_price_minor / 100).toFixed(2)} per vote` : "Free Voting"}
              </span>
            </div>

            <p className="text-xs font-bold uppercase tracking-wider text-emerald-400">
              {event.organization_name}
            </p>
            <h1 className="font-serif text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl text-white">
              {event.name}
            </h1>

            {event.description && (
              <p className="max-w-2xl text-xs text-stone-300 line-clamp-2">
                {event.description}
              </p>
            )}

            {/* Cryptographic Audit Stamp */}
            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
              <span className="text-stone-400">Official Ledger:</span>
              <button
                onClick={handleCopyHash}
                className="inline-flex items-center gap-1.5 rounded-lg bg-black/40 px-2.5 py-1 font-mono text-[11px] font-semibold text-emerald-300 border border-emerald-500/30 hover:bg-black/60 transition-colors"
                title="Click to copy audit hash"
              >
                <span>{audit_hash}</span>
                <span>{copiedHash ? "✓" : "📋"}</span>
              </button>
              <span className="text-stone-400">· Ghana Certified Tamper-Proof</span>
            </div>
          </div>

          {/* Quick Action Button */}
          <div className="flex shrink-0 flex-col gap-2.5 sm:flex-row lg:flex-col">
            {event.is_live && (
              <Link
                href={`/events/${event.slug}`}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white shadow-lg transition-transform hover:scale-102 hover:bg-emerald-500 active:scale-98"
              >
                <span>🗳️ Vote Now in this Event</span>
                <span>→</span>
              </Link>
            )}
            <Link
              href={`/events/${event.slug}`}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 px-5 py-2.5 text-xs font-semibold text-white backdrop-blur-md hover:bg-white/20"
            >
              <span>View Contender Profiles</span>
            </Link>
          </div>
        </div>

        {/* Decorative background glow */}
        <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-20 h-72 w-72 rounded-full bg-amber-500/10 blur-3xl" />
      </div>

      {/* Key Metric Overview Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <div className="rounded-2xl border border-stone-200/90 bg-white p-4 shadow-2xs dark:border-[#1c2721] dark:bg-[#0c120e]">
          <span className="text-xs font-medium text-stone-500 dark:text-stone-400">Total Ballots Cast</span>
          <p className="mt-1 font-mono text-2xl font-extrabold text-emerald-900 dark:text-emerald-400 sm:text-3xl">
            {total_ballots.toLocaleString("en-GH")}
          </p>
          <span className="mt-1 block text-[10px] text-stone-400">100% verified transactions</span>
        </div>

        <div className="rounded-2xl border border-stone-200/90 bg-white p-4 shadow-2xs dark:border-[#1c2721] dark:bg-[#0c120e]">
          <span className="text-xs font-medium text-stone-500 dark:text-stone-400">Categories Contested</span>
          <p className="mt-1 font-mono text-2xl font-extrabold text-stone-800 dark:text-stone-200 sm:text-3xl">
            {total_categories}
          </p>
          <span className="mt-1 block text-[10px] text-stone-400">Official honors contested</span>
        </div>

        <div className="rounded-2xl border border-stone-200/90 bg-white p-4 shadow-2xs dark:border-[#1c2721] dark:bg-[#0c120e]">
          <span className="text-xs font-medium text-stone-500 dark:text-stone-400">Nominees on Ballot</span>
          <p className="mt-1 font-mono text-2xl font-extrabold text-stone-800 dark:text-stone-200 sm:text-3xl">
            {total_nominees}
          </p>
          <span className="mt-1 block text-[10px] text-stone-400">Active contenders</span>
        </div>

        <div className="rounded-2xl border border-stone-200/90 bg-white p-4 shadow-2xs dark:border-[#1c2721] dark:bg-[#0c120e]">
          <span className="text-xs font-medium text-stone-500 dark:text-stone-400">Contest State</span>
          <p className="mt-1 font-serif text-lg font-bold text-stone-900 dark:text-stone-100 sm:text-xl">
            {event.is_ended ? "Final Certified" : "Open for Voting"}
          </p>
          <span className="mt-1 block text-[10px] text-stone-400">
            {event.is_ended ? "Voting concluded" : "Real-time updates"}
          </span>
        </div>
      </div>

      {/* Category Pills & Search Bar */}
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1 sm:max-w-xs">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search contenders or code..."
              className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 pl-9 text-xs text-stone-900 shadow-2xs placeholder:text-stone-400 focus:border-emerald-600 focus:outline-hidden dark:border-[#223028] dark:bg-[#121a15] dark:text-stone-100"
            />
            <span className="pointer-events-none absolute left-3 top-2.5 text-xs text-stone-400">
              🔍
            </span>
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute right-2.5 top-2 text-xs text-stone-400 hover:text-stone-600"
              >
                ✕
              </button>
            )}
          </div>

          <span className="text-xs font-medium text-stone-500 dark:text-stone-400">
            Showing {displayedCategories.length} {displayedCategories.length === 1 ? "category" : "categories"}
          </span>
        </div>

        {/* Scrollable Category Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          <button
            onClick={() => setActiveCategory("all")}
            className={`shrink-0 rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all ${
              activeCategory === "all"
                ? "bg-emerald-900 text-white shadow-xs dark:bg-emerald-600"
                : "border border-stone-200 bg-stone-50 text-stone-600 hover:bg-stone-100 dark:border-[#223028] dark:bg-[#121a15] dark:text-stone-300"
            }`}
          >
            All Categories ({categories.length})
          </button>
          {categories.map((cat) => (
            <button
              key={cat.category_id}
              onClick={() => setActiveCategory(cat.category_id)}
              className={`shrink-0 rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all ${
                activeCategory === cat.category_id
                  ? "bg-emerald-900 text-white shadow-xs dark:bg-emerald-600"
                  : "border border-stone-200 bg-stone-50 text-stone-600 hover:bg-stone-100 dark:border-[#223028] dark:bg-[#121a15] dark:text-stone-300"
              }`}
            >
              {cat.category_name}
              <span className="ml-1.5 rounded-full bg-black/10 px-1.5 py-0.2 text-[10px] dark:bg-white/10">
                {cat.total_votes.toLocaleString("en-GH")}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Category Results Showcase */}
      <div className="space-y-8">
        {displayedCategories.map((category) => (
          <div
            key={category.category_id}
            className="overflow-hidden rounded-3xl border border-stone-200/90 bg-white shadow-sm dark:border-[#1c2721] dark:bg-[#0c120e]"
          >
            {/* Category Header */}
            <div className="border-b border-stone-100 bg-stone-50/80 px-6 py-4 flex flex-wrap items-center justify-between gap-3 dark:border-[#1c2721] dark:bg-[#121a15]">
              <div>
                <span className="text-[10px] font-bold tracking-wider text-emerald-800 uppercase dark:text-emerald-400">
                  Awards Category
                </span>
                <h3 className="font-serif text-xl font-bold text-stone-900 dark:text-white">
                  {category.category_name}
                </h3>
                {category.category_description && (
                  <p className="mt-0.5 text-xs text-stone-500 dark:text-stone-400">
                    {category.category_description}
                  </p>
                )}
              </div>

              <div className="text-right">
                <span className="block font-mono text-base font-extrabold text-stone-900 dark:text-stone-100">
                  {category.total_votes.toLocaleString("en-GH")} votes
                </span>
                <span className="text-[11px] text-stone-500 dark:text-stone-400">
                  {category.contenders.length} {category.contenders.length === 1 ? "contender" : "contenders"}
                </span>
              </div>
            </div>

            {/* Podium Cards Preview (Top 3) */}
            {category.podium.length > 0 && category.total_votes > 0 && (
              <div className="border-b border-stone-100 bg-stone-50/30 p-6 dark:border-[#1c2721] dark:bg-[#080d0a]">
                <p className="mb-4 text-center text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">
                  🏆 Category Leaders &amp; Podium
                </p>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  {category.podium.map((nominee) => {
                    const isGold = nominee.rank === 1;
                    const isSilver = nominee.rank === 2;
                    const isBronze = nominee.rank === 3;

                    return (
                      <div
                        key={nominee.id}
                        className={`relative flex flex-col items-center rounded-2xl border p-5 text-center transition-all ${
                          isGold
                            ? "border-amber-400 bg-gradient-to-b from-amber-50/70 via-white to-amber-50/30 shadow-md dark:border-amber-500/50 dark:from-amber-950/20 dark:via-[#0c120e] dark:to-[#0c120e]"
                            : isSilver
                            ? "border-slate-300 bg-gradient-to-b from-slate-50 to-white shadow-2xs dark:border-slate-700 dark:from-slate-900/20 dark:via-[#0c120e] dark:to-[#0c120e]"
                            : "border-amber-700/30 bg-gradient-to-b from-orange-50/50 to-white shadow-2xs dark:border-amber-700/40 dark:from-orange-950/15 dark:via-[#0c120e] dark:to-[#0c120e]"
                        }`}
                      >
                        {/* Medal Rank Pill */}
                        <div className="mb-3">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold ${
                              isGold
                                ? "bg-amber-400/20 text-amber-800 dark:text-amber-300"
                                : isSilver
                                ? "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                                : "bg-amber-700/20 text-amber-900 dark:text-amber-400"
                            }`}
                          >
                            <span>{isGold ? "🥇 #1 Winner" : isSilver ? "🥈 #2 Runner-up" : "🥉 #3 Third"}</span>
                          </span>
                        </div>

                        {/* Nominee Avatar */}
                        <div className="relative mb-3 h-16 w-16 overflow-hidden rounded-full border-2 shadow-xs border-amber-400">
                          {nominee.image_url ? (
                            <Image
                              src={nominee.image_url}
                              alt={nominee.name}
                              fill
                              sizes="64px"
                              className="object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center bg-stone-200 font-bold text-stone-600 dark:bg-stone-800 dark:text-stone-300">
                              {nominee.name.slice(0, 1)}
                            </div>
                          )}
                        </div>

                        {/* Nominee Info */}
                        <h4 className="font-serif text-base font-bold text-stone-900 dark:text-stone-100">
                          {nominee.name}
                        </h4>
                        {nominee.public_code && (
                          <span className="mt-0.5 font-mono text-[11px] font-semibold text-emerald-800 dark:text-emerald-400">
                            {nominee.public_code}
                          </span>
                        )}

                        {/* Votes & Percentage */}
                        <div className="mt-3 w-full border-t border-stone-200/60 pt-3 dark:border-[#223028]">
                          <span className="font-mono text-lg font-extrabold text-stone-900 dark:text-white">
                            {nominee.vote_count.toLocaleString("en-GH")} votes
                          </span>
                          <span className="block text-xs font-bold text-emerald-700 dark:text-emerald-400">
                            {nominee.vote_share_percentage}% share
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Detailed Standings Table */}
            <div className="p-6">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-stone-200 text-[11px] font-bold uppercase tracking-wider text-stone-500 dark:border-[#1c2721] dark:text-stone-400">
                      <th className="pb-3 pr-4 w-12 text-center">Rank</th>
                      <th className="pb-3 pr-4">Contender</th>
                      <th className="pb-3 pr-4 min-w-[140px]">Vote Share</th>
                      <th className="pb-3 text-right">Recorded Votes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 dark:divide-[#1c2721]">
                    {category.contenders.map((contender) => {
                      const medalEmoji =
                        contender.rank === 1 && contender.vote_count > 0
                          ? "🥇"
                          : contender.rank === 2 && contender.vote_count > 0
                          ? "🥈"
                          : contender.rank === 3 && contender.vote_count > 0
                          ? "🥉"
                          : null;

                      return (
                        <tr
                          key={contender.id}
                          className="hover:bg-stone-50/80 dark:hover:bg-[#121a15]/60 transition-colors"
                        >
                          {/* Rank */}
                          <td className="py-3.5 pr-4 text-center font-bold">
                            {medalEmoji ? (
                              <span className="text-base">{medalEmoji}</span>
                            ) : (
                              <span className="font-mono text-stone-500 dark:text-stone-400">
                                #{contender.rank}
                              </span>
                            )}
                          </td>

                          {/* Nominee details */}
                          <td className="py-3.5 pr-4">
                            <div className="flex items-center gap-3">
                              <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full border border-stone-200 dark:border-[#223028]">
                                {contender.image_url ? (
                                  <Image
                                    src={contender.image_url}
                                    alt={contender.name}
                                    fill
                                    sizes="36px"
                                    className="object-cover"
                                  />
                                ) : (
                                  <div className="flex h-full w-full items-center justify-center bg-stone-100 font-bold text-stone-600 dark:bg-stone-800 dark:text-stone-300">
                                    {contender.name.slice(0, 1)}
                                  </div>
                                )}
                              </div>
                              <div>
                                <span className="font-semibold text-stone-900 dark:text-stone-100">
                                  {contender.name}
                                </span>
                                {contender.public_code && (
                                  <span className="ml-2 font-mono text-[10px] text-stone-500 dark:text-stone-400">
                                    {contender.public_code}
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Progress Bar Vote Share */}
                          <td className="py-3.5 pr-4">
                            <div className="flex items-center gap-2">
                              <div className="h-2 w-full max-w-[120px] overflow-hidden rounded-full bg-stone-100 dark:bg-stone-800">
                                <div
                                  className={`h-full rounded-full transition-all duration-500 ${
                                    contender.rank === 1
                                      ? "bg-amber-500"
                                      : "bg-emerald-600 dark:bg-emerald-500"
                                  }`}
                                  style={{
                                    width: `${Math.max(contender.vote_share_percentage, 1)}%`,
                                  }}
                                />
                              </div>
                              <span className="font-mono text-[11px] font-semibold text-stone-600 dark:text-stone-300">
                                {contender.vote_share_percentage}%
                              </span>
                            </div>
                          </td>

                          {/* Exact Vote Count */}
                          <td className="py-3.5 text-right font-mono font-bold text-stone-900 dark:text-white">
                            {contender.vote_count.toLocaleString("en-GH")}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
