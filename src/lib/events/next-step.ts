export type EventNextStep = {
  title: string; description: string; label: string;
  section?: "details" | "nominees" | "voting" | "review" | "tickets"; editor?: boolean; href?: string;
};

export function eventNextStep(input: {
  status: string; expired: boolean; scheduled: boolean; datesReady: boolean;
  categoryCount: number; nomineesReady: boolean; checkoutReady: boolean;
  verificationReady: boolean; votingMode: "free" | "paid"; canReopen: boolean;
  organizationId: string;
  isTicketOnly?: boolean;
  tiersReady?: boolean;
  venueReady?: boolean;
}): EventNextStep {
  const { status, organizationId, isTicketOnly = false } = input;
  if (status === "draft") {
    if (isTicketOnly) {
      if (!input.datesReady) return { title: "Choose your event dates", description: "Set the start time and end time for your ticketed event.", label: "Set event dates", section: "details", editor: true };
      if (!input.venueReady) return { title: "Specify event venue", description: "Add the venue name (and optional address) so attendees know where to go.", label: "Set venue details", section: "details", editor: true };
      if (!input.tiersReady) return { title: "Set up your ticket tiers", description: "Add at least one active ticket tier (e.g. Regular, VIP, Table) with price and capacity.", label: "Manage ticket tiers", section: "tickets" };
      return { title: "Your ticketed event is ready", description: "Preview your ticket sales page, then submit your event for approval.", label: "Review and submit", section: "review" };
    }
    if (!input.datesReady) return { title: "Choose your voting dates", description: "Set an opening time and a future closing time so voters know when to take part.", label: "Set voting dates", section: "details", editor: true };
    if (!input.categoryCount) return { title: "Add your first category", description: "Start with a category such as Best New Artist, then add the people voters can choose.", label: "Add a category", section: "nominees" };
    if (!input.nomineesReady) return { title: "Give voters someone to choose", description: "Add at least one active nominee to every active category.", label: "Add nominees", section: "nominees" };
    if (!input.checkoutReady) return input.votingMode === "paid" ? { title: "Connect your payment account", description: "A verified payout account is needed before paid voting can be approved.", label: "Set up payments", href: `/organizer/${organizationId}/payments` } : { title: "Choose how people can vote", description: "Set a voting rule and allowance that fit your event.", label: "Set voting rules", section: "details", editor: true };
    if (!input.verificationReady) return { title: "Finish voter access setup", description: "Check your verification method and complete any required voter list or access codes.", label: "Set up voter access", section: "voting" };
    return { title: "Your event is ready for review", description: "Preview the voter page, then submit your event for approval. You can add a cover image and description later.", label: "Review and submit", section: "review" };
  }
  if (status === "pending_review") return { title: "Your event is awaiting approval", description: "We’ll notify you when it’s reviewed. Check the conversation below for feedback or questions.", label: "View review messages", href: "#review-feedback" };
  if (status === "closed" || status === "archived") return { title: "Your event is closed", description: "Review your results or delete the event below when you’re finished. Payment records remain available in Payments.", label: "View analytics", href: `/organizer/${organizationId}/analytics` };
  if (input.expired) return { title: isTicketOnly ? "Ticket sales have ended" : "Voting has ended", description: input.canReopen ? "Review your results, or reopen with a new deadline." : "Review your results.", label: input.canReopen ? "Manage event" : "View analytics", ...(input.canReopen ? { section: isTicketOnly ? ("tickets" as const) : ("voting" as const) } : { href: `/organizer/${organizationId}/analytics` }) };
  if (status === "paused") return { title: isTicketOnly ? "Ticket sales are paused" : "Voting is taking a break", description: isTicketOnly ? "Existing issued tickets remain valid. Resume sales when you’re ready." : "Your existing votes are safe. Resume voting when you’re ready, or extend the deadline while keeping it paused.", label: isTicketOnly ? "Manage tickets" : "Manage voting", section: isTicketOnly ? "tickets" : "voting" };
  return { title: input.scheduled ? (isTicketOnly ? "Build excitement before ticket sales open" : "Build excitement before voting opens") : (isTicketOnly ? "Ticket sales are live" : "Your event is open for voting"), description: isTicketOnly ? "Share your tickets link with attendees to start selling entrance passes." : (input.scheduled ? "Share your voter page now so people can meet the nominees before opening time." : "Send the voting link to your audience and keep an eye on your results."), label: isTicketOnly ? "Share tickets link" : "Share voting link", href: "#share-event" };
}
