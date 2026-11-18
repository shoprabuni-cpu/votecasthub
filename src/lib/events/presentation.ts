export type EventTiming = {
  status: string;
  starts_at: string;
  ends_at: string;
  event_type?: string | null;
};

export function eventPresentation(event: EventTiming, now = Date.now()) {
  const isTicketing = event.event_type === "ticketing";

  if (event.status === "archived") {
    return {
      key: "closed",
      label: "Event archived",
      title: "Thank you for being part of this event.",
      message: isTicketing
        ? "This event has been archived. Ticket sales are closed."
        : "This event has been archived. Voting is no longer available.",
      cta: "Explore the event",
    };
  }

  if (event.status === "closed" || now >= Date.parse(event.ends_at)) {
    return {
      key: "closed",
      label: isTicketing ? "Ticket sales closed" : "Voting closed",
      title: isTicketing ? "Ticket sales have ended." : "Voting has ended. Thank you for your support!",
      message: isTicketing
        ? "Ticket sales for this event have closed. If you already purchased a ticket, your pass remains valid."
        : "New votes are no longer accepted. If you already paid, check your payment confirmation before trying again.",
      cta: isTicketing ? "View event" : "Celebrate the nominees",
    };
  }

  if (event.status === "paused") {
    return {
      key: "paused",
      label: isTicketing ? "Tickets paused" : "Voting paused",
      title: isTicketing ? "Ticket sales are paused." : "Voting is taking a short pause.",
      message: isTicketing
        ? "The organizer has temporarily paused ticket sales. Please check back shortly."
        : "The organizer has temporarily paused voting. Your recorded votes are safe. Please check back for updates.",
      cta: isTicketing ? "View event" : "Meet the nominees",
    };
  }

  if (isTicketing) {
    if (event.status === "draft") {
      return {
        key: "upcoming",
        label: "Tickets not on sale",
        title: "Ticket sales opening soon.",
        message: "This event is currently in draft. Official entry tickets will be available once published.",
        cta: "View event",
      };
    }
    // Published ticketing event: tickets are on sale before and during the event!
    return {
      key: "open",
      label: "Tickets on sale",
      title: "Get your official entry tickets.",
      message: "Select your preferred ticket tier below to secure your entry pass.",
      cta: "Get Tickets",
    };
  }

  // Standard voting events
  if (event.status === "draft" || now < Date.parse(event.starts_at)) {
    return {
      key: "upcoming",
      label: "Voting opens soon",
      title: "Get ready to support your favourite.",
      message: "Meet the nominees and share their profiles. Voting will open at the Ghana time shown below.",
      cta: "Meet the nominees",
    };
  }

  return {
    key: "open",
    label: "Voting open",
    title: "Your favourite is counting on you.",
    message: "Choose a nominee below to cast your vote. Every successfully recorded vote counts.",
    cta: "Vote for your favourite",
  };
}
export function ghanaDate(value: string) {
  return new Intl.DateTimeFormat("en-GH", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Accra" }).format(new Date(value));
}
