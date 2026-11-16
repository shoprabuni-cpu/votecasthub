"use client";

import { useState, useEffect, useId } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import type { CategoryAnalytics, NomineeAnalytics } from "@/lib/analytics";

type RankedNominee = NomineeAnalytics & { rank: number };

const MEDALS = {
  1: { emoji: "🥇", label: "1ST PLACE", border: "border-amber-400/80", glow: "shadow-amber-500/20", bg: "from-amber-950/40 via-stone-900 to-stone-950", text: "text-amber-300" },
  2: { emoji: "🥈", label: "2ND PLACE", border: "border-stone-300/60", glow: "shadow-stone-400/10", bg: "from-stone-800/40 via-stone-900 to-stone-950", text: "text-stone-300" },
  3: { emoji: "🥉", label: "3RD PLACE", border: "border-orange-500/60", glow: "shadow-orange-500/10", bg: "from-orange-950/30 via-stone-900 to-stone-950", text: "text-orange-300" },
};

export function StageProjectorMode({
  eventName,
  eventSlug,
  categories,
  standings,
  ended,
}: {
  eventName: string;
  eventSlug: string;
  categories: CategoryAnalytics[];
  standings: RankedNominee[];
  ended: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [activeCatIndex, setActiveCatIndex] = useState(0);
  const [revealed, setRevealed] = useState(ended);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [time, setTime] = useState("");

  const activeCategory = categories[activeCatIndex] ?? categories[0];

  // Update clock every second
  useEffect(() => {
    if (!open) return;
    const updateTime = () => {
      setTime(
        new Intl.DateTimeFormat("en-GH", {
          hour: "numeric",
          minute: "numeric",
          second: "numeric",
          hour12: true,
          timeZone: "Africa/Accra",
        }).format(new Date())
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [open]);

  // Handle escape key
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
      if (e.key === "ArrowRight") {
        setActiveCatIndex((prev) => (prev + 1) % categories.length);
        setRevealed(ended);
      }
      if (e.key === "ArrowLeft") {
        setActiveCatIndex((prev) => (prev - 1 + categories.length) % categories.length);
        setRevealed(ended);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, categories.length, ended]);

  if (!categories.length) return null;

  const currentNominees = standings
    .filter((n) => n.category_id === activeCategory.category_id)
    .sort((a, b) => Number(b.total_votes) - Number(a.total_votes));

  const totalCatVotes = Number(activeCategory.total_votes) || 0;

  function handleTriggerReveal() {
    setCountdown(3);
    const t3 = setTimeout(() => setCountdown(2), 1000);
    const t2 = setTimeout(() => setCountdown(1), 2000);
    const t1 = setTimeout(() => {
      setCountdown(null);
      setRevealed(true);
    }, 3000);
    return () => {
      clearTimeout(t3);
      clearTimeout(t2);
      clearTimeout(t1);
    };
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setRevealed(ended);
        }}
        className="inline-flex items-center gap-2 rounded-xl border border-stone-800 bg-stone-900 px-3.5 py-2 text-xs font-bold text-amber-300 hover:bg-stone-800 shadow-sm transition-all active:scale-95 cursor-pointer"
        title="Open full-screen presentation mode for auditorium projectors and stage screens"
      >
        <span className="text-sm">🖥️</span>
        <span>Stage / Projector Mode</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex flex-col bg-[#070b0a] text-white select-none overflow-y-auto"
          >
            {/* Top Bar for Stage Screen */}
            <header className="flex flex-wrap items-center justify-between gap-4 border-b border-stone-800/80 bg-stone-950/90 px-6 py-4 backdrop-blur-md">
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center gap-2 rounded-full bg-red-950/80 border border-red-500/40 px-3 py-1 text-xs font-bold text-red-400">
                  <span className="size-2 rounded-full bg-red-500 animate-ping" />
                  LIVE STAGE BROADCAST
                </span>
                <div>
                  <h1 className="text-lg sm:text-xl font-serif font-black tracking-tight text-white">
                    {eventName}
                  </h1>
                  <p className="text-xs text-stone-400">Official Auditorium &amp; LED Projection</p>
                </div>
              </div>

              {/* Center Category Controls */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setActiveCatIndex((prev) => (prev - 1 + categories.length) % categories.length);
                    setRevealed(ended);
                  }}
                  className="rounded-lg bg-stone-900 border border-stone-800 px-3 py-1.5 text-xs font-bold text-stone-300 hover:text-white cursor-pointer"
                >
                  ← Prev
                </button>
                <span className="text-xs font-bold text-amber-300 px-2 font-mono">
                  {activeCatIndex + 1} / {categories.length}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setActiveCatIndex((prev) => (prev + 1) % categories.length);
                    setRevealed(ended);
                  }}
                  className="rounded-lg bg-stone-900 border border-stone-800 px-3 py-1.5 text-xs font-bold text-stone-300 hover:text-white cursor-pointer"
                >
                  Next →
                </button>
              </div>

              {/* Right Side: Clock & Exit */}
              <div className="flex items-center gap-4">
                <div className="text-right font-mono text-xs text-stone-400 hidden sm:block">
                  <span className="block text-emerald-400 font-bold">{time}</span>
                  <span>Accra GMT</span>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-xl border border-stone-700 bg-stone-900 px-3.5 py-1.5 text-xs font-bold text-stone-200 hover:bg-stone-800 hover:text-white cursor-pointer"
                >
                  ✕ Exit (Esc)
                </button>
              </div>
            </header>

            {/* Category Subheader */}
            <div className="border-b border-stone-900 bg-stone-950/60 px-6 py-4 text-center">
              <span className="text-[11px] font-bold uppercase tracking-widest text-emerald-400">
                AWARD CATEGORY
              </span>
              <h2 className="mt-1 text-2xl sm:text-4xl font-serif font-extrabold text-amber-100">
                {activeCategory.category_name}
              </h2>
              <p className="mt-1 text-xs text-stone-400 font-mono">
                {totalCatVotes.toLocaleString()} Total Ballots Counted
              </p>
            </div>

            {/* Main Stage Podium Area */}
            <main className="flex-1 p-6 sm:p-10 flex flex-col justify-center max-w-6xl mx-auto w-full">
              {/* Suspense Countdown Overlay */}
              {countdown !== null && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md">
                  <motion.div
                    key={countdown}
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1.2, opacity: 1 }}
                    exit={{ scale: 2, opacity: 0 }}
                    className="text-center"
                  >
                    <span className="font-serif font-black text-8xl sm:text-9xl text-amber-300 drop-shadow-[0_0_50px_rgba(251,191,36,0.6)]">
                      {countdown}
                    </span>
                    <p className="mt-4 text-xl font-bold tracking-widest text-emerald-400 uppercase">
                      Revealing Official Winner...
                    </p>
                  </motion.div>
                </div>
              )}

              {/* Reveal Toggle for MC / Stage Manager */}
              {!revealed && (
                <div className="mb-8 text-center">
                  <button
                    type="button"
                    onClick={handleTriggerReveal}
                    className="inline-flex items-center gap-3 rounded-2xl bg-linear-to-r from-amber-500 via-amber-400 to-amber-600 px-8 py-4 text-base font-black text-stone-950 shadow-2xl hover:brightness-110 active:scale-95 transition-all cursor-pointer"
                  >
                    <span className="text-xl">🏆</span>
                    <span>DRAMATIC WINNER REVEAL (3-SEC COUNTDOWN)</span>
                  </button>
                  <p className="mt-2 text-xs text-stone-500">
                    Keep winner hidden from the audience until the host announces.
                  </p>
                </div>
              )}

              {/* Podium Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
                {/* 2nd Place (Silver) */}
                {currentNominees[1] && (
                  <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.1 }}
                    className={`relative rounded-3xl border ${MEDALS[2].border} bg-linear-to-b ${MEDALS[2].bg} p-6 text-center shadow-xl md:order-1`}
                  >
                    <span className="text-4xl">{MEDALS[2].emoji}</span>
                    <span className="mt-2 block text-xs font-bold text-stone-400 tracking-wider">
                      {MEDALS[2].label}
                    </span>
                    <h3 className="mt-2 text-xl font-bold text-white leading-tight">
                      {currentNominees[1].nominee_name}
                    </h3>
                    <div className="mt-4 rounded-2xl bg-stone-900/90 border border-stone-800 p-3">
                      <span className="font-mono text-2xl font-black text-stone-200">
                        {revealed ? Number(currentNominees[1].total_votes).toLocaleString() : "•••"}
                      </span>
                      <span className="block text-[10px] text-stone-400 uppercase">Votes Cast</span>
                    </div>
                  </motion.div>
                )}

                {/* 1st Place (Gold) - Raised & Prominent */}
                {currentNominees[0] && (
                  <motion.div
                    initial={{ y: 30, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className={`relative rounded-3xl border-2 ${MEDALS[1].border} bg-linear-to-b ${MEDALS[1].bg} p-8 text-center shadow-2xl ring-2 ring-amber-400/30 md:order-2 md:-translate-y-4`}
                  >
                    <span className="text-6xl">{MEDALS[1].emoji}</span>
                    <span className="mt-3 block text-xs font-black text-amber-400 tracking-widest uppercase">
                      {ended ? "OFFICIAL WINNER" : "CURRENT RACE LEADER"}
                    </span>
                    <h3 className="mt-2 text-2xl sm:text-3xl font-serif font-black text-white leading-tight">
                      {revealed ? currentNominees[0].nominee_name : "Mystery Leader 🔒"}
                    </h3>
                    <div className="mt-5 rounded-2xl bg-amber-950/60 border border-amber-500/40 p-4">
                      <span className="font-mono text-3xl sm:text-4xl font-black text-amber-300">
                        {revealed ? Number(currentNominees[0].total_votes).toLocaleString() : "••••"}
                      </span>
                      <span className="block text-xs font-bold text-amber-400/80 uppercase tracking-wider">
                        {revealed ? "Certified Ballots" : "Ballots Hidden"}
                      </span>
                    </div>
                  </motion.div>
                )}

                {/* 3rd Place (Bronze) */}
                {currentNominees[2] && (
                  <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className={`relative rounded-3xl border ${MEDALS[3].border} bg-linear-to-b ${MEDALS[3].bg} p-6 text-center shadow-xl md:order-3`}
                  >
                    <span className="text-4xl">{MEDALS[3].emoji}</span>
                    <span className="mt-2 block text-xs font-bold text-orange-400 tracking-wider">
                      {MEDALS[3].label}
                    </span>
                    <h3 className="mt-2 text-xl font-bold text-white leading-tight">
                      {currentNominees[2].nominee_name}
                    </h3>
                    <div className="mt-4 rounded-2xl bg-stone-900/90 border border-stone-800 p-3">
                      <span className="font-mono text-2xl font-black text-orange-200">
                        {revealed ? Number(currentNominees[2].total_votes).toLocaleString() : "•••"}
                      </span>
                      <span className="block text-[10px] text-stone-400 uppercase">Votes Cast</span>
                    </div>
                  </motion.div>
                )}
              </div>
            </main>

            {/* Stage Footer: Audience Voting Instructions */}
            <footer className="border-t border-stone-800 bg-stone-950/90 px-6 py-4 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="text-xl">📱</span>
                <div>
                  <p className="text-xs font-bold text-white">
                    Audience Voting is Open · Vote from your phone now
                  </p>
                  <p className="text-[11px] text-stone-400">
                    WhatsApp: <strong>+233 59 299 2566</strong> · Telegram: <strong>@VotecastHubGH_bot</strong>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs font-mono text-stone-400">
                <span>VoteCastHub GH 🇬🇭</span>
              </div>
            </footer>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
