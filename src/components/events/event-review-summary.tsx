"use client";

import { motion } from "framer-motion";
import { Icon } from "@/components/icon";

type Props = {
  name: string;
  startsAt: string;
  endsAt: string;
  votingMode: string;
  verificationMethod?: string | null;
  categoryCount: number;
  nomineeCount: number;
  allCategoriesHaveNominees: boolean;
  checkoutReady: boolean;
  smsReady: boolean;
  imageAdded: boolean;
};

const methodLabels: Record<string, string> = {
  phone: "Ghana Phone SMS",
  email: "Email passcode",
  invite_code: "Private access code",
  voter_list: "Approved voter list",
  captcha_limited: "CAPTCHA and rate limits",
};

export function EventReviewSummary({
  name,
  startsAt,
  endsAt,
  votingMode,
  verificationMethod,
  categoryCount,
  nomineeCount,
  allCategoriesHaveNominees,
  checkoutReady,
  smsReady,
  imageAdded,
}: Props) {
  const checks = [
    {
      label: "Ballot Schedule & Dates",
      complete: Boolean(name && startsAt && endsAt),
      detail: startsAt && endsAt ? "Scheduled in Ghana GMT window" : "Event name and dates required",
      critical: true,
    },
    {
      label: "Categories & Nominees",
      complete: categoryCount > 0 && allCategoriesHaveNominees,
      detail:
        categoryCount > 0 && allCategoriesHaveNominees
          ? `${categoryCount} categor${categoryCount === 1 ? "y" : "ies"} · ${nomineeCount} active nominees`
          : "Every category needs at least 1 nominee",
      critical: true,
    },
    {
      label: "Voting Model Config",
      complete: Boolean(votingMode),
      detail:
        votingMode === "paid"
          ? "Paid Mobile Money & Card ballot"
          : `Free ballot · ${methodLabels[verificationMethod ?? "phone"] ?? "Verified voter"}`,
      critical: true,
    },
    {
      label: "Paystack Payment Connection",
      complete: votingMode !== "paid" || checkoutReady,
      detail:
        votingMode === "paid"
          ? checkoutReady
            ? "Paystack gateway verified"
            : "Connect Paystack in Org Settings"
          : "Not required for free voting",
      critical: votingMode === "paid",
    },
    {
      label: "SMS Verification Credits",
      complete: votingMode !== "free" || verificationMethod !== "phone" || smsReady,
      detail:
        verificationMethod === "phone" && votingMode === "free"
          ? smsReady
            ? "Credits ready for Ghana SMS delivery"
            : "Top up credits before publishing"
          : "Not needed for selected method",
      critical: votingMode === "free" && verificationMethod === "phone",
    },
    {
      label: "Cover Image / Branding",
      complete: imageAdded,
      detail: imageAdded ? "Custom event cover uploaded" : "Optional · Great for social sharing",
      critical: false,
    },
  ];

  const totalRequired = checks.filter((c) => c.critical).length;
  const completedRequired = checks.filter((c) => c.critical && c.complete).length;
  const isAllReady = completedRequired === totalRequired;
  const progressPercent = Math.round((completedRequired / totalRequired) * 100);

  return (
    <section className="rounded-2xl border border-stone-200/90 bg-white p-5 sm:p-7 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-100 pb-5">
        <div>
          <div className="flex items-center gap-2 text-emerald-800 text-xs font-semibold uppercase tracking-wider">
            <Icon name="sparkle" size={13} />
            <span>Pre-Launch Readiness</span>
          </div>
          <h3 className="mt-1 text-xl font-serif font-medium text-stone-900 tracking-tight">
            Review checklist before voters arrive
          </h3>
          <p className="mt-0.5 text-xs text-stone-500">
            {name || "Untitled event"} ·{" "}
            {startsAt ? new Date(startsAt).toLocaleDateString("en-GH", { month: "short", day: "numeric" }) : "No date"} →{" "}
            {endsAt ? new Date(endsAt).toLocaleDateString("en-GH", { month: "short", day: "numeric", year: "numeric" }) : "No date"}
          </p>
        </div>

        {/* Progress pill & bar */}
        <div className="sm:text-right">
          <div className="inline-flex items-center gap-2 rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold text-stone-800">
            <span className={`h-2 w-2 rounded-full ${isAllReady ? "bg-emerald-600 animate-pulse" : "bg-amber-500"}`} />
            <span>{isAllReady ? "Ready to Publish" : `${completedRequired} of ${totalRequired} Requirements Met`}</span>
          </div>
          <div className="mt-2 h-1.5 w-36 sm:ml-auto rounded-full bg-stone-100 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progressPercent}%` }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className={`h-full rounded-full ${isAllReady ? "bg-emerald-600" : "bg-amber-500"}`}
            />
          </div>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-3">
        {checks.map((item, idx) => (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.04 }}
            className={`flex items-start gap-3 rounded-xl border p-3.5 transition-all ${
              item.complete
                ? "border-emerald-200/80 bg-emerald-50/20"
                : item.critical
                ? "border-amber-200 bg-amber-50/20"
                : "border-stone-200 bg-stone-50/30"
            }`}
          >
            <div
              className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                item.complete
                  ? "bg-emerald-700 text-white shadow-2xs"
                  : item.critical
                  ? "bg-amber-500 text-white"
                  : "bg-stone-300 text-stone-700"
              }`}
            >
              {item.complete ? <Icon name="check" size={12} /> : "!"}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-stone-900 truncate">{item.label}</span>
                <span
                  className={`text-[10px] font-semibold uppercase tracking-wider ${
                    item.complete
                      ? "text-emerald-800"
                      : item.critical
                      ? "text-amber-800"
                      : "text-stone-400"
                  }`}
                >
                  {item.complete ? "Ready" : item.critical ? "Action needed" : "Optional"}
                </span>
              </div>
              <p className="mt-0.5 text-[11px] text-stone-500 leading-tight">{item.detail}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
