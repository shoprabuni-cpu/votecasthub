"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Icon } from "@/components/icon";

interface FeatureCard {
  icon: "bolt" | "shield" | "wallet" | "chart" | "users" | "check";
  title: string;
  description: string;
  highlight: string;
}

const voterFeatures: FeatureCard[] = [
  {
    icon: "wallet",
    title: "Direct Mobile Money",
    description: "Support your favorite nominee instantly using MTN MoMo, Telecel Cash, or AT Money with standard prompt popups.",
    highlight: "Zero complicated sign-up forms",
  },
  {
    icon: "shield",
    title: "1-Vote-Per-Phone Safeguard",
    description: "For free awards, verified SMS OTP prevents bots and repetitive click farms from skewing the true public opinion.",
    highlight: "Clean, verified public count",
  },
  {
    icon: "check",
    title: "Auditable Digital Receipt",
    description: "Every confirmed vote produces a unique timestamped receipt code so you know your vote is securely logged in the database.",
    highlight: "Instant cryptographic proof",
  },
];

const organizerFeatures: FeatureCard[] = [
  {
    icon: "chart",
    title: "Live Audit & Results Control",
    description: "Watch verified tallies roll in, pause or close categories on schedule, and export full CSV logs for committee review.",
    highlight: "Live fraud detection built-in",
  },
  {
    icon: "wallet",
    title: "Automatic MoMo Settlements",
    description: "Link your verified Ghanaian bank or mobile money wallet via Paystack for fast, hassle-free next-day settlements.",
    highlight: "Clear transparent fees",
  },
  {
    icon: "users",
    title: "Collaborative Team Seats",
    description: "Invite awards committee members and audit supervisors with granular role permissions (Owner, Editor, Auditor).",
    highlight: "Multi-admin governance",
  },
];

export function SolutionsTabs() {
  const [activeTab, setActiveTab] = useState<"voters" | "organizers">("voters");

  const currentFeatures = activeTab === "voters" ? voterFeatures : organizerFeatures;

  return (
    <section id="solutions" className="py-16 sm:py-24 bg-slate-50/70 border-y border-slate-200/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto mb-12">
          <span className="text-xs font-bold tracking-widest text-emerald-800 uppercase">
            ENGINEERED FOR TRANSPARENCY
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 mt-2 mb-4">
            Designed for voters. Built for organizers.
          </h2>
          <p className="text-slate-600 text-sm sm:text-base leading-relaxed">
            Whether you are voting for your favorite artist or running a nationwide beauty pageant, VotecastHub provides a smooth, dependable experience.
          </p>

          {/* Tab Selector */}
          <div className="inline-flex items-center p-1.5 rounded-2xl bg-white border border-slate-200 shadow-sm mt-8">
            <button
              type="button"
              onClick={() => setActiveTab("voters")}
              className={`relative px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-colors ${
                activeTab === "voters" ? "text-emerald-950" : "text-slate-500 hover:text-slate-900"
              }`}
            >
              {activeTab === "voters" && (
                <motion.div
                  layoutId="tabPill"
                  className="absolute inset-0 bg-emerald-100/80 rounded-xl"
                  transition={{ type: "spring", bounce: 0.15, duration: 0.4 }}
                />
              )}
              <span className="relative z-10 flex items-center gap-2">
                <Icon name="vote" size={16} className="text-emerald-700" />
                For Voters
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("organizers")}
              className={`relative px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-colors ${
                activeTab === "organizers" ? "text-emerald-950" : "text-slate-500 hover:text-slate-900"
              }`}
            >
              {activeTab === "organizers" && (
                <motion.div
                  layoutId="tabPill"
                  className="absolute inset-0 bg-emerald-100/80 rounded-xl"
                  transition={{ type: "spring", bounce: 0.15, duration: 0.4 }}
                />
              )}
              <span className="relative z-10 flex items-center gap-2">
                <Icon name="trophy" size={16} className="text-emerald-700" />
                For Organizers
              </span>
            </button>
          </div>
        </div>

        {/* Feature Cards Grid */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -14 }}
            transition={{ duration: 0.3 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8"
          >
            {currentFeatures.map((item, index) => (
              <div
                key={index}
                className="group p-6 sm:p-8 rounded-2xl bg-white border border-slate-200/90 shadow-sm hover:shadow-md hover:border-emerald-300 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-800 flex items-center justify-center mb-6 group-hover:scale-110 group-hover:bg-emerald-800 group-hover:text-white transition-all shadow-xs">
                    <Icon name={item.icon} size={22} />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 mb-2">{item.title}</h3>
                  <p className="text-slate-600 text-sm leading-relaxed mb-6">
                    {item.description}
                  </p>
                </div>

                <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-emerald-800">
                  <span>{item.highlight}</span>
                  <span className="text-slate-400 group-hover:translate-x-1 transition-transform">
                    →
                  </span>
                </div>
              </div>
            ))}
          </motion.div>
        </AnimatePresence>

        {/* Bottom Call to Action strip */}
        <div className="mt-12 text-center">
          {activeTab === "voters" ? (
            <Link
              href="/events"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-800 text-white font-semibold text-sm hover:bg-emerald-900 active:scale-95 transition-all shadow-sm"
            >
              <span>Explore Open Contests</span>
              <Icon name="arrowUpRight" size={16} />
            </Link>
          ) : (
            <Link
              href="/sign-up"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-800 text-white font-semibold text-sm hover:bg-emerald-900 active:scale-95 transition-all shadow-sm"
            >
              <span>Create Your Organization Workspace</span>
              <Icon name="arrowUpRight" size={16} />
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
