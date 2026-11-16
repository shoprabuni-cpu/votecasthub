"use client";

import { useEffect, useState, useId, type ReactNode } from "react";
import Image from "next/image";

export type TutorialPlatform = "whatsapp" | "telegram";

export interface TutorialVideoMeta {
  id: string;
  title: string;
  platform: TutorialPlatform;
  platformLabel: string;
  channel: string;
  description: string;
  youtubeUrl: string;
  embedUrl: string;
}

export const TUTORIAL_VIDEOS: Record<TutorialPlatform, TutorialVideoMeta> = {
  whatsapp: {
    id: "52Npc0ak8hg",
    title: "How to Vote on Votecasthub GH Using WhatsApp",
    platform: "whatsapp",
    platformLabel: "WhatsApp",
    channel: "+233 59 299 2566",
    description: "Learn how to cast your vote on VoteCastHub GH using our official WhatsApp bot. Send VOTE, choose your candidate, and complete MoMo payment in seconds.",
    youtubeUrl: "https://www.youtube.com/watch?v=52Npc0ak8hg",
    embedUrl: "https://www.youtube.com/embed/52Npc0ak8hg",
  },
  telegram: {
    id: "axxW5lEAWmE",
    title: "How to Vote on Vitecasthub GH Using Votecasthub_Bot on Telegram",
    platform: "telegram",
    platformLabel: "Telegram",
    channel: "@VotecastHubGH_bot",
    description: "Step-by-step tutorial on voting with @VotecastHubGH_bot on Telegram. See interactive candidate photos, 1-tap phone verification, and instant Mobile Money checkout.",
    youtubeUrl: "https://www.youtube.com/watch?v=axxW5lEAWmE",
    embedUrl: "https://www.youtube.com/embed/axxW5lEAWmE",
  },
};

/**
 * YouTube embed with strict compliance for official view counting:
 * - Uses standard www.youtube.com/embed (not nocookie)
 * - referrerPolicy="strict-origin-when-cross-origin"
 * - Full accelerometer/autoplay/picture-in-picture permissions
 * - Direct watch link fallback to maximize watch time and subscriber conversions
 */
export function YouTubeEmbed({
  videoId,
  title,
  youtubeUrl,
  autoplay = false,
  className = "",
}: {
  videoId: string;
  title: string;
  youtubeUrl?: string;
  autoplay?: boolean;
  className?: string;
}) {
  const directLink = youtubeUrl || `https://www.youtube.com/watch?v=${videoId}`;
  const embedSrc = `https://www.youtube.com/embed/${videoId}?autoplay=${autoplay ? "1" : "0"}&rel=0&modestbranding=1&enablejsapi=1&playsinline=1`;

  return (
    <div className={`flex flex-col items-center ${className}`}>
      {/* Smartphone-styled 9:16 frame */}
      <div className="relative aspect-[9/16] w-full max-w-[340px] sm:max-w-[380px] overflow-hidden rounded-3xl border-4 border-stone-900 bg-black shadow-2xl ring-1 ring-stone-950/20">
        {/* Subtle phone notch indicator */}
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-20 h-3.5 w-20 rounded-full bg-stone-900/90 pointer-events-none" />
        
        <iframe
          src={embedSrc}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          className="relative z-10 h-full w-full border-0"
        />
      </div>

      {/* Official YouTube CTA */}
      <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-xs">
        <a
          href={directLink}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-full bg-red-50 border border-red-200 px-3 py-1 font-semibold text-red-700 hover:bg-red-100 hover:text-red-800 transition-colors dark:bg-red-950/60 dark:border-red-900/60 dark:text-red-300 dark:hover:bg-red-900/60"
          title="Open in YouTube App to like, save, or subscribe"
        >
          <svg className="size-3.5 fill-red-600" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
          </svg>
          <span>Watch on YouTube ↗</span>
        </a>
        <span className="text-stone-400 dark:text-stone-600">·</span>
        <span className="text-[11px] text-stone-500 dark:text-stone-400">Official Tutorial Video</span>
      </div>
    </div>
  );
}

/**
 * Overlay modal dialog that plays the video tutorial when triggered.
 * When closed, unmounts the iframe so playback stops cleanly.
 */
