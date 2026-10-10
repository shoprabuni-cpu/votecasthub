export type EventNextStep = {
  title: string; description: string; label: string;
  section?: "details" | "nominees" | "voting"; editor?: boolean; href?: string;
};

export function eventNextStep(input: {
  status: string; expired: boolean; scheduled: boolean; datesReady: boolean;
  categoryCount: number; nomineesReady: boolean; checkoutReady: boolean;
  verificationReady: boolean; votingMode: "free" | "paid"; canReopen: boolean;
  organizationId: string;
}): EventNextStep {
  const { status, organizationId } = input;
  if (status === "draft") {
    if (!input.datesReady) return { title: "Choose your voting dates", description: "Set an opening time and a future closing time so voters know when to take part.", label: "Set voting dates", section: "details", editor: true };
    if (!input.categoryCount) return { title: "Add your first category", description: "Start with a category such as Best New Artist, then add the people voters can choose.", label: "Add a category", section: "nominees" };
    if (!input.nomineesReady) return { title: "Give voters someone to choose", description: "Add at least one active nominee to every active category.", label: "Add nominees", section: "nominees" };
    if (!input.checkoutReady) return input.votingMode === "paid" ? { title: "Connect your payment account", description: "A verified payout account is needed before paid voting can be approved.", label: "Set up payments", href: `/organizer/${organizationId}/payments` } : { title: "Choose how people can vote", description: "Set a voting rule and allowance that fit your event.", label: "Set voting rules", section: "details", editor: true };
    if (!input.verificationReady) return { title: "Finish voter access setup", description: "Check your verification method and complete any required voter list or access codes.", label: "Set up voter access", section: "voting" };
    return { title: "Your event is ready for review", description: "Preview the voter page, then submit your event for approval. You can add a cover image and description later.", label: "Review and submit", section: "voting" };
  }
  if (status === "pending_review") return { title: "Your event is awaiting approval", description: "We’ll notify you when it’s reviewed. Check the conversation below for feedback or questions.", label: "View review messages", href: "#review-feedback" };
  if (status === "closed" || status === "archived") return { title: "Your event history is safe", description: "Review the results and performance of your event. Recorded votes and payments are preserved.", label: "View analytics", href: `/organizer/${organizationId}/analytics` };
  if (input.expired) return { title: "Voting has ended", description: input.canReopen ? "Review your results, or reopen voting with a new deadline and a public explanation." : "Review your results. An owner or admin can reopen eligible events.", label: input.canReopen ? "Manage reopening" : "View analytics", ...(input.canReopen ? { section: "voting" as const } : { href: `/organizer/${organizationId}/analytics` }) };
  if (status === "paused") return { title: "Voting is taking a break", description: "Your existing votes are safe. Resume voting when you’re ready, or extend the deadline while keeping it paused.", label: "Manage voting", section: "voting" };
  return { title: input.scheduled ? "Build excitement before voting opens" : "Your event is open for voting", description: input.scheduled ? "Share your voter page now so people can meet the nominees before opening time." : "Send the voting link to your audience and keep an eye on your results.", label: "Share voting link", href: "#share-event" };
}
