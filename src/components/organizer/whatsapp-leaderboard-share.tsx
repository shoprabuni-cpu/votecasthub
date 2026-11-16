"use client";

import { useState, useId, useEffect } from "react";
import Image from "next/image";
import type { CategoryAnalytics, NomineeAnalytics } from "@/lib/analytics";

type RankedNominee = NomineeAnalytics & { rank: number };

const MEDALS: Record<number, string> = {
  1: "🥇",
  2: "🥈",
  3: "🥉",
};

export function WhatsAppLeaderboardShare({
  eventName,
  eventSlug,
  categories,
  standings,
  ended = false,
}: {
  eventName: string;
  eventSlug: string;
  categories: CategoryAnalytics[];
  standings: RankedNominee[];
  ended?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [selectedCatId, setSelectedCatId] = useState<string | "all">("all");
  const [copied, setCopied] = useState(false);
  const dialogId = useId();

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  // Generate formatted WhatsApp message text
  const timestamp = new Intl.DateTimeFormat("en-GH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Accra",
  }).format(new Date());

  const origin = typeof window !== "undefined" ? window.location.origin : "https://votecasthub.com";
  const webLink = `${origin}/events/${eventSlug}`;

  const relevantCategories =
    selectedCatId === "all"
      ? categories
      : categories.filter((c) => c.category_id === selectedCatId);

  let messageLines: string[] = [];
  messageLines.push(`🏆 *${eventName.toUpperCase()}* 🏆`);
  messageLines.push(ended ? `🏁 *Official Final Results*` : `⚡ *Live Standings Update*`);
  messageLines.push(`📅 As of: ${timestamp} GMT`);
  messageLines.push("");

  for (const cat of relevantCategories) {
    const catNominees = standings
      .filter((n) => n.category_id === cat.category_id)
      .sort((a, b) => Number(b.total_votes) - Number(a.total_votes));

    messageLines.push(`🎖️ *${cat.category_name}*`);
    if (catNominees.length === 0 || Number(catNominees[0]?.total_votes || 0) === 0) {
      messageLines.push(`   _No votes recorded yet_`);
    } else {
      catNominees.slice(0, 5).forEach((nominee, idx) => {
        const medal = MEDALS[idx + 1] || `${idx + 1}.`;
        const votes = Number(nominee.total_votes).toLocaleString();
        messageLines.push(`${medal} *${nominee.nominee_name}* — ${votes} votes`);
      });
    }
    messageLines.push("");
  }

  if (!ended) {
    messageLines.push(`🗳️ *Cast Your Vote Now:*`);
    messageLines.push(`👉 WhatsApp: Send VOTE to *+233 59 299 2566*`);
    messageLines.push(`👉 Telegram: *@VotecastHubGH_bot*`);
    messageLines.push(`👉 Web Ballot: ${webLink}`);
    messageLines.push("");
  }

  messageLines.push(`📊 Powered by *VoteCastHub GH* 🇬🇭`);

  const shareText = messageLines.join("\n");
  const waShareUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      // fallback
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-xl bg-emerald-800 hover:bg-emerald-700 text-white px-3.5 py-2 text-xs font-bold shadow-xs transition-all active:scale-95 cursor-pointer"
        title="Share formatted leaderboard standings directly to WhatsApp"
      >
        <Image
          src="/images/whatsapp-logo.jpg"
          alt=""
          width={16}
          height={16}
          className="rounded-full"
        />
        <span>Share Standings to WhatsApp</span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={`${dialogId}-title`}
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-stone-950/75 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setOpen(false)}
        >
          <div
            className="relative flex flex-col w-full max-w-lg max-h-[90vh] rounded-3xl bg-white border border-stone-200 p-5 sm:p-6 shadow-2xl animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-stone-100">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-2xl bg-green-50 p-1.5 border border-green-200 shadow-2xs">
                  <Image
                    src="/images/whatsapp-logo.jpg"
                    alt="WhatsApp"
                    width={32}
                    height={32}
                    className="rounded-xl object-contain"
                  />
                </div>
                <div>
                  <h3 id={`${dialogId}-title`} className="font-bold text-stone-900 text-base">
                    Share Standings to WhatsApp
                  </h3>
                  <p className="text-xs text-stone-500">
                    Send real-time race updates to your committee, contestants, or WhatsApp status.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="rounded-full bg-stone-100 hover:bg-stone-200 p-1.5 text-stone-500 hover:text-stone-800 text-xs font-bold transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Filter by Category */}
            <div className="mt-3 flex items-center gap-2 overflow-x-auto pb-1 text-xs">
              <span className="font-semibold text-stone-500 shrink-0">Include:</span>
              <button
                type="button"
                onClick={() => setSelectedCatId("all")}
                className={`rounded-lg px-2.5 py-1 font-semibold transition-colors cursor-pointer shrink-0 ${
                  selectedCatId === "all"
                    ? "bg-emerald-900 text-white"
                    : "bg-stone-100 text-stone-700 hover:bg-stone-200"
                }`}
              >
                All Categories
              </button>
              {categories.map((c) => (
                <button
                  key={c.category_id}
                  type="button"
                  onClick={() => setSelectedCatId(c.category_id)}
                  className={`rounded-lg px-2.5 py-1 font-semibold transition-colors cursor-pointer shrink-0 max-w-[140px] truncate ${
                    selectedCatId === c.category_id
                      ? "bg-emerald-900 text-white"
                      : "bg-stone-100 text-stone-700 hover:bg-stone-200"
                  }`}
                >
                  {c.category_name}
                </button>
              ))}
            </div>

            {/* Live Message Preview (WhatsApp Styled Bubble) */}
            <div className="mt-3 flex-1 overflow-y-auto rounded-2xl border border-stone-200 bg-[#efeae2] p-4 text-xs font-sans text-stone-900 leading-relaxed shadow-inner">
              <div className="rounded-xl bg-white p-3 shadow-xs space-y-1 font-mono text-[11px] whitespace-pre-wrap select-all">
                {shareText}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="mt-4 pt-3 border-t border-stone-100 flex flex-wrap items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-stone-300 bg-white px-4 py-2 text-xs font-bold text-stone-700 hover:bg-stone-50 transition-all cursor-pointer"
              >
                <span>{copied ? "✓ Copied to Clipboard!" : "📋 Copy Message Text"}</span>
              </button>

              <a
                href={waShareUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-emerald-800 px-5 py-2 text-xs font-bold text-white hover:bg-emerald-700 shadow-xs transition-all active:scale-95 cursor-pointer"
              >
                <Image
                  src="/images/whatsapp-logo.jpg"
                  alt=""
                  width={16}
                  height={16}
                  className="rounded-full"
                />
                <span>Open in WhatsApp</span> ↗
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
