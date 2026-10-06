"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Icon } from "@/components/icon";
import { HeroSimulator } from "./hero-simulator";

export function HeroSection() {
  return (
    <section className="relative overflow-hidden pt-8 pb-16 sm:pt-14 sm:pb-24 lg:pt-20 lg:pb-32">
      {/* Subtle background ambient gradients */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[500px] pointer-events-none overflow-hidden -z-10">
        <div className="absolute top-[-120px] left-1/4 w-[500px] h-[500px] bg-emerald-100/50 rounded-full blur-3xl opacity-60" />
        <div className="absolute top-[-80px] right-1/4 w-[420px] h-[420px] bg-amber-100/40 rounded-full blur-3xl opacity-50" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          {/* Left Column: Hero Text */}
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="lg:col-span-7 max-w-2xl text-left"
          >
            {/* Pill Eyebrow */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-900/10 text-emerald-900 text-xs font-semibold tracking-wide mb-6">
              <span className="flex h-2 w-2 rounded-full bg-emerald-500" />
              <span>GHANA AWARDS & COMPETITION VOTING</span>
            </div>

            {/* Main Headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-900 leading-[1.08] mb-6">
              Good events deserve a{" "}
              <span className="text-emerald-800 underline decoration-amber-400 decoration-wavy decoration-2 underline-offset-8">
                fair, transparent vote.
              </span>
            </h1>

            {/* Subtitle */}
            <p className="text-base sm:text-lg text-slate-600 leading-relaxed mb-8 max-w-xl">
              Eliminate vote rigging and phantom counts. VotecastHub provides Ghanaian award organizers and pageant producers with verified mobile money voting, instant phone verification, and a tamper-proof audit trail.
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3.5 mb-10">
              <Link
                href="/events"
                className="inline-flex items-center justify-center gap-3 px-6 py-3.5 rounded-xl bg-emerald-800 text-white font-semibold text-sm shadow-[0_10px_25px_-5px_rgba(20,90,55,0.35)] hover:bg-emerald-900 active:scale-[0.98] transition-all"
              >
                <span>Explore Live Events</span>
                <Icon name="arrowUpRight" size={16} />
              </Link>
              <Link
                href="/sign-up"
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-white border border-slate-300 text-slate-800 font-semibold text-sm hover:bg-slate-50 active:scale-[0.98] transition-all"
              >
                <span>Host Your Award Show</span>
              </Link>
            </div>

            {/* Trust Micro-Metrics */}
            <div className="pt-6 border-t border-slate-200/80 flex flex-wrap items-center gap-y-3 gap-x-6 text-xs text-slate-500 font-medium">
              <span className="flex items-center gap-1.5 text-slate-700">
                <Icon name="check" size={14} className="text-emerald-600" />
                MTN MoMo & Telecel Cash ready
              </span>
              <span className="flex items-center gap-1.5 text-slate-700">
                <Icon name="check" size={14} className="text-emerald-600" />
                Anti-bot phone verification
              </span>
              <span className="flex items-center gap-1.5 text-slate-700">
                <Icon name="check" size={14} className="text-emerald-600" />
                Instant organizer payouts
              </span>
            </div>
          </motion.div>

          {/* Right Column: Interactive Simulator */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className="lg:col-span-5 w-full"
          >
            <HeroSimulator />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
