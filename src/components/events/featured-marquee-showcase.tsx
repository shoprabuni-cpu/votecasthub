"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { NomineeQuickVoteModal, type LookupResult } from "./nominee-quick-vote-modal";
import type { PublicEventCardData } from "./public-event-card";

interface FeaturedMarqueeShowcaseProps {
  events: PublicEventCardData[];
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
  const activeEvent = events && events.length > 0 ? events[selectedIndex] || events[0] : null;

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
        className="relative my-6 w-full overflow-hidden rounded-3xl border border-sky-950/40 bg-gradient-to-br from-[#0c1a2e] via-[#091322] to-[#050c17] p-6 text-white shadow-2xl sm:p-10 lg:p-12"
        aria-label="Featured events and quick vote"
      >
        {/* Subtle marquee ambient lights */}
        <div className="pointer-events-none absolute inset-0 select-none" aria-hidden="true">
          <div className="absolute -top-32 -left-32 h-96 w-96 rounded-full bg-sky-600/15 blur-[120px]" />
          <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-amber-500/10 blur-[120px]" />
        </div>

        <div className="relative grid items-center gap-10 lg:grid-cols-[1.1fr_1.3fr] lg:gap-14">
          {/* Left Column: Bold Headline & Quick Vote Input */}
          <div className="flex flex-col justify-center">
            <h2 className="font-sans text-3xl font-extrabold tracking-tight text-white sm:text-5xl lg:text-6xl leading-[1.08]">
              Every vote <br />
              puts someone <br />
              <span className="text-[#f59e0b]">on stage.</span>
            </h2>

            <p className="mt-5 max-w-md text-sm sm:text-base leading-relaxed text-stone-300">
              Back your nominee with Mobile Money or card, watch the count move, and book your seat for the big night.
            </p>

            {/* Quick Nominee Code Bar */}
            <div className="mt-8">
              <label
                htmlFor="homepage-nominee-code-input"
                className="block text-xs font-bold uppercase tracking-wider text-white"
              >
                Have a nominee code?
              </label>

              <form onSubmit={handleQuickVote} className="mt-2.5 flex max-w-md items-center">
                <div className="relative flex-1">
                  <input
                    id="homepage-nominee-code-input"
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
                  className="inline-flex h-13 shrink-0 items-center gap-1.5 rounded-r-2xl bg-[#e5a228] px-6 text-sm font-bold text-stone-950 shadow-md transition hover:bg-[#d0901e] disabled:opacity-60"
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
            <div className="relative rounded-3xl border-2 border-dashed border-sky-400/25 bg-[#0b1626]/80 p-4 sm:p-6 shadow-[0_0_40px_rgba(14,165,233,0.15)] backdrop-blur-sm">
              <div className="grid gap-6 sm:grid-cols-[1.1fr_1fr] sm:items-center">
                {/* Main Featured Poster */}
                <div className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl border border-white/10 bg-black/50 shadow-2xl">
                  {activeEvent.imageUrl ? (
                    <Image
                      src={activeEvent.imageUrl}
                      alt={activeEvent.name}
                      fill
                      className="object-cover"
                      priority
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center p-4 text-center font-bold text-white/40">
                      {activeEvent.name}
                    </div>
                  )}
                </div>

                {/* Event Details & Action Button */}
                <div className="flex flex-col justify-between">
                  <div>
                    <span className="inline-block rounded-full border border-amber-400/50 bg-amber-400/10 px-3 py-1 text-[10px] font-bold tracking-widest text-[#f59e0b] uppercase">
                      NOW SHOWING
                    </span>

                    <h3 className="mt-3 text-lg sm:text-xl font-bold leading-tight text-white line-clamp-2">
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

                  {/* Thumbnail Switcher (Up to 6 active events) */}
                  {events && events.length > 1 && (
                    <div className="mt-6 border-t border-white/10 pt-4">
                      <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-stone-400">
                        Switch Showcase:
                      </p>
                      <div className="grid grid-cols-3 gap-2">
                        {events.slice(0, 6).map((evt, idx) => (
                          <button
                            key={evt.id}
                            type="button"
                            onClick={() => setSelectedIndex(idx)}
                            className={`relative aspect-[3/4] overflow-hidden rounded-lg border-2 transition-all ${
                              selectedIndex === idx
                                ? "border-[#f59e0b] scale-105 shadow-md shadow-amber-500/30"
                                : "border-white/10 opacity-60 hover:opacity-100 hover:border-white/30"
                            }`}
                            aria-label={`View ${evt.name}`}
                          >
                            {evt.imageUrl ? (
                              <Image
                                src={evt.imageUrl}
                                alt=""
                                fill
                                className="object-cover"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center bg-stone-900 text-[8px] font-bold text-white">
                                #{idx + 1}
                              </div>
                            )}
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
