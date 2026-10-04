export type EventTiming = { status: string; starts_at: string; ends_at: string };
export function eventPresentation(event: EventTiming, now = Date.now()) {
  if (event.status === "archived") return { key: "closed", label: "Event archived", title: "Thank you for being part of this event.", message: "This event has been archived. Voting is no longer available.", cta: "Explore the event" };
  if (event.status === "closed" || now >= Date.parse(event.ends_at)) return { key: "closed", label: "Voting closed", title: "Voting has ended. Thank you for your support!", message: "New votes are no longer accepted. If you already paid, check your payment confirmation before trying again.", cta: "Celebrate the nominees" };
  if (event.status === "paused") return { key: "paused", label: "Voting paused", title: "Voting is taking a short pause.", message: "The organizer has temporarily paused voting. Your recorded votes are safe. Please check back for updates.", cta: "Meet the nominees" };
  if (event.status === "draft" || now < Date.parse(event.starts_at)) return { key: "upcoming", label: "Voting opens soon", title: "Get ready to support your favourite.", message: "Meet the nominees and share their profiles. Voting will open at the Ghana time shown below.", cta: "Meet the nominees" };
  return { key: "open", label: "Voting open", title: "Your favourite is counting on you.", message: "Choose a nominee below to cast your vote. Every successfully recorded vote counts.", cta: "Vote for your favourite" };
}
export function ghanaDate(value: string) {
  return new Intl.DateTimeFormat("en-GH", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Accra" }).format(new Date(value));
}
