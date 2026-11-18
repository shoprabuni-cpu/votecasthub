"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { NomineeQuickVoteModal, type LookupResult } from "./nominee-quick-vote-modal";
import type { PublicEventCardData } from "./public-event-card";

interface FeaturedMarqueeShowcaseProps {
  events: PublicEventCardData[];
}

/**
 * Bulletproof image component that never shows broken image icons.
 * Gracefully falls back to a branded, high-contrast cinema ticket/ballot flyer
 * if the image is missing, 404s, or fails network loading.
 */
function SafeEventPoster({
  src,
  alt,
  fallbackTitle,
  isTicket,
  priority = false,
  className = "object-cover",
}: {
  src?: string | null;
  alt: string;
  fallbackTitle: string;
  isTicket?: boolean;
  priority?: boolean;
  className?: string;
}) {
  const [failed, setFailed] = useState(!src);

  useEffect(() => {
    setFailed(!src);
  }, [src]);

  if (!src || failed) {
    return (
      <div
        className={`relative flex h-full w-full flex-col justify-between overflow-hidden p-3 text-white select-none ${
          isTicket
            ? "bg-gradient-to-br from-[#1a1205] via-[#261908] to-[#0c0903]"
            : "bg-gradient-to-br from-[#051711] via-[#09261c] to-[#030e0b]"
        }`}
      >
        <div className="flex items-center justify-between text-[9px] font-bold uppercase tracking-wider text-amber-400">
          <span>{isTicket ? "VIP PASS" : "OFFICIAL BALLOT"}</span>
          <span className="text-xs">★</span>
        </div>

        <div className="my-auto py-2 text-center">
          <p className="line-clamp-3 text-xs sm:text-sm font-extrabold leading-tight text-white drop-shadow-sm">
            {fallbackTitle}
          </p>
        </div>

        <div className="flex items-center justify-between border-t border-white/10 pt-1.5 text-[8px] font-mono uppercase tracking-wider text-white/50">
          <span>GHANA</span>
          <span>VOTECAST</span>
        </div>
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      unoptimized
      priority={priority}
      onError={() => setFailed(true)}
      className={className}
    />
  );
}

export function FeaturedMarqueeShowcase({ events }: FeaturedMarqueeShowcaseProps) {
  const router = useRouter();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [codeQuery, setCodeQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [lookupResult, setLookupResult] = useState<LookupResult | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Active featured event
  const safeEvents = events && events.length > 0 ? events : [];
  const activeEvent = safeEvents[selectedIndex] || safeEvents[0] || null;

  // Compute days left
  let countdownLabel = "Voting Active";
  if (activeEvent?.ends_at) {
    const diffMs = new Date(activeEvent.ends_at).getTime() - Date.now();
    const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    if (days > 1) {
      countdownLabel = `${days} days left`;
    } else if (days === 1) {
      countdownLabel = "Ends today";
    } else {
      countdownLabel = "Closing soon";
    }
  }

  const handleQuickVote = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = codeQuery.trim();
    if (!clean) return;

    setIsSearching(true);
    setErrorMessage(null);

    try {
      const res = await fetch(`/api/nominees/lookup?code=${encodeURIComponent(clean)}`);
      const data: LookupResult = await res.json();
      setLookupResult(data);
      setIsModalOpen(true);
    } catch {
      setErrorMessage("Network error. Please try again.");
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <>
      <section
        className="relative my-6 w-full overflow-hidden rounded-3xl border border-sky-950/40 bg-gradient-to-br from-[#0c1a2e] via-[#091322] to-[#050c17] p-4 text-white shadow-2xl sm:p-8 lg:p-12"
        aria-label="Featured events and quick vote marquee"
      >
        {/* Subtle marquee ambient lights */}
        <div className="pointer-events-none absolute inset-0 select-none" aria-hidden="true">
          <div className="absolute -top-32 -left-32 h-96 w-96 rounded-full bg-sky-600/15 blur-[120px]" />
          <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-amber-500/10 blur-[120px]" />
        </div>

        {/* ============================================================== */}
        {/* 1. MOBILE NATIVE APP VIEW (Visible on < lg screens)           */}
        {/* ============================================================== */}
        <div className="relative flex flex-col gap-5 lg:hidden">
          {/* Mobile Header: Punchy Headline */}
          <div>
            <h2 className="text-2xl font-black tracking-tight text-white sm:text-4xl leading-[1.12]">
              Every vote <br />
              puts someone <span className="text-[#f59e0b]">on stage.</span>
            </h2>
            <p className="mt-2 text-xs sm:text-sm text-stone-300 leading-relaxed">
              Back your nominee with Mobile Money or card, watch the count move, and book your seat.
            </p>
          </div>

          {/* Quick Nominee Code Bar on Mobile */}
          <div className="rounded-2xl bg-black/40 p-3 border border-white/10 backdrop-blur-md">
            <label
              htmlFor="mobile-nominee-code-input"
              className="block text-[11px] font-bold uppercase tracking-wider text-amber-400"
            >
              Have a nominee code?
            </label>
            <form onSubmit={handleQuickVote} className="mt-2 flex items-center">
              <input
                id="mobile-nominee-code-input"
                type="text"
                value={codeQuery}
                onChange={(e) => setCodeQuery(e.target.value)}
                placeholder="e.g. ABC12 or AMES-01"
                className="h-11 flex-1 rounded-l-xl border-0 bg-white px-3.5 text-xs font-bold uppercase text-stone-900 shadow-inner placeholder:normal-case placeholder:font-normal placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#f59e0b]"
              />
              <button
                type="submit"
                disabled={isSearching}
                className="inline-flex h-11 shrink-0 items-center gap-1 rounded-r-xl bg-[#e5a228] px-4 text-xs font-bold text-stone-950 shadow-md transition active:scale-95 hover:bg-[#d0901e] disabled:opacity-60 cursor-pointer"
              >
                {isSearching ? (
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-stone-950 border-t-transparent" />
                ) : (
                  <>
                    <span>Vote</span>
                    <span aria-hidden="true">→</span>
                  </>
                )}
              </button>
            </form>
            {errorMessage && (
              <p className="mt-1.5 text-[11px] font-medium text-amber-400">{errorMessage}</p>
            )}
          </div>

          {/* Active Featured Event: Native Horizontal Cinema Card */}
          {activeEvent && (
            <div className="relative overflow-hidden rounded-2xl border-2 border-dashed border-sky-400/35 bg-[#0b1626]/90 p-3 sm:p-4 shadow-[0_0_25px_rgba(14,165,233,0.18)]">
              <div className="flex items-center gap-3.5">
                {/* Horizontal Left: Poster Thumbnail */}
                <div className="relative aspect-[3/4] w-24 sm:w-28 shrink-0 overflow-hidden rounded-xl border border-white/15 bg-black/50 shadow-lg">
                  <SafeEventPoster
                    src={activeEvent.imageUrl}
                    alt={activeEvent.name}
                    fallbackTitle={activeEvent.name}
                    isTicket={activeEvent.event_type === "ticketing"}
                    priority
                  />
                </div>

                {/* Horizontal Right: Event Metadata & Action */}
                <div className="flex flex-1 flex-col justify-between min-w-0">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="inline-block rounded-full border border-amber-400/50 bg-amber-400/15 px-2 py-0.5 text-[9px] font-extrabold tracking-wider text-[#f59e0b] uppercase">
                        NOW SHOWING
                      </span>
                      <span className="text-[10px] font-semibold text-stone-400 truncate">
                        • {countdownLabel}
                      </span>
                    </div>

                    <h3 className="mt-1.5 text-sm sm:text-base font-bold text-white line-clamp-2 leading-snug">
                      {activeEvent.name}
                    </h3>

                    {activeEvent.organization_name && (
                      <p className="text-[10px] font-medium text-emerald-400 truncate mt-0.5">
                        {activeEvent.organization_name}
                      </p>
                    )}
                  </div>

                  <div className="mt-2.5">
                    <Link
                      href={`/events/${activeEvent.slug}`}
                      className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#e5a228] py-2 px-3 text-xs font-bold text-stone-950 shadow-md transition active:scale-95 hover:bg-[#d0901e]"
                    >
                      <span>{activeEvent.event_type === "ticketing" ? "Get Tickets" : "Vote now"}</span>
                      <span aria-hidden="true">→</span>
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Horizontal Reel / Thumbnail Switcher (Native App Horizontal Carousel) */}
          {safeEvents.length > 1 && (
            <div>
              <div className="flex items-center justify-between mb-2 px-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
                  Active Contests &amp; Passes ({safeEvents.length})
                </span>
                <span className="text-[10px] text-amber-400/80 font-medium">
                  Swipe to switch ↔
                </span>
              </div>

              <div className="flex gap-2.5 overflow-x-auto pb-2 pt-1 no-scrollbar snap-x">
                {safeEvents.map((evt, idx) => (
                  <button
                    key={evt.id}
                    type="button"
                    onClick={() => setSelectedIndex(idx)}
                    className={`group relative aspect-[3/4] w-20 shrink-0 snap-start overflow-hidden rounded-xl border-2 transition-all cursor-pointer ${
                      selectedIndex === idx
                        ? "border-[#f59e0b] scale-105 shadow-lg shadow-amber-500/40 ring-2 ring-amber-400/30"
                        : "border-white/15 opacity-65 hover:opacity-100 hover:border-white/40"
                    }`}
                    aria-label={`Show ${evt.name}`}
                  >
                    <SafeEventPoster
                      src={evt.imageUrl}
                      alt={evt.name}
                      fallbackTitle={evt.name}
                      isTicket={evt.event_type === "ticketing"}
                    />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent p-1 text-[8px] font-bold text-white truncate text-center">
                      #{idx + 1}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ============================================================== */}
        {/* 2. DESKTOP VIEW (Visible on lg+ screens: Matches Reference)    */}
        {/* ============================================================== */}
        <div className="relative hidden lg:grid items-center gap-10 lg:grid-cols-[1.1fr_1.3fr] lg:gap-14">
          {/* Left Column: Bold Headline & Quick Vote Input */}
          <div className="flex flex-col justify-center">
            <h2 className="font-sans text-4xl font-extrabold tracking-tight text-white lg:text-6xl leading-[1.08]">
              Every vote <br />
              puts someone <br />
              <span className="text-[#f59e0b]">on stage.</span>
            </h2>

            <p className="mt-5 max-w-md text-base leading-relaxed text-stone-300">
              Back your nominee with Mobile Money or card, watch the count move, and book your seat for the big night.
            </p>

            {/* Quick Nominee Code Bar */}
            <div className="mt-8">
              <label
                htmlFor="desktop-nominee-code-input"
                className="block text-xs font-bold uppercase tracking-wider text-white"
              >
                Have a nominee code?
              </label>

              <form onSubmit={handleQuickVote} className="mt-2.5 flex max-w-md items-center">
                <div className="relative flex-1">
                  <input
                    id="desktop-nominee-code-input"
                    type="text"
                    value={codeQuery}
                    onChange={(e) => setCodeQuery(e.target.value)}
                    placeholder="e.g. ABC12 or AMES-01"
                    className="h-13 w-full rounded-l-2xl border-0 bg-white px-4 text-sm font-semibold uppercase text-stone-900 shadow-inner placeholder:normal-case placeholder:font-normal placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#f59e0b]"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSearching}
                  className="inline-flex h-13 shrink-0 items-center gap-1.5 rounded-r-2xl bg-[#e5a228] px-6 text-sm font-bold text-stone-950 shadow-md transition hover:bg-[#d0901e] disabled:opacity-60 cursor-pointer"
                >
                  {isSearching ? (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-stone-950 border-t-transparent" />
                  ) : (
                    <>
                      <span>Vote</span>
                      <span aria-hidden="true">→</span>
                    </>
                  )}
                </button>
              </form>

              {errorMessage && (
                <p className="mt-2 text-xs font-medium text-amber-400">{errorMessage}</p>
              )}
            </div>
          </div>

          {/* Right Column: Marquee Showcase Frame & Thumbnail Switcher */}
          {activeEvent && (
            <div className="relative rounded-3xl border-2 border-dashed border-sky-400/25 bg-[#0b1626]/80 p-6 shadow-[0_0_40px_rgba(14,165,233,0.15)] backdrop-blur-sm">
              <div className="grid gap-6 sm:grid-cols-[1.1fr_1fr] sm:items-center">
                {/* Main Featured Poster */}
                <div className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl border border-white/10 bg-black/50 shadow-2xl">
                  <SafeEventPoster
                    src={activeEvent.imageUrl}
                    alt={activeEvent.name}
                    fallbackTitle={activeEvent.name}
                    isTicket={activeEvent.event_type === "ticketing"}
                    priority
                  />
                </div>

                {/* Event Details & Action Button */}
                <div className="flex flex-col justify-between h-full py-1">
                  <div>
                    <span className="inline-block rounded-full border border-amber-400/50 bg-amber-400/10 px-3 py-1 text-[10px] font-bold tracking-widest text-[#f59e0b] uppercase">
                      NOW SHOWING
                    </span>

                    <h3 className="mt-3 text-xl font-bold leading-tight text-white line-clamp-2">
                      {activeEvent.name}
                    </h3>

                    <p className="mt-2 text-xs font-semibold text-stone-400">
                      {countdownLabel}
                    </p>

                    <Link
                      href={`/events/${activeEvent.slug}`}
                      className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl bg-[#e5a228] px-5 py-2.5 text-xs font-bold text-stone-950 shadow-md transition hover:bg-[#d0901e]"
                    >
                      <span>{activeEvent.event_type === "ticketing" ? "Get Tickets" : "Vote now"}</span>
                      <span aria-hidden="true">→</span>
                    </Link>
                  </div>

                  {/* Thumbnail Switcher (Up to 6 active events in 3x2 grid as reference) */}
                  {safeEvents.length > 1 && (
                    <div className="mt-6 border-t border-white/10 pt-4">
                      <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-stone-400">
                        Switch Showcase:
                      </p>
                      <div className="grid grid-cols-3 gap-2">
                        {safeEvents.slice(0, 6).map((evt, idx) => (
                          <button
                            key={evt.id}
                            type="button"
                            onClick={() => setSelectedIndex(idx)}
                            className={`relative aspect-[3/4] overflow-hidden rounded-lg border-2 transition-all cursor-pointer ${
                              selectedIndex === idx
                                ? "border-[#f59e0b] scale-105 shadow-md shadow-amber-500/30 ring-2 ring-amber-400/20"
                                : "border-white/10 opacity-60 hover:opacity-100 hover:border-white/30"
                            }`}
                            aria-label={`View ${evt.name}`}
                          >
                            <SafeEventPoster
                              src={evt.imageUrl}
                              alt={evt.name}
                              fallbackTitle={evt.name}
                              isTicket={evt.event_type === "ticketing"}
                            />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Nominee Quick-Vote Modal */}
      <NomineeQuickVoteModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        result={lookupResult}
        isLoading={isSearching}
        onSelectCandidate={(candidate) => {
          router.push(`/events/${candidate.event.slug}?nominee=${candidate.nominee.id}`);
          setIsModalOpen(false);
        }}
      />
    </>
  );
}
