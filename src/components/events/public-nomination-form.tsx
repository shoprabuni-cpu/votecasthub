"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { submitNominationAction, type NominationActionState } from "@/lib/nominations/actions";
import { compressImageFile } from "@/lib/images/client-compress";
import { Icon } from "@/components/icon";

export interface NominationCategory {
  id: string;
  name: string;
  description: string | null;
}

export function PublicNominationForm({
  eventId,
  eventSlug,
  eventName,
  feeMinor,
  allowSelfNomination = true,
  allowThirdPartyNomination = true,
  categories,
}: {
  eventId: string;
  eventSlug: string;
  eventName: string;
  feeMinor: number;
  allowSelfNomination?: boolean;
  allowThirdPartyNomination?: boolean;
  categories: NominationCategory[];
}) {
  const [selectedCategory, setSelectedCategory] = useState(categories[0]?.id || "");
  const [nominatorType, setNominatorType] = useState<"self" | "third_party">("self");
  const [nomineeName, setNomineeName] = useState("");
  const [nomineePhone, setNomineePhone] = useState("");
  const [nomineeEmail, setNomineeEmail] = useState("");
  const [nomineeBio, setNomineeBio] = useState("");
  const [portfolioUrl, setPortfolioUrl] = useState("");
  const [nominatorName, setNominatorName] = useState("");
  const [nominatorPhone, setNominatorPhone] = useState("");

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [compressedFile, setCompressedFile] = useState<File | null>(null);
  const [compressing, setCompressing] = useState(false);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<{
    nominationId: string;
    message: string;
  } | null>(null);

  const feeGhs = (feeMinor / 100).toFixed(2);
  const hasFee = feeMinor > 0;

  async function handleImagePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setCompressing(true);
    setError(null);
    try {
      const compressed = await compressImageFile(file, 1000, 0.85);
      setCompressedFile(compressed);
      setPreviewUrl(URL.createObjectURL(compressed));
    } catch {
      setError("Unable to process image. Please choose another photo.");
    } finally {
      setCompressing(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || compressing) return;

    if (!selectedCategory) {
      setError("Please select a nomination category.");
      return;
    }
    if (!nomineeName.trim() || nomineeName.trim().length < 2) {
      setError("Please enter the candidate's full name or stage name.");
      return;
    }
    if (!nomineePhone.trim()) {
      setError("Please enter a valid phone number for verification.");
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("eventId", eventId);
      formData.append("eventSlug", eventSlug);
      formData.append("categoryId", selectedCategory);
      formData.append("nomineeName", nomineeName.trim());
      formData.append("nomineePhone", nomineePhone.trim());
      if (nomineeEmail.trim()) formData.append("nomineeEmail", nomineeEmail.trim());
      if (nomineeBio.trim()) formData.append("nomineeBio", nomineeBio.trim());
      if (portfolioUrl.trim()) formData.append("portfolioUrl", portfolioUrl.trim());
      formData.append("nominatorType", nominatorType);
      if (nominatorType === "third_party") {
        if (nominatorName.trim()) formData.append("nominatorName", nominatorName.trim());
        if (nominatorPhone.trim()) formData.append("nominatorPhone", nominatorPhone.trim());
      }
      if (compressedFile) {
        formData.append("photo", compressedFile);
      }

      const res = await submitNominationAction({} as NominationActionState, formData);

      if (res?.error) {
        setError(res.error);
        setBusy(false);
        return;
      }

      if (res?.requiresPayment && res.authorizationUrl) {
        // Redirect to Paystack Mobile Money checkout
        window.location.assign(res.authorizationUrl);
        return;
      }

      if (res?.success && res.nominationId) {
        setSuccessResult({
          nominationId: res.nominationId,
          message: res.message || "Your nomination has been filed successfully!",
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to submit nomination.");
    } finally {
      setBusy(false);
    }
  }

  if (successResult) {
    return (
      <div className="rounded-3xl border border-stone-200/90 bg-white p-6 sm:p-10 text-center shadow-sm space-y-6 dark:border-[#1c2721] dark:bg-[#0c120e]">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100 text-3xl text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
          ✓
        </div>
        <div className="space-y-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-400">
            Filing Confirmed
          </span>
          <h2 className="font-serif text-2xl sm:text-3xl font-bold text-stone-900 dark:text-white">
            Nomination Received!
          </h2>
          <p className="mx-auto max-w-md text-xs sm:text-sm text-stone-600 leading-relaxed dark:text-stone-300">
            {successResult.message}
          </p>
        </div>

        <div className="rounded-2xl border border-stone-200/80 bg-stone-50 p-4 text-xs font-mono text-stone-700 dark:border-[#1c2721] dark:bg-[#121914] dark:text-stone-300">
          Reference Code: <strong>NOM-{successResult.nominationId.slice(0, 8).toUpperCase()}</strong>
        </div>

        <p className="text-xs text-stone-500 max-w-md mx-auto dark:text-stone-400">
          The event vetting committee will review this submission. You will receive an SMS confirmation once your nomination is approved for the ballot.
        </p>

        <div className="pt-2">
          <Link
            href={`/events/${eventSlug}`}
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-emerald-900 px-6 py-2.5 text-xs font-bold text-white shadow-md hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 transition-all cursor-pointer"
          >
            ← Return to {eventName}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="rounded-3xl border border-stone-200/90 bg-white p-6 sm:p-8 shadow-xs space-y-6 dark:border-[#1c2721] dark:bg-[#0c120e]">
        {/* Step 1: Category */}
        <div>
          <label htmlFor="nomination-category" className="block text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300 mb-2">
            1. Select Award Category <span className="text-rose-600">*</span>
          </label>
          <select
            id="nomination-category"
            required
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full min-h-12 rounded-xl border border-stone-300 bg-white px-4 py-3 text-sm font-semibold text-stone-900 focus:border-emerald-600 focus:outline-hidden dark:border-[#223028] dark:bg-[#141b16] dark:text-white"
          >
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>

        {/* Nominator Type Selector */}
        {allowSelfNomination && allowThirdPartyNomination && (
          <div>
            <span className="block text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300 mb-2">
              Who is submitting this nomination?
            </span>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setNominatorType("self")}
                className={`flex items-center justify-center gap-2 rounded-xl border p-3 text-xs font-bold transition-all cursor-pointer ${
                  nominatorType === "self"
                    ? "border-emerald-700 bg-emerald-50/80 text-emerald-900 dark:border-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300 shadow-2xs"
                    : "border-stone-200 bg-stone-50 text-stone-600 hover:bg-stone-100 dark:border-[#1c2721] dark:bg-[#121914] dark:text-stone-400"
                }`}
              >
                <span>👤 Self-Nomination</span>
              </button>
              <button
                type="button"
                onClick={() => setNominatorType("third_party")}
                className={`flex items-center justify-center gap-2 rounded-xl border p-3 text-xs font-bold transition-all cursor-pointer ${
                  nominatorType === "third_party"
                    ? "border-emerald-700 bg-emerald-50/80 text-emerald-900 dark:border-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300 shadow-2xs"
                    : "border-stone-200 bg-stone-50 text-stone-600 hover:bg-stone-100 dark:border-[#1c2721] dark:bg-[#121914] dark:text-stone-400"
                }`}
              >
                <span>👥 Nominating Someone Else</span>
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Nominee Identity */}
        <div className="space-y-4 pt-2 border-t border-stone-100 dark:border-[#1c2721]">
          <span className="block text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300">
            2. Candidate Profile &amp; Contact
          </span>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="nominee-name" className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                Candidate Name / Stage Name <span className="text-rose-600">*</span>
              </label>
              <input
                id="nominee-name"
                type="text"
                required
                value={nomineeName}
                onChange={(e) => setNomineeName(e.target.value)}
                placeholder="e.g. Enock Ofori"
                className="w-full min-h-11 rounded-xl border border-stone-300 bg-white px-3.5 py-2.5 text-sm text-stone-900 focus:border-emerald-600 focus:outline-hidden dark:border-[#223028] dark:bg-[#141b16] dark:text-white"
              />
            </div>

            <div>
              <label htmlFor="nominee-phone" className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                Candidate Ghana Phone / MoMo <span className="text-rose-600">*</span>
              </label>
              <input
                id="nominee-phone"
                type="tel"
                required
                value={nomineePhone}
                onChange={(e) => setNomineePhone(e.target.value)}
                placeholder="0241234567"
                className="w-full min-h-11 rounded-xl border border-stone-300 bg-white px-3.5 py-2.5 text-sm text-stone-900 focus:border-emerald-600 focus:outline-hidden dark:border-[#223028] dark:bg-[#141b16] dark:text-white"
              />
            </div>
          </div>

          <div>
            <label htmlFor="nominee-email" className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
              Email Address (Optional)
            </label>
            <input
              id="nominee-email"
              type="email"
              value={nomineeEmail}
              onChange={(e) => setNomineeEmail(e.target.value)}
              placeholder="candidate@example.com"
              className="w-full min-h-11 rounded-xl border border-stone-300 bg-white px-3.5 py-2.5 text-sm text-stone-900 focus:border-emerald-600 focus:outline-hidden dark:border-[#223028] dark:bg-[#141b16] dark:text-white"
            />
          </div>

          {/* Photo Uploader */}
          <div>
            <span className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1.5">
              Candidate Photo / Headshot
            </span>
            <div className="flex items-center gap-4">
              <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl border-2 border-dashed border-stone-300 bg-stone-100 dark:border-[#223028] dark:bg-[#141b16]">
                {previewUrl ? (
                  <Image src={previewUrl} alt="Preview" fill className="object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-stone-400">
                    <Icon name="user" size={24} />
                  </div>
                )}
              </div>
              <div className="flex-1">
                <label className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-stone-300 bg-white px-4 py-2 text-xs font-semibold text-stone-800 shadow-2xs hover:bg-stone-50 cursor-pointer dark:border-[#223028] dark:bg-[#121914] dark:text-stone-200">
                  <span>{compressing ? "Compressing…" : previewUrl ? "Change Photo" : "Upload Candidate Photo"}</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImagePick}
                    className="sr-only"
                    disabled={compressing || busy}
                  />
                </label>
                <p className="mt-1 text-[11px] text-stone-500 dark:text-stone-400">
                  Compressed automatically to high-efficiency WebP.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Step 3: Evidence & Bio */}
        <div className="space-y-4 pt-2 border-t border-stone-100 dark:border-[#1c2721]">
          <span className="block text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300">
            3. Achievements &amp; Evidence
          </span>

          <div>
            <label htmlFor="nominee-bio" className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
              Why should this candidate be shortlisted? (Bio / Achievements)
            </label>
            <textarea
              id="nominee-bio"
              rows={3}
              value={nomineeBio}
              onChange={(e) => setNomineeBio(e.target.value)}
              placeholder="Provide a brief summary of key contributions, achievements, or why this nominee deserves recognition..."
              className="w-full rounded-xl border border-stone-300 bg-white px-3.5 py-2.5 text-xs text-stone-900 focus:border-emerald-600 focus:outline-hidden dark:border-[#223028] dark:bg-[#141b16] dark:text-white"
            />
          </div>

          <div>
            <label htmlFor="portfolio-url" className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
              Portfolio / Work / Social Profile Link (Optional)
            </label>
            <input
              id="portfolio-url"
              type="url"
              value={portfolioUrl}
              onChange={(e) => setPortfolioUrl(e.target.value)}
              placeholder="https://instagram.com/candidate or project website"
              className="w-full min-h-11 rounded-xl border border-stone-300 bg-white px-3.5 py-2.5 text-sm text-stone-900 focus:border-emerald-600 focus:outline-hidden dark:border-[#223028] dark:bg-[#141b16] dark:text-white"
            />
          </div>
        </div>

        {/* Nominator Information (if nominating someone else) */}
        {nominatorType === "third_party" && (
          <div className="space-y-4 pt-2 border-t border-stone-100 dark:border-[#1c2721]">
            <span className="block text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300">
              Your Details (The Nominator)
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="nominator-name" className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                  Your Name
                </label>
                <input
                  id="nominator-name"
                  type="text"
                  value={nominatorName}
                  onChange={(e) => setNominatorName(e.target.value)}
                  placeholder="e.g. Kofi Mensah"
                  className="w-full min-h-11 rounded-xl border border-stone-300 bg-white px-3.5 py-2.5 text-sm text-stone-900 focus:border-emerald-600 focus:outline-hidden dark:border-[#223028] dark:bg-[#141b16] dark:text-white"
                />
              </div>
              <div>
                <label htmlFor="nominator-phone" className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                  Your Phone Number
                </label>
                <input
                  id="nominator-phone"
                  type="tel"
                  value={nominatorPhone}
                  onChange={(e) => setNominatorPhone(e.target.value)}
                  placeholder="0501234567"
                  className="w-full min-h-11 rounded-xl border border-stone-300 bg-white px-3.5 py-2.5 text-sm text-stone-900 focus:border-emerald-600 focus:outline-hidden dark:border-[#223028] dark:bg-[#141b16] dark:text-white"
                />
              </div>
            </div>
          </div>
        )}

        {/* Pricing Breakdown Banner */}
        <div className="rounded-2xl border border-stone-200/80 bg-stone-50 p-4 text-xs dark:border-[#1c2721] dark:bg-[#121914] flex items-center justify-between">
          <span className="font-semibold text-stone-700 dark:text-stone-300">
            Nomination Filing Fee:
          </span>
          <span className="font-mono text-base font-extrabold text-emerald-800 dark:text-emerald-400">
            {hasFee ? `GH₵ ${feeGhs}` : "FREE"}
          </span>
        </div>

        {error && (
          <p className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy || compressing}
          className="w-full inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-emerald-900 py-3.5 px-6 text-sm font-bold text-white shadow-md hover:bg-emerald-800 active:scale-[0.99] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed dark:bg-emerald-600 dark:hover:bg-emerald-500"
        >
          {busy ? (
            <>
              <Icon name="refresh" size={16} className="animate-spin" />
              <span>{hasFee ? "Connecting to Paystack…" : "Filing Nomination…"}</span>
            </>
          ) : hasFee ? (
            <span>Pay GH₵ {feeGhs} &amp; Submit Nomination →</span>
          ) : (
            <span>Submit Nomination Entry ✓</span>
          )}
        </button>

        <p className="text-center text-[11px] text-stone-400 dark:text-stone-500">
          🔒 Submissions are reviewed by the official event committee before being added to the live ballot.
        </p>
      </div>
    </form>
  );
}
