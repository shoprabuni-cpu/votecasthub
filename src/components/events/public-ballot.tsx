"use client";

import { useState, useRef, useId, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { ShareButton } from "@/components/sharing/share-buttons";
import { Icon } from "@/components/icon";

export interface BallotCategory {
  id: string;
  name: string;
  description: string | null;
  display_order?: number;
}

export interface BallotNominee {
  id: string;
  category_id: string;
  name: string;
  public_code: string | null;
  image_path: string | null;
  biography?: string | null;
  display_order?: number;
}

export interface PublicBallotProps {
  eventId: string;
  eventName: string;
  eventSlug: string;
  votingMode: "paid" | "free";
  unitPriceMinor: number;
  isOpen: boolean;
  status: string;
  categories: BallotCategory[];
  nominees: BallotNominee[];
  imageUrlByPath: Record<string, string>;
  resultsByNominee: Record<string, number>;
  ussdInfo: { event_code?: string | number } | null;
  votingRules?: string | null;
  eventStartsAt: string;
  eventEndsAt: string;
  eventStatus: string;
  // Free voting specific props
  isFreeVerified?: boolean;
  freeRemaining?: number;
  freeVoteLimit?: number;
  freeVerificationMethod?: string;
  freeVoteCap?: number;
}

export function PublicBallot({
  eventId,
  eventName,
  eventSlug,
  votingMode,
  unitPriceMinor,
  isOpen,
  status,
  categories,
  nominees,
  imageUrlByPath,
  resultsByNominee,
  ussdInfo,
  eventStartsAt,
  eventEndsAt,
  eventStatus,
  isFreeVerified = false,
  freeRemaining = 0,
  freeVerificationMethod = "phone",
}: PublicBallotProps) {
  // Modal state for active nominee being voted on
  const [selectedNominee, setSelectedNominee] = useState<{
    nominee: BallotNominee;
    category: BallotCategory;
  } | null>(null);

  // Telco Mobile Money minimum checkout is GH₵ 1.00 (100 minor)
  const minPaidQuantity = Math.max(1, Math.ceil(100 / Math.max(1, unitPriceMinor)));
  const [quantity, setQuantity] = useState(minPaidQuantity);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const attempt = useRef<{ details: string; key: string } | null>(null);

  // When a nominee is selected, reset quantity to minimum
  const handleOpenVote = (nominee: BallotNominee, category: BallotCategory) => {
    setSelectedNominee({ nominee, category });
    setQuantity(minPaidQuantity);
    setError("");
  };

  const handleCloseVote = () => {
    if (busy) return;
    setSelectedNominee(null);
    setError("");
  };

  // Close modal on Escape
  useEffect(() => {
    if (!selectedNominee) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) handleCloseVote();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [selectedNominee, busy]);

  // Packages for quick select
  const packages = [
    minPaidQuantity,
    minPaidQuantity === 1 ? 5 : minPaidQuantity * 2,
    minPaidQuantity === 1 ? 10 : minPaidQuantity * 5,
    minPaidQuantity === 1 ? 25 : minPaidQuantity * 10,
  ];

  const totalMinor = unitPriceMinor * quantity;
  const totalGhs = (totalMinor / 100).toFixed(2);
  const isBelowMin = totalMinor < 100;

  async function handlePaidSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedNominee) return;

    if (isBelowMin) {
      setError(`Minimum checkout is GH₵ 1.00. Please select at least ${minPaidQuantity} votes.`);
      return;
    }

    setBusy(true);
    setError("");

    try {
      const details = JSON.stringify({
        eventId,
        categoryId: selectedNominee.category.id,
        nomineeId: selectedNominee.nominee.id,
        quantity,
        email,
      });

      if (attempt.current?.details !== details) {
        attempt.current = { details, key: crypto.randomUUID() };
      }

      const r = await fetch("/api/payments/paystack/vote", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          eventId,
          categoryId: selectedNominee.category.id,
          nomineeId: selectedNominee.nominee.id,
          quantity,
          email,
          requestKey: attempt.current.key,
        }),
      });

      const d = await r.json();
      if (!r.ok) {
        throw new Error(d.error || "Unable to start payment");
      }
      window.location.assign(d.authorization_url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to start payment");
      setBusy(false);
    }
  }

  // Group nominees by category
  const nomineesByCategory = new Map<string, BallotNominee[]>();
  for (const n of nominees) {
    nomineesByCategory.set(n.category_id, [...(nomineesByCategory.get(n.category_id) ?? []), n]);
  }

  return (
    <section className="space-y-8">
      {/* Category Section Header */}
      <div className="flex items-center justify-between border-b border-stone-200/80 pb-4 dark:border-[#1c2721]">
        <div>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-800 dark:text-emerald-400">
            The Official Ballot
          </span>
          <h2 className="text-2xl font-serif font-bold text-stone-900 tracking-tight dark:text-white">
            Categories &amp; Nominees
          </h2>
        </div>
        <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold text-stone-700 dark:border-[#1c2721] dark:bg-[#141b16] dark:text-stone-300">
          {categories.length} {categories.length === 1 ? "Category" : "Categories"}
        </span>
      </div>

      {categories.map((category) => {
        const catNominees = nomineesByCategory.get(category.id) ?? [];

        return (
          <section
            key={category.id}
            className="rounded-3xl border border-stone-200/90 bg-white p-5 sm:p-8 shadow-xs space-y-6 dark:border-[#1c2721] dark:bg-[#0c120e]"
          >
            {/* Category Title */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-100 pb-4 dark:border-[#1c2721]">
              <div>
                <h3 className="text-xl font-serif font-bold text-stone-900 dark:text-white">
                  {category.name}
                </h3>
                {category.description && (
                  <p className="mt-1 text-xs text-stone-500 leading-relaxed max-w-2xl dark:text-stone-400">
                    {category.description}
                  </p>
                )}
              </div>
              <span className="text-xs font-semibold text-stone-400 dark:text-stone-400">
                {catNominees.length} {catNominees.length === 1 ? "Nominee" : "Nominees"}
              </span>
            </div>

            {/* Contenders Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
              {catNominees.map((nominee) => {
                const imageUrl = nominee.image_path ? imageUrlByPath[nominee.image_path] : null;
                const voteCount = resultsByNominee[nominee.id];
                const hasResults = typeof voteCount === "number";

                const waDirectUrl = nominee.public_code
                  ? `https://wa.me/233592992566?text=${encodeURIComponent(
                      `VOTE ${ussdInfo?.event_code ?? eventSlug} ${nominee.public_code}`
                    )}`
                  : null;

                return (
                  <article
                    key={nominee.id}
                    className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-stone-200/90 bg-stone-50/40 p-4 transition-all duration-200 hover:border-emerald-500/40 hover:bg-white hover:shadow-md dark:border-[#1c2721] dark:bg-[#0a0d0b] dark:hover:border-emerald-500/30 dark:hover:bg-[#0e1410]"
                  >
                    {/* Nominee Header Card */}
                    <div className="space-y-3">
                      <Link
                        href={`/events/${eventSlug}/nominees/${nominee.id}`}
                        className="flex items-start gap-3.5 group-hover:opacity-95"
                      >
                        {/* Avatar */}
                        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl border border-stone-200 bg-stone-100 shadow-2xs group-hover:scale-105 transition-transform dark:border-[#223028] dark:bg-[#141b16]">
                          {imageUrl ? (
                            <Image
                              src={imageUrl}
                              alt={nominee.name}
                              fill
                              sizes="64px"
                              className="object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center font-serif text-lg font-bold text-emerald-900 bg-emerald-50 dark:bg-emerald-950 dark:text-emerald-300">
                              {nominee.name.trim().slice(0, 1).toUpperCase()}
                            </div>
                          )}
                        </div>

                        {/* Name and Public Code */}
                        <div className="min-w-0 flex-1">
                          <h4 className="font-semibold text-stone-900 text-sm leading-snug group-hover:text-emerald-700 transition-colors line-clamp-2 dark:text-white dark:group-hover:text-emerald-400">
                            {nominee.name}
                          </h4>
                          {nominee.public_code && (
                            <span className="mt-1 inline-block rounded-md bg-stone-200/70 px-2 py-0.5 font-mono text-[10px] font-bold text-stone-800 dark:bg-[#18221b] dark:text-emerald-400">
                              {nominee.public_code}
                            </span>
                          )}
                        </div>

                        <span className="text-stone-300 group-hover:text-stone-600 transition-colors text-xs dark:text-stone-500">
                          ↗
                        </span>
                      </Link>

                      {/* Public Live Results (if visible) */}
                      {hasResults && (
                        <div className="flex items-center justify-between rounded-xl bg-white px-3 py-1.5 text-xs border border-stone-200/60 dark:border-[#1c2721] dark:bg-[#121914]">
                          <span className="text-stone-500 font-medium text-[11px] dark:text-stone-400">
                            Recorded Votes
                          </span>
                          <strong className="font-mono text-stone-900 font-bold dark:text-white">
                            {voteCount.toLocaleString("en-GH")}
                          </strong>
                        </div>
                      )}
                    </div>

                    {/* Voting Action Section */}
                    <div className="mt-4 pt-3 border-t border-stone-200/70 space-y-2 dark:border-[#1c2721]">
                      {isOpen ? (
                        votingMode === "paid" ? (
                          <button
                            type="button"
                            onClick={() => handleOpenVote(nominee, category)}
                            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-900 to-emerald-800 px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:from-emerald-800 hover:to-emerald-700 active:scale-[0.99] transition-all cursor-pointer dark:from-emerald-600 dark:to-emerald-500 dark:hover:from-emerald-500 dark:hover:to-emerald-400"
                          >
                            <span>🗳️ Vote</span>
                            <span className="text-emerald-200 font-normal">
                              · from GH₵ {((minPaidQuantity * unitPriceMinor) / 100).toFixed(2)}
                            </span>
                          </button>
                        ) : isFreeVerified ? (
                          <button
                            type="button"
                            onClick={() => handleOpenVote(nominee, category)}
                            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-800 px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 active:scale-[0.99] transition-all cursor-pointer dark:bg-emerald-600"
                          >
                            <span>🗳️ Cast Free Vote</span>
                            <span className="text-emerald-200 font-normal">
                              ({freeRemaining} remaining)
                            </span>
                          </button>
                        ) : (
                          <a
                            href="#voter-verification"
                            className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl border border-stone-300 bg-white px-4 py-2 text-xs font-bold text-stone-800 shadow-2xs hover:bg-stone-50 transition-all dark:border-[#223028] dark:bg-[#121914] dark:text-stone-200"
                          >
                            <span>Verify to Vote</span>
                            <span>→</span>
                          </a>
                        )
                      ) : (
                        <div className="rounded-xl bg-stone-100 py-2 text-center text-xs font-semibold text-stone-500 dark:bg-[#141b16] dark:text-stone-400">
                          {status}
                        </div>
                      )}

                      {/* Secondary Quick Share & WhatsApp Row */}
                      <div className="flex items-center justify-between gap-2 pt-1 text-[11px]">
                        {waDirectUrl ? (
                          <a
                            href={waDirectUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-stone-600 hover:text-emerald-700 font-medium dark:text-stone-400 dark:hover:text-emerald-400"
                            title={`Vote for ${nominee.name} on WhatsApp`}
                          >
                            <span>💬 WhatsApp</span>
                          </a>
                        ) : (
                          <div />
                        )}

                        <div className="flex items-center gap-2">
                          <ShareButton
                            title={nominee.name}
                            text={`Vote for ${nominee.name} in ${category.name} on VoteCastHub GH`}
                            url={`/events/${eventSlug}/nominees/${nominee.id}`}
                            flyer={{
                              nominee: nominee.name,
                              eventName: eventName,
                              category: category.name,
                              code: nominee.public_code,
                              imageUrl: imageUrl ?? undefined,
                              startsAt: eventStartsAt,
                              endsAt: eventEndsAt,
                              status: eventStatus,
                              votingMode: votingMode,
                              unitPriceMinor: unitPriceMinor,
                              eventCode: ussdInfo?.event_code ? String(ussdInfo.event_code) : eventSlug,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        );
      })}

      {/* ============================================================== */}
      {/* UNIFIED FOCUSED VOTE MODAL / DRAWER */}
      {/* ============================================================== */}
      {selectedNominee && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-200"
          onClick={handleCloseVote}
        >
          <div
            className="relative w-full max-w-md overflow-hidden rounded-3xl border border-stone-200 bg-white p-6 shadow-2xl transition-all duration-200 sm:p-7 dark:border-[#1c2721] dark:bg-[#0c120e] dark:text-stone-100"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              onClick={handleCloseVote}
              disabled={busy}
              className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full border border-stone-200 text-stone-500 hover:bg-stone-100 dark:border-[#223028] dark:text-stone-400 dark:hover:bg-[#18221b] cursor-pointer"
              title="Close modal"
            >
              ✕
            </button>

            {/* Nominee Header */}
            <div className="flex items-center gap-3.5 border-b border-stone-100 pb-4 dark:border-[#1c2721]">
              <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl border border-stone-200 bg-stone-100 dark:border-[#223028] dark:bg-[#141b16]">
                {selectedNominee.nominee.image_path && imageUrlByPath[selectedNominee.nominee.image_path] ? (
                  <Image
                    src={imageUrlByPath[selectedNominee.nominee.image_path]}
                    alt={selectedNominee.nominee.name}
                    fill
                    sizes="56px"
                    className="object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center font-serif text-lg font-bold text-emerald-900 bg-emerald-50 dark:bg-emerald-950 dark:text-emerald-300">
                    {selectedNominee.nominee.name.trim().slice(0, 1).toUpperCase()}
                  </div>
                )}
              </div>

              <div className="min-w-0 pr-6">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-400">
                  {selectedNominee.category.name}
                </span>
                <h3 className="font-serif text-lg font-bold text-stone-900 truncate dark:text-white">
                  {selectedNominee.nominee.name}
                </h3>
                {selectedNominee.nominee.public_code && (
                  <span className="font-mono text-[11px] font-semibold text-stone-500 dark:text-stone-400">
                    Code: {selectedNominee.nominee.public_code}
                  </span>
                )}
              </div>
            </div>

            {/* Voting Form */}
            {votingMode === "paid" ? (
              <form onSubmit={handlePaidSubmit} className="mt-5 space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1.5 text-xs font-semibold text-stone-700 dark:text-stone-300">
                    <label htmlFor="vote-qty">Select Number of Votes</label>
                    <span className="font-mono text-emerald-700 dark:text-emerald-400">
                      GH₵ {(unitPriceMinor / 100).toFixed(2)} / vote
                    </span>
                  </div>

                  {/* Stepper + Input */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setQuantity((q) => Math.max(minPaidQuantity, q - minPaidQuantity))}
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-stone-300 bg-stone-100 text-lg font-bold text-stone-700 hover:bg-stone-200 active:scale-95 transition-all dark:border-[#223028] dark:bg-[#18221b] dark:text-stone-200"
                    >
                      −
                    </button>
                    <input
                      id="vote-qty"
                      type="number"
                      min={minPaidQuantity}
                      max={100000}
                      value={quantity}
                      onChange={(e) => {
                        const val = Number.parseInt(e.target.value, 10);
                        setQuantity(Number.isNaN(val) ? minPaidQuantity : val);
                        setError("");
                      }}
                      className="w-full text-center min-h-11 rounded-xl border border-stone-300 bg-white px-3 py-2 text-base font-bold text-stone-900 focus:border-emerald-600 focus:outline-hidden dark:border-[#223028] dark:bg-[#141b16] dark:text-white"
                    />
                    <button
                      type="button"
                      onClick={() => setQuantity((q) => q + minPaidQuantity)}
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-stone-300 bg-stone-100 text-lg font-bold text-stone-700 hover:bg-stone-200 active:scale-95 transition-all dark:border-[#223028] dark:bg-[#18221b] dark:text-stone-200"
                    >
                      +
                    </button>
                  </div>

                  {/* Preset Quick Packages */}
                  <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                    {packages.map((pkg) => (
                      <button
                        key={pkg}
                        type="button"
                        onClick={() => {
                          setQuantity(pkg);
                          setError("");
                        }}
                        className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer ${
                          quantity === pkg
                            ? "bg-emerald-900 text-white shadow-xs dark:bg-emerald-600"
                            : "bg-stone-100 text-stone-700 hover:bg-stone-200 dark:bg-[#18221b] dark:text-stone-300 dark:hover:bg-[#223028]"
                        }`}
                      >
                        {pkg} votes
                      </button>
                    ))}
                  </div>

                  {/* Telco minimum notice */}
                  {unitPriceMinor < 100 && (
                    <div className="mt-3 rounded-xl bg-amber-50/80 border border-amber-200/80 p-2.5 text-[11px] text-amber-900 leading-tight dark:border-amber-800/40 dark:bg-amber-950/30 dark:text-amber-300">
                      ℹ️ <strong>Mobile Money Notice:</strong> Telcos &amp; Paystack require a minimum checkout of{" "}
                      <strong>GH₵ 1.00</strong>. Minimum purchase is <strong>{minPaidQuantity} votes</strong> (GH₵{" "}
                      {((minPaidQuantity * unitPriceMinor) / 100).toFixed(2)}).
                    </div>
                  )}
                </div>

                {/* Email for receipt */}
                <div>
                  <label htmlFor="vote-email" className="block text-xs font-semibold text-stone-700 mb-1 dark:text-stone-300">
                    Email address for payment receipt
                  </label>
                  <input
                    id="vote-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="voter@example.com"
                    className="w-full min-h-11 rounded-xl border border-stone-300 bg-white px-3.5 py-2 text-sm text-stone-900 focus:border-emerald-600 focus:outline-hidden dark:border-[#223028] dark:bg-[#141b16] dark:text-white"
                  />
                </div>

                {/* Price Breakdown Banner */}
                <div className="flex items-center justify-between rounded-xl bg-stone-100 p-3 text-xs dark:bg-[#141b16]">
                  <span className="text-stone-600 dark:text-stone-400 font-medium">Total to Pay:</span>
                  <span className="font-mono text-base font-extrabold text-emerald-900 dark:text-emerald-400">
                    GH₵ {totalGhs}
                  </span>
                </div>

                {error && (
                  <p className="rounded-xl bg-rose-50 border border-rose-200 p-2.5 text-xs text-rose-700 font-medium dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300">
                    {error}
                  </p>
                )}

                {/* Primary Pay Button */}
                <button
                  type="submit"
                  disabled={busy || isBelowMin}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-900 py-3 px-4 text-sm font-bold text-white shadow-md hover:bg-emerald-800 active:scale-[0.99] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed dark:bg-emerald-600 dark:hover:bg-emerald-500"
                >
                  {busy ? "Opening Paystack…" : `Pay GH₵ ${totalGhs} with Mobile Money / Card`}
                </button>

                <p className="text-center text-[11px] text-stone-400 dark:text-stone-500">
                  🔒 Payments verified instantly via MTN MoMo, Telecel Cash, AT Money &amp; Bank Cards.
                </p>
              </form>
            ) : (
              /* Free Voting Modal placeholder (handles submit via standard free vote form) */
              <div className="mt-5 space-y-4 text-center">
                <p className="text-sm text-stone-600 dark:text-stone-300">
                  Cast your verified free vote for <strong>{selectedNominee.nominee.name}</strong>.
                </p>
                <Link
                  href={`/events/${eventSlug}?nominee=${selectedNominee.nominee.id}#vote`}
                  className="inline-flex w-full items-center justify-center rounded-xl bg-emerald-800 py-3 text-sm font-bold text-white hover:bg-emerald-700"
                >
                  Confirm Free Vote →
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