export function YouTubeTutorialModal({
  open,
  onClose,
  platform,
}: {
  open: boolean;
  onClose: () => void;
  platform: TutorialPlatform;
}) {
  const meta = TUTORIAL_VIDEOS[platform];
  const dialogId = useId();

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={`${dialogId}-title`}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-stone-950/80 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative flex flex-col items-center w-full max-w-md max-h-[92vh] overflow-y-auto rounded-3xl bg-stone-900 border border-stone-700/80 p-4 sm:p-6 text-white shadow-2xl animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with Title and Close button */}
        <div className="flex w-full items-start justify-between gap-3 pb-3 border-b border-stone-800">
          <div className="flex items-center gap-2.5">
            <div className="size-8 rounded-full bg-red-600/20 border border-red-500/30 flex items-center justify-center shrink-0">
              <svg className="size-4 fill-red-500" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
            <div>
              <h3 id={`${dialogId}-title`} className="text-sm sm:text-base font-bold text-white leading-tight">
                {meta.platformLabel} Voting Tutorial
              </h3>
              <p className="text-[11px] text-stone-400">{meta.channel}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close video player"
            className="rounded-full bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white p-2 text-xs font-bold transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Video Player */}
        <div className="mt-4 w-full flex justify-center">
          <YouTubeEmbed
            videoId={meta.id}
            title={meta.title}
            youtubeUrl={meta.youtubeUrl}
            autoplay={true}
          />
        </div>

        {/* Footer info */}
        <p className="mt-3 text-center text-xs text-stone-300 leading-relaxed max-w-xs">
          {meta.description}
        </p>
      </div>
    </div>
  );
}

/**
 * Self-contained 1-tap button that manages its own modal state.
 */
export function YouTubeTutorialButton({
  platform,
  label = "Watch Video Guide",
  variant = "secondary",
  size = "md",
  className = "",
}: {
  platform: TutorialPlatform;
  label?: string;
  variant?: "primary" | "secondary" | "subtle" | "ghost";
  size?: "sm" | "md";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const meta = TUTORIAL_VIDEOS[platform];

  const variantStyles = {
    primary:
      platform === "whatsapp"
        ? "bg-emerald-700 hover:bg-emerald-800 text-white border-transparent shadow-xs dark:bg-emerald-600 dark:hover:bg-emerald-500"
        : "bg-sky-700 hover:bg-sky-800 text-white border-transparent shadow-xs dark:bg-sky-600 dark:hover:bg-sky-500",
    secondary:
      platform === "whatsapp"
        ? "bg-emerald-50 hover:bg-emerald-100/80 text-emerald-900 border border-emerald-200 shadow-2xs dark:bg-emerald-950/70 dark:text-emerald-300 dark:border-emerald-800/80 dark:hover:bg-emerald-900/80"
        : "bg-sky-50 hover:bg-sky-100/80 text-sky-950 border border-sky-200 shadow-2xs dark:bg-sky-950/70 dark:text-sky-300 dark:border-sky-800/80 dark:hover:bg-sky-900/80",
    subtle:
      "bg-stone-50 hover:bg-stone-100 text-stone-700 border border-stone-200 shadow-2xs dark:bg-[#101412] dark:text-stone-300 dark:border-[#1c2721] dark:hover:bg-[#18201b]",
    ghost:
      "bg-transparent hover:bg-stone-100 text-stone-700 border-transparent dark:text-stone-300 dark:hover:bg-[#121814] dark:hover:text-white",
  };

  const sizeStyles = {
    sm: "px-2.5 py-1 text-[11px] min-h-8 gap-1.5",
    md: "px-3.5 py-2 text-xs min-h-10 gap-2",
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`inline-flex items-center justify-center font-bold rounded-xl transition-all active:scale-95 cursor-pointer ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
        title={`Watch video tutorial: ${meta.title}`}
      >
        <span className="inline-flex size-4 items-center justify-center rounded-full bg-red-600 text-white text-[9px] font-black">
          ▶
        </span>
        <span>{label}</span>
      </button>

      <YouTubeTutorialModal
        open={open}
        onClose={() => setOpen(false)}
        platform={platform}
      />
    </>
  );
}
