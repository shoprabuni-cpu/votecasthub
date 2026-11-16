"use client";

import { useState, useId, useEffect } from "react";
import Image from "next/image";
import { createFlyer } from "@/lib/events/flyer";

export function NomineeFlyerModal({
  open,
  onClose,
  nomineeName,
  categoryName,
  eventName,
  eventSlug,
  nomineeCode,
  votingMode = "free",
  unitPriceMinor,
}: {
  open: boolean;
  onClose: () => void;
  nomineeName: string;
  categoryName: string;
  eventName: string;
  eventSlug: string;
  nomineeCode?: string | null;
  votingMode?: "free" | "paid";
  unitPriceMinor?: number;
}) {
  const [flyerUrl, setFlyerUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const dialogId = useId();

  const codeDisplay = nomineeCode || "01";
  const siteUrl = typeof window !== "undefined" ? window.location.origin : "https://votecasthub.com";
  const publicNomineeUrl = `${siteUrl}/events/${eventSlug}`;

  const shareText = `🌟 Vote for *${nomineeName}* in *${categoryName}* at *${eventName}*!
👉 On WhatsApp: Message *+233 59 299 2566* with "VOTE ${eventSlug} ${codeDisplay}"
👉 On Telegram: Search *@VotecastHubGH_bot*
👉 On Web: ${publicNomineeUrl}

Powered by VoteCastHub GH 🇬🇭`;

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    async function generate() {
      setLoading(true);
      try {
        const result = await createFlyer(nomineeName, publicNomineeUrl, {
          nominee: nomineeName,
          category: categoryName,
          eventName: eventName,
          code: nomineeCode,
          votingMode: votingMode as "free" | "paid",
          unitPriceMinor: unitPriceMinor,
          eventCode: eventSlug,
        });
        if (!cancelled && result?.blob) {
          const objectUrl = URL.createObjectURL(result.blob);
          setFlyerUrl(objectUrl);
        }
      } catch (err) {
        console.error("Flyer creation error", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    generate();

    return () => {
      cancelled = true;
    };
  }, [open, nomineeName, categoryName, eventName, eventSlug, nomineeCode, votingMode, unitPriceMinor, publicNomineeUrl]);

  async function handleDownload() {
    if (!flyerUrl) return;
    const a = document.createElement("a");
    a.href = flyerUrl;
    a.download = `${nomineeName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-flyer.png`;
    a.click();
  }

  async function handleCopyText() {
    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  }

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={`${dialogId}-title`}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-stone-950/80 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="relative flex flex-col w-full max-w-md max-h-[92vh] overflow-y-auto rounded-3xl bg-white border border-stone-200 p-5 sm:p-6 shadow-2xl animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between pb-3 border-b border-stone-100">
          <div>
            <h3 id={`${dialogId}-title`} className="font-bold text-stone-900 text-base">
              Candidate Voting Flyer
            </h3>
            <p className="text-xs text-stone-500">
              {nomineeName} · {categoryName}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-stone-100 hover:bg-stone-200 p-1.5 text-stone-500 hover:text-stone-800 text-xs font-bold transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Flyer Preview */}
        <div className="mt-4 flex flex-col items-center justify-center min-h-[320px] rounded-2xl bg-stone-100 border border-stone-200 overflow-hidden relative">
          {loading ? (
            <div className="text-center p-6 space-y-2">
              <div className="size-8 rounded-full border-2 border-emerald-800 border-t-transparent animate-spin mx-auto" />
              <p className="text-xs font-semibold text-stone-600">Generating HD Campaign Flyer...</p>
            </div>
          ) : flyerUrl ? (
            <img
              src={flyerUrl}
              alt={`Voting flyer for ${nomineeName}`}
              className="w-full h-auto max-h-[420px] object-contain shadow-sm"
            />
          ) : (
            <div className="p-6 text-center text-xs text-stone-500">
              Could not generate flyer preview. You can still share candidate text below.
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="mt-4 pt-3 border-t border-stone-100 flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={handleCopyText}
            className="inline-flex items-center gap-1.5 rounded-xl border border-stone-300 bg-white px-3 py-2 text-xs font-bold text-stone-700 hover:bg-stone-50 cursor-pointer"
          >
            <span>{copied ? "✓ Copied!" : "📋 Copy Voting Text"}</span>
          </button>

          <div className="flex items-center gap-2">
            <a
              href={`https://wa.me/?text=${encodeURIComponent(shareText)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-800 px-3.5 py-2 text-xs font-bold text-white hover:bg-emerald-700 shadow-xs active:scale-95 cursor-pointer"
            >
              <Image src="/images/whatsapp-logo.jpg" alt="" width={14} height={14} className="rounded-full" />
              <span>Share</span>
            </a>

            {flyerUrl && (
              <button
                type="button"
                onClick={handleDownload}
                className="inline-flex items-center gap-1.5 rounded-xl bg-stone-900 px-3.5 py-2 text-xs font-bold text-white hover:bg-stone-800 shadow-xs active:scale-95 cursor-pointer"
              >
                <span>⬇ Download HD</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
