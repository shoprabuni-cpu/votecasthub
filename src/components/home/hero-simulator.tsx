"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Icon } from "@/components/icon";

interface Step {
  id: number;
  label: string;
  badge: string;
  title: string;
  detail: string;
  highlight: string;
  icon: "vote" | "shield" | "check";
  preview: {
    tag: string;
    headline: string;
    sub: string;
    pill: string;
  };
}

const steps: Step[] = [
  {
    id: 1,
    label: "01",
    badge: "SELECT & DISCOVER",
    title: "Voter Selects Nominee",
    detail: "Voters find their category, inspect verified nominee profiles, and choose their vote quantity.",
    highlight: "Nominee #4 · Best New Artist",
    icon: "vote",
    preview: {
      tag: "CATEGORY: BEST VOCALIST",
      headline: "Ama Konadu · Nominee #04",
      sub: "Voting window ends Saturday at 11:59 PM GMT",
      pill: "GHS 1.00 / Vote",
    },
  },
  {
    id: 2,
    label: "02",
    badge: "PHONE VERIFIED",
    title: "Server Enforces Limits",
    detail: "Voter confirms via mobile money or SMS OTP. Rules and quota limits are enforced before any vote enters the ledger.",
    highlight: "+233 (0)24 ••• ••89 · MTN MoMo",
    icon: "shield",
    preview: {
      tag: "FRAUD DEFENSE ACTIVE",
      headline: "Prompt sent to 024 ••• 89",
      sub: "1-Vote-Per-Phone or Paid MoMo quota checked on server",
      pill: "Instant OTP / MoMo",
    },
  },
  {
    id: 3,
    label: "03",
    badge: "CRYPTOGRAPHIC SEAL",
    title: "Vote Timestamped & Counted",
    detail: "The transaction is sealed, an immutable audit receipt is issued, and live tallies update transparently.",
    highlight: "Audit Receipt #VCH-2026-GH912",
    icon: "check",
    preview: {
      tag: "TAMPER-PROOF LEDGER",
      headline: "Vote Confirmed & Counted ✓",
      sub: "Receipt hash: gh_vch_8f92c10b • Server verified",
      pill: "Audited Ledger",
    },
  },
];

export function HeroSimulator() {
  const [activeStep, setActiveStep] = useState(0);
  const [isInteracting, setIsInteracting] = useState(false);

  useEffect(() => {
    if (isInteracting) return;
    const interval = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % steps.length);
    }, 4500);
    return () => clearInterval(interval);
  }, [isInteracting]);

  const current = steps[activeStep];

  return (
    <div
      className="relative w-full max-w-lg mx-auto"
      onMouseEnter={() => setIsInteracting(true)}
      onMouseLeave={() => setIsInteracting(false)}
      onTouchStart={() => setIsInteracting(true)}
    >
      {/* Ambient background glow */}
      <div className="absolute -inset-4 bg-gradient-to-tr from-emerald-500/10 via-emerald-600/5 to-amber-500/10 rounded-3xl blur-2xl pointer-events-none" />

      {/* Main interactive phone-card frame */}
      <div className="relative rounded-2xl bg-white/95 backdrop-blur-xl border border-emerald-950/10 shadow-[0_20px_50px_-12px_rgba(15,35,25,0.12)] p-5 sm:p-7 overflow-hidden">
        {/* Top header bar */}
        <div className="flex items-center justify-between pb-4 border-b border-emerald-950/6">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
            </span>
            <span className="text-[11px] font-bold tracking-wider text-emerald-900 uppercase">
              Live Verification Engine
            </span>
          </div>
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-900/10">
            Step {activeStep + 1} of 3
          </span>
        </div>

        {/* Dynamic preview card */}
        <div className="my-5 min-h-[148px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={current.id}
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -12, scale: 0.98 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="rounded-xl p-4 bg-gradient-to-br from-emerald-950 to-emerald-900 text-white shadow-inner relative overflow-hidden"
            >
              {/* Subtle decorative glow */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

              <div className="flex items-center justify-between mb-2">
                <span className="text-[9px] font-bold tracking-widest text-emerald-300 uppercase">
                  {current.preview.tag}
                </span>
                <span className="px-2 py-0.5 text-[10px] font-semibold bg-emerald-800/80 text-emerald-100 rounded-md border border-emerald-700/50">
                  {current.preview.pill}
                </span>
              </div>

              <h4 className="text-base sm:text-lg font-semibold tracking-tight text-white mb-1">
                {current.preview.headline}
              </h4>
              <p className="text-xs text-emerald-200/80 leading-relaxed">
                {current.preview.sub}
              </p>

              <div className="mt-3.5 pt-3 border-t border-emerald-800/60 flex items-center justify-between text-[11px]">
                <span className="text-emerald-300/80 flex items-center gap-1.5 font-mono text-[10px]">
                  <Icon name={current.icon} size={13} className="text-emerald-300" />
                  {current.highlight}
                </span>
                <span className="text-[10px] font-medium text-emerald-400">Server Validated</span>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Step navigation selectors */}
        <div className="space-y-2">
          {steps.map((s, idx) => {
            const isCurrent = idx === activeStep;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  setActiveStep(idx);
                  setIsInteracting(true);
                }}
                className={`w-full text-left p-3 rounded-xl transition-all duration-200 flex items-start gap-3.5 ${
                  isCurrent
                    ? "bg-emerald-50/90 border border-emerald-600/30 shadow-sm"
                    : "hover:bg-slate-50 border border-transparent opacity-80 hover:opacity-100"
                }`}
              >
                <div
                  className={`flex-none w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                    isCurrent
                      ? "bg-emerald-700 text-white shadow-sm"
                      : "bg-emerald-100/70 text-emerald-800"
                  }`}
                >
                  {isCurrent ? "✓" : s.label}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <p
                      className={`text-xs font-semibold tracking-tight ${
                        isCurrent ? "text-slate-950 font-bold" : "text-slate-700"
                      }`}
                    >
                      {s.title}
                    </p>
                    {isCurrent && (
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                        Active
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 leading-snug mt-0.5 line-clamp-1">
                    {s.detail}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Micro-footer indicator */}
        <div className="mt-4 pt-3.5 border-t border-emerald-950/6 flex items-center justify-between text-[11px] text-slate-500">
          <span className="flex items-center gap-1.5 font-medium text-slate-600">
            <Icon name="shield" size={14} className="text-emerald-700" />
            Guaranteed 100% Ghanaian vote integrity
          </span>
          <span className="text-[10px] text-slate-400">Interactive demo</span>
        </div>
      </div>
    </div>
  );
}
