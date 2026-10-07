"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { CategoryAnalytics, NomineeAnalytics } from "@/lib/analytics";
import { contestSummary } from "@/lib/analytics";

const MEDAL: Record<number, { emoji: string; bg: string; text: string }> = {
  1: { emoji: "🥇", bg: "bg-amber-400/20 border border-amber-300", text: "text-amber-700" },
  2: { emoji: "🥈", bg: "bg-stone-200/60 border border-stone-300", text: "text-stone-600" },
  3: { emoji: "🥉", bg: "bg-orange-200/40 border border-orange-300", text: "text-orange-700" },
};

type RankedNominee = NomineeAnalytics & { rank: number };

export function CategoryLeaderboardStudio({
  categories,
  standings,
  ended,
}: {
  categories: CategoryAnalytics[];
  standings: RankedNominee[];
  ended: boolean;
}) {
  const [selectedCatId, setSelectedCatId] = useState<string | "all">(
    categories[0]?.category_id ?? "all"
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"visual" | "table">("visual");

  // Find the closest races across the event
  const closeContests = useMemo(() => {
    const list: { categoryName: string; leader: string; chaser: string; gap: number }[] = [];
    for (const cat of categories) {
      const catNominees = standings
        .filter((n) => n.category_id === cat.category_id)
        .sort((a, b) => Number(b.total_votes) - Number(a.total_votes));
      if (catNominees.length >= 2) {
        const first = Number(catNominees[0].total_votes);
        const second = Number(catNominees[1].total_votes);
        const gap = first - second;
        if (first > 0 && gap <= 25) {
          list.push({
            categoryName: cat.category_name,
            leader: catNominees[0].nominee_name,
            chaser: catNominees[1].nominee_name,
            gap,
          });
        }
      }
    }
    return list.sort((a, b) => a.gap - b.gap);
  }, [categories, standings]);

  const activeCategories = useMemo(() => {
    if (selectedCatId === "all") return categories;
    return categories.filter((c) => c.category_id === selectedCatId);
  }, [categories, selectedCatId]);

  return (
    <div className="space-y-5">
      {/* Drama & Close Contests Alert Banner */}
      <AnimatePresence>
        {closeContests.length > 0 && !ended && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 via-orange-50/60 to-amber-50 p-4 shadow-2xs"
          >
            <div className="flex items-center gap-2 text-xs font-semibold text-amber-900">
              <span className="text-base leading-none">🔥</span>
              <span>Tight Contests — closest margins right now</span>
            </div>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {closeContests.slice(0, 3).map((item) => (
                <div
                  key={item.categoryName}
                  className="rounded-xl border border-amber-200/80 bg-white/90 px-3 py-1.5 text-xs text-amber-950 shadow-2xs"
                >
                  <strong className="font-semibold text-amber-900">{item.categoryName}:</strong>{" "}
                  <span>
                    {item.leader} leads {item.chaser} by only{" "}
                    <strong>{item.gap} vote{item.gap !== 1 ? "s" : ""}!</strong>
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Control Bar: Tabs, Search & View Toggle */}
      <div className="space-y-3">
        {/* Category Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          <button
            type="button"
            onClick={() => setSelectedCatId("all")}
            className={`shrink-0 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all active:scale-95 cursor-pointer ${
              selectedCatId === "all"
                ? "bg-emerald-900 text-white shadow-sm"
                : "border border-stone-200 bg-white text-stone-700 hover:border-emerald-600 hover:bg-stone-50"
            }`}
          >
            All Categories ({categories.length})
          </button>

          {categories.map((cat) => {
            const isSelected = selectedCatId === cat.category_id;
            return (
              <button
                key={cat.category_id}
                type="button"
                onClick={() => setSelectedCatId(cat.category_id)}
                className={`shrink-0 flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all active:scale-95 cursor-pointer ${
                  isSelected
                    ? "bg-emerald-900 text-white shadow-sm"
                    : "border border-stone-200 bg-white text-stone-700 hover:border-emerald-600 hover:bg-stone-50"
                }`}
              >
                <span className="truncate max-w-[140px] sm:max-w-[200px]">{cat.category_name}</span>
                <span
                  className={`rounded-full px-1.5 py-px text-[10px] font-mono font-bold ${
                    isSelected ? "bg-emerald-700 text-white" : "bg-stone-100 text-stone-600"
                  }`}
                >
                  {Number(cat.total_votes).toLocaleString()}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search & Toggle Row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-sm">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search nominee or category…"
              className="w-full rounded-xl border border-stone-300 bg-white pl-3.5 pr-8 py-2 text-xs text-stone-900 placeholder:text-stone-400 focus:border-emerald-600 focus:outline-none focus:ring-3 focus:ring-emerald-600/15 transition-all"
            />
            <AnimatePresence>
              {searchQuery && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-2 text-xs text-stone-400 hover:text-stone-700 cursor-pointer"
                >
                  ✕
                </motion.button>
              )}
            </AnimatePresence>
          </div>

          <div className="flex items-center gap-1 rounded-xl border border-stone-200 bg-stone-100 p-1 text-xs self-start sm:self-auto">
            {(["visual", "table"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setViewMode(mode)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                  viewMode === mode
                    ? "bg-white text-stone-900 shadow-sm"
                    : "text-stone-500 hover:text-stone-800"
                }`}
              >
                {mode === "visual" ? "Visual Podium" : "Spreadsheet"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Categories Display */}
      <div className="space-y-5">
        {activeCategories.map((category, catIndex) => {
          let nominees = standings.filter((n) => n.category_id === category.category_id);

          if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            nominees = nominees.filter(
              (n) => n.nominee_name.toLowerCase().includes(q) || n.category_name.toLowerCase().includes(q)
            );
          }

          if (nominees.length === 0 && searchQuery.trim()) return null;

          const totalCategoryVotes = Number(category.total_votes) || 0;
          const leaderVotes = Number(nominees[0]?.total_votes ?? 0);
          const leaders = nominees.filter((n) => Number(n.total_votes) === leaderVotes && leaderVotes > 0);

          return (
            <motion.article
              key={category.category_id}
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: catIndex * 0.04 }}
              className="overflow-hidden rounded-3xl border border-stone-200/90 bg-white shadow-xs"
            >
              {/* Category Header */}
              <div className="border-b border-stone-100 bg-gradient-to-r from-stone-50 via-white to-stone-50 px-5 py-5 sm:px-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                      Category Standings
                    </span>
                    <h3 className="mt-0.5 text-lg font-serif font-bold text-stone-900 leading-tight">{category.category_name}</h3>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="font-mono text-sm font-bold text-stone-900">
                      {totalCategoryVotes.toLocaleString()}
                    </span>
                    <span className="text-[11px] text-stone-400 block">Total Ballots</span>
                  </div>
                </div>

                {leaders.length > 0 ? (
                  <div className="mt-3 flex items-center gap-2 text-xs">
                    <span className="text-base leading-none">{ended ? "🏆" : "⚡"}</span>
                    <span className="font-semibold text-emerald-900">
                      {leaders.map((l) => l.nominee_name).join(" & ")}
                    </span>
                    <span className="text-stone-400">
                      {leaders.length > 1 ? "— Tied for 1st" : ended ? "— Final Winner" : "— Currently Leading"}
                    </span>
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-stone-400 italic">No votes recorded yet.</p>
                )}

                {leaders.length > 0 && (
                  <p className="mt-1 text-xs text-stone-500">{contestSummary(nominees, ended)}</p>
                )}
              </div>

              {/* Body: Visual Podium vs Table */}
              <AnimatePresence mode="wait">
              {nominees.length === 0 ? (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="p-8 text-center text-xs text-stone-400 italic"
                >
                  No nominees match your search in this category.
                </motion.div>
              ) : viewMode === "visual" ? (
                <motion.div
                  key="visual"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.18 }}
                  className="p-5 sm:p-6 space-y-3"
                >
                  {nominees.map((nominee, idx) => {
                    const votes = Number(nominee.total_votes);
                    const sharePercent = totalCategoryVotes > 0 ? (votes / totalCategoryVotes) * 100 : 0;
                    const isFirst = nominee.rank === 1 && votes > 0;
                    const gap = leaderVotes - votes;
                    const medal = MEDAL[nominee.rank];

                    return (
                      <motion.div
                        key={nominee.nominee_id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.03 }}
                        className={`rounded-2xl border p-4 transition-colors ${
                          isFirst
                            ? "border-emerald-200 bg-gradient-to-r from-emerald-50/60 to-white"
                            : "border-stone-200/70 bg-stone-50/20 hover:bg-stone-50/50"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3 mb-3">
                          <div className="flex items-center gap-3 min-w-0">
                            {/* Rank Badge */}
                            <span
                              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                                medal
                                  ? `${medal.bg} ${medal.text}`
                                  : "bg-stone-100 text-stone-500 border border-stone-200"
                              }`}
                            >
                              {medal ? medal.emoji : `#${nominee.rank}`}
                            </span>
                            <span className="font-semibold text-stone-900 text-sm truncate">
                              {nominee.nominee_name}
                            </span>
                          </div>

                          <div className="flex items-center gap-2.5 shrink-0 text-right">
                            {!isFirst && leaderVotes > 0 && (
                              <span className="text-[11px] font-mono text-stone-400 hidden sm:inline">
                                −{gap.toLocaleString()} behind
                              </span>
                            )}
                            <span className="font-mono text-sm font-bold text-stone-900">
                              {votes.toLocaleString()}{" "}
                              <span className="text-[10px] font-normal text-stone-400">votes</span>
                            </span>
                            <span className="rounded-lg bg-stone-100 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-stone-600">
                              {sharePercent.toFixed(1)}%
                            </span>
                          </div>
                        </div>

                        {/* Animated Progress Bar */}
                        <div className="h-2 w-full rounded-full bg-stone-100 overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${sharePercent}%` }}
                            transition={{ duration: 0.7, ease: "easeOut", delay: idx * 0.05 }}
                            className={`h-full rounded-full ${
                              isFirst
                                ? "bg-gradient-to-r from-emerald-500 to-emerald-600"
                                : nominee.rank === 2
                                ? "bg-stone-400"
                                : nominee.rank === 3
                                ? "bg-amber-400"
                                : "bg-stone-300"
                            }`}
                          />
                        </div>
                      </motion.div>
                    );
                  })}
                </motion.div>
              ) : (
                /* Table View */
                <motion.div
                  key="table"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.18 }}
                  className="overflow-x-auto"
                >
                  <table className="w-full text-left text-xs">
                    <thead className="bg-stone-50 text-stone-500 font-semibold border-b border-stone-200">
                      <tr>
                        <th className="px-5 py-3">Rank</th>
                        <th className="px-5 py-3">Nominee</th>
                        <th className="px-5 py-3 text-right">Votes</th>
                        <th className="px-5 py-3 text-right">Share</th>
                        <th className="px-5 py-3 text-right">Behind #1</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {nominees.map((nominee) => {
                        const votes = Number(nominee.total_votes);
                        const share = totalCategoryVotes > 0 ? (votes / totalCategoryVotes) * 100 : 0;
                        const isLeader = nominee.rank === 1 && votes > 0;
                        const medal = MEDAL[nominee.rank];

                        return (
                          <tr key={nominee.nominee_id} className="hover:bg-stone-50/50 transition-colors">
                            <td className="px-5 py-3">
                              <span
                                className={`inline-flex h-6 w-6 items-center justify-center rounded-lg text-[11px] font-bold ${
                                  medal
                                    ? `${medal.bg} ${medal.text}`
                                    : "bg-stone-100 text-stone-500 border border-stone-200"
                                }`}
                              >
                                {nominee.rank}
                              </span>
                            </td>
                            <td className="px-5 py-3 font-semibold text-stone-900">{nominee.nominee_name}</td>
                            <td className="px-5 py-3 font-mono font-bold text-stone-900 text-right">
                              {votes.toLocaleString()}
                            </td>
                            <td className="px-5 py-3 font-mono text-stone-600 text-right">{share.toFixed(1)}%</td>
                            <td className="px-5 py-3 font-mono text-right">
                              {isLeader
                                ? <span className="text-emerald-700 font-semibold">Leader</span>
                                : <span className="text-stone-400">−{(leaderVotes - votes).toLocaleString()}</span>
                              }
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </motion.div>
              )}
              </AnimatePresence>
            </motion.article>
          );
        })}
      </div>

      {/* No search results across all categories */}
      {searchQuery.trim() &&
        activeCategories.every((cat) => {
          const q = searchQuery.toLowerCase();
          return standings
            .filter((n) => n.category_id === cat.category_id)
            .every(
              (n) =>
                !n.nominee_name.toLowerCase().includes(q) &&
                !n.category_name.toLowerCase().includes(q)
            );
        }) && (
          <div className="rounded-2xl border border-stone-200 bg-stone-50/50 py-10 text-center">
            <p className="text-sm text-stone-500">
              No nominees matching{" "}
              <strong className="text-stone-800">&ldquo;{searchQuery}&rdquo;</strong>.
            </p>
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="mt-3 text-xs font-semibold text-emerald-700 hover:underline cursor-pointer"
            >
              Clear search
            </button>
          </div>
        )}
    </div>
  );
}
