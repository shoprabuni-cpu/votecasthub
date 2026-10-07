"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { OrganizerAnalytics } from "@/lib/analytics";
import { Icon } from "@/components/icon";

export function AnalyticsVisuals({ data, days }: { data: OrganizerAnalytics; days: number }) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const trends = data.trends ?? [];
  const maxVotes = Math.max(1, ...trends.map((row) => Number(row.total_votes)));
  const totalVotesInPeriod = trends.reduce((acc, row) => acc + Number(row.total_votes), 0);
  const avgVotesPerDay = trends.length ? Math.round(totalVotesInPeriod / trends.length) : 0;
  const peakDay = trends.reduce(
    (best, row) => (Number(row.total_votes) > Number(best.total_votes) ? row : best),
    trends[0] ?? { day: "—", total_votes: 0 }
  );

  const activeRow = hoveredIndex !== null ? trends[hoveredIndex] : null;

  return (
    <div className="space-y-5 rounded-2xl border border-stone-200/90 bg-white p-5 sm:p-7 shadow-xs">
      {/* Chart Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-100 pb-4">
        <div>
          <div className="flex items-center gap-2 text-emerald-800 text-xs font-semibold uppercase tracking-wider">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
            <span>Voting Velocity & Activity</span>
          </div>
          <h3 className="mt-1 text-xl font-serif font-bold text-stone-900 tracking-tight">
            Daily Vote Trajectory
          </h3>
          <p className="text-xs text-stone-500">
            Votes cast over time · {days === 0 ? "Full Event Lifetime" : `Past ${days} Days`} (UTC Recorded)
          </p>
        </div>

        {/* Quick Summary Chips */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <div className="rounded-xl border border-stone-200 bg-stone-50/60 px-3 py-1.5">
            <span className="text-[10px] text-stone-400 font-medium block">Daily Average</span>
            <strong className="text-stone-900 font-mono text-xs">{avgVotesPerDay.toLocaleString()} votes</strong>
          </div>
          <div className="rounded-xl border border-stone-200 bg-stone-50/60 px-3 py-1.5">
            <span className="text-[10px] text-stone-400 font-medium block">Peak Spike</span>
            <strong className="text-emerald-800 font-mono text-xs">
              {Number(peakDay.total_votes).toLocaleString()} ({peakDay.day.slice(5)})
            </strong>
          </div>
        </div>
      </div>

      {/* Chart Canvas */}
      {trends.length === 0 ? (
        <div className="h-44 flex items-center justify-center text-xs text-stone-400 italic">
          No daily voting trend data recorded yet.
        </div>
      ) : (
        <div className="relative pt-6">
          {/* Active Tooltip Popover */}
          <div className="h-10 mb-2">
            <AnimatePresence>
              {activeRow ? (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="inline-flex items-center gap-3 rounded-xl border border-emerald-900/10 bg-emerald-950 px-3.5 py-1.5 text-xs text-white shadow-sm"
                >
                  <span className="font-semibold text-emerald-300 font-mono">{activeRow.day}:</span>
                  <span className="font-bold">{Number(activeRow.total_votes).toLocaleString()} Total Votes</span>
                  {Number(activeRow.paid_votes) > 0 && (
                    <span className="text-amber-300 text-[11px] font-mono">
                      (₵ {Number(activeRow.paid_votes).toLocaleString()} Paid)
                    </span>
                  )}
                  {Number(activeRow.free_votes) > 0 && (
                    <span className="text-emerald-200 text-[11px] font-mono">
                      ({Number(activeRow.free_votes).toLocaleString()} Free)
                    </span>
                  )}
                </motion.div>
              ) : (
                <div className="text-xs text-stone-400 flex items-center gap-1.5 py-1">
                  <Icon name="clock" size={13} />
                  <span>Hover over any bar to view the exact breakdown for that date.</span>
                </div>
              )}
            </AnimatePresence>
          </div>

          {/* Bar Chart Bars */}
          <div className="relative h-48 flex items-end gap-1.5 sm:gap-2 border-b border-stone-200 pb-1">
            {/* Horizontal guideline */}
            <div className="absolute inset-x-0 top-0 border-b border-dashed border-stone-200 text-[10px] text-stone-400 font-mono pl-1">
              Top: {maxVotes.toLocaleString()}
            </div>
            <div className="absolute inset-x-0 top-1/2 border-b border-dashed border-stone-100 text-[10px] text-stone-300 font-mono pl-1">
              Mid: {Math.round(maxVotes / 2).toLocaleString()}
            </div>

            {trends.map((row, idx) => {
              const heightPercent = Math.max(4, Math.round((Number(row.total_votes) / maxVotes) * 100));
              const isHovered = hoveredIndex === idx;

              return (
                <div
                  key={row.day}
                  onMouseEnter={() => setHoveredIndex(idx)}
                  onMouseLeave={() => setHoveredIndex(null)}
                  className="group relative flex-1 h-full flex flex-col justify-end items-center cursor-pointer"
                >
                  <div
                    style={{ height: `${heightPercent}%` }}
                    className={`w-full rounded-t-md transition-all duration-200 ${
                      isHovered
                        ? "bg-emerald-600 ring-2 ring-emerald-500/30 scale-x-105"
                        : "bg-emerald-800/85 hover:bg-emerald-700"
                    }`}
                  />
                </div>
              );
            })}
          </div>

          {/* X-Axis Date Labels */}
          <div className="mt-2 flex items-center justify-between text-[11px] font-mono text-stone-400">
            <span>{trends[0]?.day}</span>
            <span className="hidden sm:inline">{trends[Math.floor(trends.length / 2)]?.day}</span>
            <span>{trends.at(-1)?.day}</span>
          </div>
        </div>
      )}

      {/* Raw Table Collapsible */}
      <details className="group pt-2 border-t border-stone-100">
        <summary className="flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-stone-700 hover:text-emerald-900 select-none">
          <span>View Daily Vote Data Table</span>
          <span className="text-[10px] text-stone-400 group-open:rotate-180 transition-transform">▼</span>
        </summary>
        <div className="mt-3 max-h-56 overflow-auto rounded-xl border border-stone-200">
          <table className="w-full text-left text-xs">
            <thead className="bg-stone-50 text-stone-500 font-semibold border-b border-stone-200">
              <tr>
                <th className="px-4 py-2.5">Date</th>
                <th className="px-4 py-2.5">Counted Votes</th>
                <th className="px-4 py-2.5">Paid Ballots</th>
                <th className="px-4 py-2.5">Free Ballots</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {trends.map((row) => (
                <tr key={row.day} className="hover:bg-stone-50/50">
                  <td className="px-4 py-2 font-mono text-stone-700">{row.day}</td>
                  <td className="px-4 py-2 font-semibold text-stone-900">
                    {Number(row.total_votes).toLocaleString()}
                  </td>
                  <td className="px-4 py-2 text-stone-600 font-mono">
                    {Number(row.paid_votes).toLocaleString()}
                  </td>
                  <td className="px-4 py-2 text-stone-600 font-mono">
                    {Number(row.free_votes).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
