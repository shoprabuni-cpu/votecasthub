export type VotingRule = "one_per_category" | "category_limit" | "per_nominee_limit";

export const votingRuleOptions: Array<{ value: VotingRule; label: string; description: string }> = [
  {
    value: "one_per_category",
    label: "One vote per category",
    description: "Each verified phone gets one vote total in each category.",
  },
  {
    value: "category_limit",
    label: "Vote cap per category",
    description: "Set the total number of votes a verified phone can cast across nominees in each category.",
  },
  {
    value: "per_nominee_limit",
    label: "Vote cap per nominee",
    description: "Set how many times a verified phone may vote for each nominee in each category.",
  },
];

export function isVotingRule(value: string): value is VotingRule {
  return votingRuleOptions.some((option) => option.value === value);
}

export function votingRuleSummary(rule: VotingRule, limit: number | null) {
  if (rule === "one_per_category") {
    return "Each verified phone may cast one free vote total in each category. A submitted vote cannot be changed.";
  }
  if (rule === "per_nominee_limit") {
    return `Each verified phone may cast up to ${limit ?? 1} free vote${limit === 1 ? "" : "s"} for each nominee in each category.`;
  }
  return `Each verified phone may cast up to ${limit ?? 1} free vote${limit === 1 ? "" : "s"} total in each category, across nominees.`;
}
