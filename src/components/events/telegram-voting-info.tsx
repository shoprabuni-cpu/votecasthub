"use client";

import { useState } from "react";
import Image from "next/image";
import { YouTubeTutorialButton } from "@/components/media/youtube-tutorial";

const TG_BOT_USERNAME = "VotecastHubGH_bot";
const TG_BOT_DISPLAY = "@VotecastHubGH_bot";

function tgVoteLink(eventSlug: string) {
  return `https://t.me/${TG_BOT_USERNAME}?start=event_${eventSlug}`;
}

export function TelegramVotingInfo({
  eventSlug,
  eventName,
  votingMode,
  eventStatus,
}: {
  eventSlug: string;
  eventName: string;
  votingMode: "free" | "paid";
  eventStatus: string;
}) {
  const [copied, setCopied] = useState(false);
  const isPaid = votingMode === "paid";
  const botLink = tgVoteLink(eventSlug);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(botLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  }

  return (
    <section className="rounded-2xl border border-stone-200/90 bg-white p-5 shadow-xs transition-colors dark:border-sky-900/40 dark:bg-[#0c120e] sm:p-6">
      <div className="flex items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-sky-100/70 p-1 dark:bg-sky-950 dark:border dark:border-sky-800/40">
          <Image
            src="/images/telegram-logo.jpg"
            alt="Telegram Logo"
            width={36}
            height={36}
            className="rounded-full object-contain"
          />
        </span>
        <div className="flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base sm:text-lg font-serif font-bold text-stone-900 dark:text-stone-100">Vote by Telegram Bot</h2>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-100 px-2.5 py-0.5 font-mono text-[11px] font-bold text-sky-950 dark:bg-sky-950/80 dark:text-sky-300 dark:border dark:border-sky-850">
              <span className="size-1.5 rounded-full bg-sky-600 animate-pulse dark:bg-sky-400" />
              Active · @{TG_BOT_USERNAME}
            </span>
          </div>
          <p className="mt-1 text-xs sm:text-sm leading-6 text-stone-600 dark:text-stone-400">
            Voters interact with our official bot <strong className="text-stone-900 dark:text-stone-200">{TG_BOT_DISPLAY}</strong> with interactive buttons, photos, and instant Mobile Money payments.
          </p>

          <div className="mt-4 rounded-xl border border-sky-100 bg-sky-50/40 p-3.5 space-y-2 dark:border-sky-900/40 dark:bg-[#080b09]">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-semibold text-stone-700 dark:text-stone-300">1-Tap Direct Telegram Link:</span>
              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex items-center gap-1 font-bold text-sky-800 hover:text-sky-950 cursor-pointer dark:text-sky-400 dark:hover:text-sky-300"
              >
                {copied ? "✓ Copied Link" : "📋 Copy Link"}
              </button>
            </div>
            <code className="block rounded-lg bg-white border border-sky-200 px-3 py-1.5 font-mono text-xs text-sky-950 select-all break-all dark:bg-[#0c120e] dark:border-sky-900/60 dark:text-sky-300">
              {botLink}
            </code>
          </div>

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <div className="rounded-xl bg-stone-50 border border-stone-200 p-3 dark:border-[#1c2721] dark:bg-[#141b16]/50">
              <span className="font-bold text-stone-900 dark:text-stone-200 block">📱 Voter Authentication</span>
              <span className="mt-0.5 block text-[11px] text-stone-500 dark:text-stone-400 leading-snug">
                Free voting uses Telegram's native contact-sharing verification. Uses 0 SMS credits.
              </span>
            </div>
            <div className="rounded-xl bg-stone-50 border border-stone-200 p-3 dark:border-[#1c2721] dark:bg-[#141b16]/50">
              <span className="font-bold text-stone-900 dark:text-stone-200 block">⚡ {isPaid ? "Instant MoMo Checkout" : "Instant Voting"}</span>
              <span className="mt-0.5 block text-[11px] text-stone-500 dark:text-stone-400 leading-snug">
                {isPaid
                  ? "Voters choose packages and pay securely via Paystack inside Telegram."
                  : "Ballots are cast immediately with real-time confirmation."}
              </span>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-sky-100 dark:border-sky-900/30 flex flex-wrap items-center justify-between gap-2">
            <YouTubeTutorialButton
              platform="telegram"
              label="Watch Video Guide (1 min)"
              variant="secondary"
              size="sm"
            />
            <a
              href={botLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-sky-700 px-4 py-2 text-xs font-bold text-white hover:bg-sky-800 shadow-xs transition-all active:scale-95 dark:bg-sky-800 dark:hover:bg-sky-700"
            >
              <span>Open in Telegram</span> ↗
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
