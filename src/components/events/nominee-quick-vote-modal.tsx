"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";

export interface SiblingNominee {
  id: string;
  name: string;
  public_code: string | null;
  image_path: string | null;
}

export interface NomineeMatchData {
  id: string;
  name: string;
  public_code: string | null;
  biography: string | null;
  image_path: string | null;
}

export interface LookupResult {
  matchType: "single_nominee" | "multiple_nominees" | "event" | "not_found" | "error";
  nominee?: NomineeMatchData;
  category?: { id: string; name: string };
  event?: {
    id: string;
    name: string;
    slug: string;
    status: string;
    currency: string;
    unit_price_minor: number;
    voting_mode: string;
  };
  siblingNominees?: SiblingNominee[];
  matches?: Array<{
    nominee: NomineeMatchData;
    category: { id: string; name: string };
    event: { id: string; name: string; slug: string };
  }>;
  message?: string;
}

interface NomineeQuickVoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  result: LookupResult | null;
  isLoading: boolean;
  onSelectCandidate?: (candidate: any) => void;
}

export function NomineeQuickVoteModal({
  isOpen,
  onClose,
  result,
  isLoading,
  onSelectCandidate,
}: NomineeQuickVoteModalProps) {
  const router = useRouter();
  const [activeNominee, setActiveNominee] = useState<NomineeMatchData | null>(null);

  useEffect(() => {
    if (result?.nominee) {
      setActiveNominee(result.nominee);
    }
  }, [result]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const currentNominee = activeNominee || result?.nominee;
  const category = result?.category;
  const event = result?.event;
  const siblings = result?.siblingNominees || [];

  const handleVoteRedirect = () => {
    if (event?.slug && currentNominee?.id) {
      router.push(`/events/${event.slug}?nominee=${currentNominee.id}`);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
      {/* Blurred Dim Backdrop */}
      <div
        className="fixed inset-0 bg-black/75 backdrop-blur-md transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Dialog Content */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="quick-vote-title"
        className="relative z-10 w-full max-w-lg overflow-hidden rounded-3xl border border-stone-200/90 bg-white shadow-2xl transition-all dark:border-[#1e2d24] dark:bg-[#0a0f0d]"
      >
        {/* Loading State */}
        {isLoading && (
          <div className="flex min-h-[320px] flex-col items-center justify-center p-8 text-center">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
            <p className="mt-4 text-sm font-semibold text-stone-700 dark:text-stone-300">
              Locating nominee code...
            </p>
          </div>
        )}

        {/* Not Found State */}
        {!isLoading && result?.matchType === "not_found" && (
          <div className="p-6 text-center sm:p-8">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500">
              <svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <circle cx={12} cy={12} r={10} />
                <line x1={12} y1={8} x2={12} y2={12} />
                <line x1={12} y1={16} x2={12.01} y2={16} />
              </svg>
            </div>
            <h3 id="quick-vote-title" className="mt-4 text-lg font-bold text-stone-900 dark:text-white">
              Nominee Code Not Found
            </h3>
            <p className="mt-2 text-xs leading-relaxed text-stone-600 dark:text-stone-400">
              {result.message || "We could not find an active nominee with this code. Please verify the spelling or check the event flyer."}
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-6 inline-flex min-h-11 items-center justify-center rounded-xl bg-stone-900 px-6 text-xs font-semibold text-white transition hover:bg-stone-800 dark:bg-emerald-600 dark:hover:bg-emerald-500"
            >
              Close &amp; Try Again
            </button>
          </div>
        )}

        {/* Disambiguation: Multiple Nominees Found for bare code */}
        {!isLoading && result?.matchType === "multiple_nominees" && (
          <div className="p-6 sm:p-8">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3 dark:border-stone-800">
              <div>
                <h3 id="quick-vote-title" className="text-base font-bold text-stone-900 dark:text-white">
                  Multiple Events Found
                </h3>
                <p className="text-xs text-stone-500 dark:text-stone-400">
                  Select the event you wish to vote in:
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-stone-100 text-stone-600 hover:bg-stone-200 dark:bg-stone-800 dark:text-stone-300"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-2.5 max-h-80 overflow-y-auto pr-1">
              {result.matches?.map((m) => (
                <button
                  key={m.nominee.id}
                  type="button"
                  onClick={() => {
                    if (onSelectCandidate) {
                      onSelectCandidate(m);
                    } else {
                      router.push(`/events/${m.event.slug}?nominee=${m.nominee.id}`);
                      onClose();
                    }
                  }}
                  className="group flex w-full items-center justify-between rounded-2xl border border-stone-200 bg-stone-50/60 p-3.5 text-left transition hover:border-emerald-500 hover:bg-white hover:shadow-md dark:border-stone-800 dark:bg-stone-900/60 dark:hover:border-emerald-500"
                >
                  <div className="flex items-center gap-3">
                    <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-stone-200 dark:bg-stone-800">
                      {m.nominee.image_path ? (
                        <Image
                          src={m.nominee.image_path}
                          alt={m.nominee.name}
                          fill
                          className="object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-xs font-bold text-stone-500">
                          {m.nominee.name.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-stone-900 group-hover:text-emerald-700 dark:text-white dark:group-hover:text-emerald-400">
                        {m.nominee.name}
                      </p>
                      <p className="text-xs text-stone-500 dark:text-stone-400">
                        {m.category.name} • <span className="font-medium text-stone-700 dark:text-stone-300">{m.event.name}</span>
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    Vote →
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Single Nominee Showcase View */}
        {!isLoading && result?.matchType === "single_nominee" && currentNominee && (
          <div className="flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-stone-100 px-5 py-3.5 dark:border-stone-800/80">
              <div className="min-w-0 pr-3">
                <span className="block truncate text-[11px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-400">
                  {event?.name}
                </span>
                <span className="block truncate text-xs text-stone-500 dark:text-stone-400">
                  {category?.name}
                </span>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-stone-100 text-stone-500 hover:bg-stone-200 hover:text-stone-900 dark:bg-stone-800 dark:text-stone-400 dark:hover:bg-stone-700 dark:hover:text-white"
                aria-label="Close modal"
              >
                ✕
              </button>
            </div>

            {/* Featured Nominee Hero Card */}
            <div className="p-5 sm:p-6">
              <div className="flex flex-col items-center text-center">
                {/* Photo Frame */}
                <div className="relative h-28 w-28 sm:h-32 sm:w-32 overflow-hidden rounded-2xl border-2 border-emerald-500/80 shadow-lg shadow-emerald-500/10 dark:border-emerald-500">
                  {currentNominee.image_path ? (
                    <Image
                      src={currentNominee.image_path}
                      alt={currentNominee.name}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-emerald-950 text-xl font-bold text-emerald-400">
                      {currentNominee.name.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  {/* Verified Badge */}
                  <span className="absolute bottom-1 right-1 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-white shadow">
                    ✓
                  </span>
                </div>

                {/* Nominee Title & Code Badge */}
                <h3 id="quick-vote-title" className="mt-3.5 text-xl font-extrabold text-stone-900 sm:text-2xl dark:text-white">
                  {currentNominee.name}
                </h3>

                <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
                  {currentNominee.public_code && (
                    <span className="rounded-md border border-stone-200 bg-stone-100 px-2 py-0.5 font-mono text-xs font-bold text-stone-800 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-200">
                      Code: {currentNominee.public_code}
                    </span>
                  )}
                  <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400">
                    {event?.voting_mode === "free" ? "Free Ballot" : `GHS ${((event?.unit_price_minor ?? 50) / 100).toFixed(2)} / vote`}
                  </span>
                </div>

                {currentNominee.biography && (
                  <p className="mt-2.5 max-w-sm line-clamp-2 text-xs leading-relaxed text-stone-600 dark:text-stone-300">
                    {currentNominee.biography}
                  </p>
                )}

                {/* Big Action Button */}
                <button
                  type="button"
                  onClick={handleVoteRedirect}
                  className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 py-3.5 text-sm font-bold text-white shadow-md transition hover:from-amber-600 hover:to-amber-700 hover:shadow-lg active:scale-[0.99]"
                >
                  <span>Vote for {currentNominee.name}</span>
                  <span aria-hidden="true">→</span>
                </button>
              </div>

              {/* Sibling Nominees in Same Category */}
              {siblings.length > 0 && (
                <div className="mt-6 border-t border-stone-100 pt-4 dark:border-stone-800/80">
                  <p className="mb-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">
                    Other Contenders in this Category:
                  </p>
                  <div className="flex gap-2.5 overflow-x-auto pb-1 pt-1 no-scrollbar">
                    {siblings.map((sib) => (
                      <button
                        key={sib.id}
                        type="button"
                        onClick={() => setActiveNominee(sib as any)}
                        className={`group flex shrink-0 items-center gap-2 rounded-xl border p-2 text-left transition ${
                          activeNominee?.id === sib.id
                            ? "border-emerald-500 bg-emerald-50/50 shadow-xs dark:bg-emerald-950/30"
                            : "border-stone-200/80 bg-white hover:border-stone-300 dark:border-stone-800 dark:bg-stone-900"
                        }`}
                      >
                        <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-lg bg-stone-100 dark:bg-stone-800">
                          {sib.image_path ? (
                            <Image
                              src={sib.image_path}
                              alt={sib.name}
                              fill
                              className="object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-[10px] font-bold text-stone-500">
                              {sib.name.slice(0, 2).toUpperCase()}
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 pr-1">
                          <p className="truncate text-xs font-bold text-stone-900 group-hover:text-emerald-700 dark:text-stone-100 dark:group-hover:text-emerald-400">
                            {sib.name}
                          </p>
                          <p className="font-mono text-[10px] text-stone-500 dark:text-stone-400">
                            {sib.public_code || "Contender"}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
