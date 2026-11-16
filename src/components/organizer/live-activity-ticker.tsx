"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import type { CategoryAnalytics, NomineeAnalytics } from "@/lib/analytics";

type RankedNominee = NomineeAnalytics & { rank: number };

export function LiveActivityTicker({
  eventName,
  categories,
  standings,
  votesToday,
  totalVotes,
}: {
  eventName: string;
  categories: CategoryAnalytics[];
  standings: RankedNominee[];
  votesToday: number;
  totalVotes: number;
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  // Generate pulse messages based on actual race standing
  const topNominees = standings.filter((n) => Number(n.total_votes) > 0).slice(0, 6);

  const activities: Array<{ id: string; icon: string; text: string; subtext: string; channel?: "wa" | "tg" | "momo" }> = [];

  // Add real summary item
  if (totalVotes > 0) {
    activities.push({
      id: "summary",
      icon: "⚡",
      text: `${totalVotes.toLocaleString()} ballots recorded for ${eventName}`,
      subtext: `${votesToday.toLocaleString()} cast today`,
      channel: "momo",
    });
  }

  // Add category leaders
  categories.slice(0, 3).forEach((cat) => {
    const leader = standings.find((s) => s.category_id === cat.category_id && s.rank === 1);
    const chaser = standings.find((s) => s.category_id === cat.category_id && s.rank === 2);
    if (leader && Number(leader.total_votes) > 0) {
      if (chaser && Number(leader.total_votes) - Number(chaser.total_votes) <= 20) {
        activities.push({
          id: `tight-${cat.category_id}`,
          icon: "🔥",
          text: `Tight race in ${cat.category_name}: ${leader.nominee_name} vs ${chaser.nominee_name}`,
          subtext: `Only ${Number(leader.total_votes) - Number(chaser.total_votes)} votes margin`,
        });
      } else {
        activities.push({
          id: `lead-${cat.category_id}`,
          icon: "🥇",
          text: `${leader.nominee_name} leads ${cat.category_name}`,
          subtext: `${Number(leader.total_votes).toLocaleString()} votes confirmed`,
        });
      }
    }
  });

  // Add bot channel messages
  activities.push({
    id: "bot-wa",
    icon: "🟢",
    text: "WhatsApp Bot voting active (+233 59 299 2566)",
    subtext: "MTN MoMo & Telecel Cash integration live",
    channel: "wa",
  });

  activities.push({
    id: "bot-tg",
    icon: "🔵",
    text: "Telegram Bot voting active (@VotecastHubGH_bot)",
    subtext: "Interactive candidate cards live",
    channel: "tg",
  });

  useEffect(() => {
    if (isPaused || activities.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % activities.length);
    }, 4500);
    return () => clearInterval(timer);
  }, [isPaused, activities.length]);

  if (!activities.length) return null;

  const current = activities[currentIndex] ?? activities[0];

  return (
    <div
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      className="relative flex items-center justify-between overflow-hidden rounded-2xl border border-emerald-200/80 bg-linear-to-r from-emerald-50/90 via-white to-sky-50/50 px-4 py-2.5 shadow-2xs"
    >
      <div className="flex items-center gap-3 overflow-hidden">
        {/* Pulsing Live badge */}
        <div className="flex items-center gap-1.5 shrink-0 rounded-full bg-emerald-100 border border-emerald-200 px-2.5 py-1 text-[10px] font-black text-emerald-950 uppercase tracking-wider">
          <span className="size-1.5 rounded-full bg-emerald-600 animate-ping" />
          <span>LIVE PULSE</span>
        </div>

        {/* Animated Ticker Content */}
        <div className="h-6 flex items-center overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={current.id}
              initial={{ y: 12, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -12, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="flex items-center gap-2 text-xs truncate"
            >
              <span className="text-sm shrink-0">{current.icon}</span>
              <strong className="text-stone-900 font-semibold truncate">{current.text}</strong>
              <span className="text-stone-400 hidden sm:inline">·</span>
              <span className="text-stone-500 text-[11px] hidden sm:inline truncate">{current.subtext}</span>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Progress Dots */}
      <div className="hidden md:flex items-center gap-1 shrink-0">
        {activities.map((item, idx) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setCurrentIndex(idx)}
            className={`size-1.5 rounded-full transition-all cursor-pointer ${
              idx === currentIndex ? "w-3 bg-emerald-700" : "bg-stone-300 hover:bg-stone-400"
            }`}
            aria-label={`Jump to ticker update ${idx + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
