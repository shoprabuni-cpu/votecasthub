"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Icon } from "@/components/icon";
import { YouTubeTutorialButton } from "@/components/media/youtube-tutorial";

const WA_NUMBER = "233592992566";
const WA_DISPLAY = "+233 59 299 2566";

function waVoteLink(eventCode: string, nomineeCode = "NOMINEE_CODE") {
  return `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(`VOTE ${eventCode} ${nomineeCode}`)}`;
}

export function WhatsAppVotingInfo({
  eventCode,
  eventSlug,
  eventName,
  votingMode,
  eventStatus,
  configured,
}: {
  eventCode: number | string | null | undefined;
  eventSlug: string;
  eventName: string;
  votingMode: "free" | "paid";
  eventStatus: string;
  configured: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const code = eventCode != null ? String(eventCode) : eventSlug;
  const isActive = ["published", "paused"].includes(eventStatus);
  const freeVoting = votingMode === "free";

  const sampleLink = waVoteLink(code, "01");

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(sampleLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  }

  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-xs sm:p-6">
      <div className="flex items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-green-50/80 p-1">
          <Image
            src="/images/whatsapp-logo.jpg"
            alt="WhatsApp Logo"
            width={36}
            height={36}
            className="rounded-full object-contain"
          />
        </span>
        <div>
          <h2 className="text-lg font-semibold">Vote by WhatsApp</h2>
          <p className="mt-1 text-sm leading-6 text-stone-600">
            Voters send a WhatsApp message to <strong>{WA_DISPLAY}</strong> with the command below.
            No app or account needed beyond WhatsApp.
          </p>
        </div>
      </div>

      {/* Status badge & Video Tutorial */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="inline-flex rounded-full px-3 py-1 text-xs font-semibold
          bg-stone-100 text-stone-700">
          {!configured
            ? "Not configured — add env vars to enable"
            : isActive
            ? "Active — accepting votes"
            : eventStatus === "draft"
            ? "Will activate when event publishes"
            : "Voting closed"}
        </p>
        <YouTubeTutorialButton
          platform="whatsapp"
          label="Watch Video Guide (1 min)"
          variant="secondary"
          size="sm"
        />
      </div>

      {/* Command format */}
      <div className="mt-4 rounded-xl border border-stone-200 bg-stone-50 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Voting command</p>
        <p className="mt-1 font-mono text-sm font-semibold text-stone-900 break-all">
          VOTE {code} &lt;NOMINEE_CODE&gt;{freeVoting ? "" : " <QUANTITY>"}
        </p>
        <p className="mt-1 text-xs text-stone-500">
          Sent to <strong>{WA_DISPLAY}</strong> on WhatsApp.{" "}
          {freeVoting
            ? "Free voting — voters get instant confirmation."
            : "Paid voting — voters receive a MoMo checkout link to complete payment."}
        </p>
      </div>

      {/* Instructions */}
      <ul className="mt-4 space-y-1.5 text-sm text-stone-600">
        <li className="flex items-start gap-2">
          <span className="mt-0.5 text-green-600">1.</span>
          Share the event code <strong>{code}</strong> and each nominee&apos;s code with your audience.
        </li>
        <li className="flex items-start gap-2">
          <span className="mt-0.5 text-green-600">2.</span>
          Voters open WhatsApp, message <strong>{WA_DISPLAY}</strong>:{" "}
          <code className="rounded bg-stone-100 px-1 font-mono text-xs">VOTE {code} 01</code>
        </li>
        <li className="flex items-start gap-2">
          <span className="mt-0.5 text-green-600">3.</span>
          {freeVoting
            ? "They receive an instant reply confirming their vote."
            : "They receive a Paystack MoMo link. Payment completes the vote."}
        </li>
      </ul>

      {/* Quick-vote link example */}
      <div className="mt-5 border-t border-stone-100 pt-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
          Share a one-tap vote link (example for nominee 01)
        </p>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            readOnly
            value={sampleLink}
            className="min-h-11 min-w-0 flex-1 rounded-xl border border-stone-200 bg-white px-3 font-mono text-xs text-stone-700 focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20"
            aria-label="WhatsApp vote link"
            onFocus={(e) => e.target.select()}
          />
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-xs font-semibold text-stone-700 hover:bg-stone-50 cursor-pointer"
          >
            <Icon name={copied ? "check" : "copy"} size={14} />
            <span>{copied ? "Copied!" : "Copy link"}</span>
          </button>
          <a
            href={sampleLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-green-700 bg-green-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-green-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-700"
          >
            <Icon name="phone" size={17} />
            Open in WhatsApp
            <span className="sr-only"> (opens WhatsApp)</span>
          </a>
        </div>
        <p className="mt-1.5 text-xs text-stone-500">
          Replace <code className="rounded bg-stone-100 px-1">01</code> with each nominee&apos;s code when sharing.
        </p>
      </div>

      {/* Footer note */}
      {!configured && (
        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <strong>Setup needed:</strong> Add <code className="font-mono text-xs">WHATSAPP_PHONE_NUMBER_ID</code> and{" "}
          <code className="font-mono text-xs">WHATSAPP_BUSINESS_TOKEN</code> to your environment variables and
          redeploy.
        </p>
      )}
    </section>
  );
}
