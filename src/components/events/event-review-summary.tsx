type Props = { name: string; startsAt: string; endsAt: string; votingMode: string; verificationMethod?: string | null; categoryCount: number; nomineeCount: number; allCategoriesHaveNominees: boolean; checkoutReady: boolean; smsReady: boolean; imageAdded: boolean };

const methodLabels: Record<string, string> = { phone: "Phone SMS", email: "Email code", invite_code: "Private access code", voter_list: "Approved voter list", captcha_limited: "CAPTCHA and rate limits" };

export function EventReviewSummary({ name, startsAt, endsAt, votingMode, verificationMethod, categoryCount, nomineeCount, allCategoriesHaveNominees, checkoutReady, smsReady, imageAdded }: Props) {
  const checks = [
    ["Event details", Boolean(name && startsAt && endsAt), "Name, dates, and instructions are ready"],
    ["Categories and nominees", categoryCount > 0 && allCategoriesHaveNominees, `${categoryCount} categor${categoryCount === 1 ? "y" : "ies"} · ${nomineeCount} active nominees`],
    ["Voting setup", Boolean(votingMode), votingMode === "paid" ? "Paid voting" : `Free voting · ${methodLabels[verificationMethod ?? "phone"] ?? "Verified voter"}`],
    ["Payment connection", votingMode !== "paid" || checkoutReady, votingMode === "paid" ? "Verified Paystack account required" : "Not needed for free voting"],
    ["SMS credits", votingMode !== "free" || verificationMethod !== "phone" || smsReady, verificationMethod === "phone" && votingMode === "free" ? "One credit is reserved per SMS attempt" : "Not needed for this method"],
    ["Cover image", imageAdded, "Optional · recommended for sharing"],
  ] as const;
  return <section className="event-review-summary" aria-labelledby="event-review-title"><div className="panel-heading"><p className="eyebrow">FINAL CHECK</p><h3 id="event-review-title">Review before you submit</h3><p>Check these details before your event goes to voters.</p></div><div className="review-summary-meta"><span><strong>{name || "Untitled event"}</strong></span><span>{startsAt ? new Date(startsAt).toLocaleString("en-GH", { dateStyle: "medium" }) : "Start date missing"} → {endsAt ? new Date(endsAt).toLocaleString("en-GH", { dateStyle: "medium" }) : "End date missing"}</span></div><ul className="review-check-list">{checks.map(([label, complete, detail]) => <li key={label} className={complete ? "is-complete" : "is-pending"}><span className="review-check-icon" aria-hidden="true">{complete ? "✓" : "!"}</span><span><strong>{label}</strong><small>{detail}</small></span><em>{complete ? "Ready" : "Action needed"}</em></li>)}</ul></section>;
}
