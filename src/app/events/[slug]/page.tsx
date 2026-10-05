import type { Metadata } from "next";
import { randomUUID } from "node:crypto";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { FreeVoteForm } from "@/components/voting/free-vote-form";
import { PaidVoteForm } from "@/components/voting/paid-vote-form";
import { createClient } from "@/lib/supabase/server";
import { votingRuleSummary, type VotingRule } from "@/lib/voting-rules";
import { EventNotices } from "@/components/events/event-notices";
import { VotingNotice } from "@/components/events/voting-notice";
import { eventPresentation } from "@/lib/events/presentation";
import { ShareButton } from "@/components/sharing/share-buttons";
import { EventViewTracker } from "@/components/analytics/event-view-tracker";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  try {
    const supabase = await createClient();
    const { data } = await supabase.from("events").select("name, description").eq("slug", slug).in("status", ["published", "paused", "closed"]).maybeSingle();
    return { title: data?.name ?? "Event", description: data?.description ?? "Explore this event on VotecastHub GH." };
  } catch { return { title: "Event" }; }
}

function ghDate(value: string) {
  return new Intl.DateTimeFormat("en-GH", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Accra" }).format(new Date(value));
}

export default async function PublicEventPage({ params }: Props) {
  const { slug } = await params;
  let event: { id: string; name: string; description: string | null; image_path: string | null; unit_price_minor: number; starts_at: string; ends_at: string; status: string; voting_mode: "free" | "paid"; voting_rule: VotingRule; voting_rules: string | null; free_vote_limit_per_phone: number | null; results_visibility: string; results_released: boolean } | null = null;
  let categories: Array<{ id: string; name: string; description: string | null }> = [];
  let nominees: Array<{ id: string; category_id: string; name: string; public_code: string | null; biography: string | null; image_path: string | null }> = [];
  let imageUrlByPath = new Map<string, string>();
  let eventImageUrl: string | null = null;
  let publicResults: Array<{ nominee_id: string; vote_count: number }> = [];
  let unavailable = false;
  let phoneVerified = false;
  let voterUserId: string | null = null;
  let voterUsage: Array<{ category_id: string; nominee_id: string; quantity: number }> = [];
  let votingOpen = false;
  try {
    const supabase = await createClient();
    try {
      const { data: userData } = await supabase.auth.getUser();
      voterUserId = userData.user?.id ?? null;
      phoneVerified = Boolean(userData.user?.phone && userData.user.phone_confirmed_at);
    } catch {
      // Public event pages remain readable if the auth service is temporarily unavailable.
      voterUserId = null;
      phoneVerified = false;
    }
    const eventResult = await supabase.from("events").select("id, name, description, image_path, unit_price_minor, starts_at, ends_at, status, voting_mode, voting_rule, voting_rules, free_vote_limit_per_phone, results_visibility, results_released").eq("slug", slug).in("status", ["published", "paused", "closed"]).maybeSingle();
    if (eventResult.error) unavailable = true;
    else if (eventResult.data) {
      event = eventResult.data;
      if (event.image_path) {
        const signedEventImage = await supabase.storage.from("nominee-images").createSignedUrl(event.image_path, 3600);
        eventImageUrl = signedEventImage.data?.signedUrl ?? null;
      }
      if (event.voting_mode === "free") {
        const openResult = await supabase.rpc("is_free_voting_open", { p_event_id: event.id });
        votingOpen = openResult.data === true;
        if (votingOpen && phoneVerified && voterUserId) {
          const usageResult = await supabase.from("vote_batches").select("category_id, nominee_id, quantity").eq("event_id", event.id).eq("voter_user_id", voterUserId).is("payment_attempt_id", null);
          if (!usageResult.error) voterUsage = usageResult.data ?? [];
        }
      }
      if (event.results_visibility === "live" || event.results_visibility === "after_close") {
        const results = await supabase.rpc("get_public_event_results", { p_event_id: event.id });
        if (!results.error) publicResults = results.data ?? [];
      }
      const categoryResult = await supabase.from("categories").select("id, name, description").eq("event_id", event.id).eq("is_active", true).order("display_order", { ascending: true });
      if (categoryResult.error) unavailable = true;
      else {
        categories = categoryResult.data ?? [];
        const ids = categories.map((category) => category.id);
        if (ids.length) {
          const nomineeResult = await supabase.from("nominees").select("id, category_id, name, public_code, biography, image_path").in("category_id", ids).eq("is_active", true).order("display_order", { ascending: true });
          if (nomineeResult.error) unavailable = true;
          else {
            nominees = nomineeResult.data ?? [];
            const paths = nominees.map((nominee) => nominee.image_path).filter((path): path is string => Boolean(path));
            if (paths.length) {
              const { data: signedImages } = await supabase.storage.from("nominee-images").createSignedUrls(paths, 3600);
              imageUrlByPath = new Map((signedImages ?? []).flatMap((image) => image.signedUrl && image.path ? [[image.path, image.signedUrl] as const] : []));
            }
          }
        }
      }
    }
  } catch { unavailable = true; }
  if (!event && !unavailable) notFound();

  if (unavailable) return <main className="public-page"><SiteHeader /><section className="empty-state"><span className="empty-icon">↻</span><h1>Event details are temporarily unavailable.</h1><p>Please refresh in a little while.</p><Link className="text-link" href="/events">Back to events</Link></section></main>;
  if (!event) notFound();
  const nomineesByCategory = new Map<string, typeof nominees>();
  for (const nominee of nominees) nomineesByCategory.set(nominee.category_id, [...(nomineesByCategory.get(nominee.category_id) ?? []), nominee]);
  const presentation = eventPresentation(event);
  const status = presentation.label;
  const votePath = `/events/${slug}`;
  const resultsByNominee = new Map(publicResults.map((result) => [result.nominee_id, Number(result.vote_count)]));
  const usedByCategory = new Map<string, number>();
  const usedByNominee = new Map<string, number>();
  for (const batch of voterUsage) {
    usedByCategory.set(batch.category_id, (usedByCategory.get(batch.category_id) ?? 0) + batch.quantity);
    usedByNominee.set(batch.nominee_id, (usedByNominee.get(batch.nominee_id) ?? 0) + batch.quantity);
  }
  const voteCap = event.free_vote_limit_per_phone ?? 1;

  return <main className="public-page"><SiteHeader /><EventViewTracker eventId={event.id} />
    <section className="event-hero">{eventImageUrl && <div className="event-hero-cover" style={{ backgroundImage: `url("${eventImageUrl}")` }} role="img" aria-label={`${event.name} cover image`} />}<Link className="back-link" href="/events">← All events</Link><p className="eyebrow">EVENT DETAILS</p><span className="public-status">{status}</span><h1>{event.name}</h1><p className="event-hero-description">{event.description || "Explore event categories and nominees."}</p><div className="event-facts"><span><small>VOTING OPENS</small>{ghDate(event.starts_at)}</span><span><small>VOTING CLOSES</small>{ghDate(event.ends_at)}</span><span><small>VOTING TYPE</small>{event.voting_mode === "free" ? "Free voting" : `GHS ${(event.unit_price_minor / 100).toFixed(2)} per vote`}</span></div>{event.voting_mode === "free" && <section className="public-rules"><p className="eyebrow">AUTOMATIC VOTING RULE</p><p>{votingRuleSummary(event.voting_rule, event.free_vote_limit_per_phone)}</p>{event.voting_rules && <p className="organizer-rule-note"><strong>Organizer’s additional instructions</strong><br />{event.voting_rules}</p>}</section>}{event.voting_mode === "paid" && event.voting_rules && <section className="public-rules"><p className="eyebrow">EVENT NOTES</p><p>{event.voting_rules}</p></section>}<EventNotices eventId={event.id} /><VotingNotice event={event} resultsVisibility={event.results_visibility} resultsReleased={event.results_released} />{presentation.key === "open" && <p className="vote-coming-note">{event.voting_mode === "free" ? phoneVerified ? "Choose a nominee below. Your remaining votes are shown on each card." : "Voting is free. Verify your phone to get started." : "Choose your nominee and vote quantity, then pay securely with Paystack. Votes are recorded after payment is confirmed."}</p>}</section>
    <section className="public-categories"><div className="section-title-row"><ShareButton title={event.name} text={`${presentation.cta} — ${event.name}`} url={`${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/events/${slug}`} flyer={{ eventName: event.name, imageUrl: eventImageUrl, startsAt: event.starts_at, endsAt: event.ends_at, status: event.status, votingMode: event.voting_mode, unitPriceMinor: event.unit_price_minor }} /><div><p className="eyebrow">THE NOMINEES</p><h2>Categories and nominees</h2></div><span>{categories.length} {categories.length === 1 ? "category" : "categories"}</span></div>
      {categories.length ? categories.map((category) => <section className="public-category" key={category.id}><div className="category-heading"><div><h3>{category.name}</h3>{category.description && <p>{category.description}</p>}</div><span>{nomineesByCategory.get(category.id)?.length ?? 0} nominees</span></div><div className="nominee-grid">{(nomineesByCategory.get(category.id) ?? []).map((nominee) => { const used = event.voting_rule === "per_nominee_limit" ? usedByNominee.get(nominee.id) ?? 0 : usedByCategory.get(category.id) ?? 0; const remaining = Math.max(0, voteCap - used); return <article className="public-nominee-card" key={nominee.id}><Link className="nominee-profile-link" href={`/events/${slug}/nominees/${nominee.id}`}>{imageUrlByPath.get(nominee.image_path ?? "") ? <div className="nominee-photo-card" style={{ backgroundImage: `url("${imageUrlByPath.get(nominee.image_path ?? "")}")` }} role="img" aria-label={`${nominee.name} photo`} /> : <span className="nominee-avatar" aria-hidden="true">{nominee.name.trim().slice(0, 1).toUpperCase()}</span>}<span className="nominee-card-copy"><strong>{nominee.name}</strong>{nominee.public_code && <small>{nominee.public_code}</small>}</span><span className="nominee-arrow" aria-hidden="true">↗</span></Link>{resultsByNominee.has(nominee.id) && <p className="nominee-results"><span>Votes</span><strong>{resultsByNominee.get(nominee.id)?.toLocaleString("en-GH")}</strong></p>}{event.voting_mode === "paid" && status === "Voting open" ? <PaidVoteForm eventId={event.id} categoryId={category.id} nomineeId={nominee.id} nomineeName={nominee.name} unitPriceMinor={event.unit_price_minor} /> : event.voting_mode === "free" && votingOpen && (phoneVerified ? remaining > 0 ? <FreeVoteForm eventId={event.id} categoryId={category.id} nomineeId={nominee.id} nomineeName={nominee.name} nextPath={votePath} maxQuantity={remaining} requestKey={randomUUID()} phoneVerified /> : <p className="vote-limit-reached" role="status">You’ve reached your limit {event.voting_rule === "per_nominee_limit" ? "for this nominee" : "in this category"}.</p> : <FreeVoteForm eventId={event.id} categoryId={category.id} nomineeId={nominee.id} nomineeName={nominee.name} nextPath={votePath} maxQuantity={voteCap} requestKey={randomUUID()} phoneVerified={false} />)}<ShareButton title={nominee.name} text={`${nominee.name} — ${event.name}`} url={`/events/${slug}/nominees/${nominee.id}`} flyer={{ nominee: nominee.name, eventName: event.name, category: category.name, code: nominee.public_code, imageUrl: imageUrlByPath.get(nominee.image_path ?? ""), startsAt: event.starts_at, endsAt: event.ends_at, status: event.status, votingMode: event.voting_mode, unitPriceMinor: event.unit_price_minor }} /></article>; })}</div></section>) : <div className="empty-state compact-empty"><h3>Nominees are being prepared.</h3><p>Check back closer to the event.</p></div>}
    </section>
    <footer className="site-footer"><Link className="brand footer-brand" href="/"><span className="brand-mark">V</span><span>VotecastHub<span className="brand-accent"> GH</span></span></Link><span>Voting for events and awards.</span><span>© {new Date().getFullYear()} VotecastHub GH</span><nav aria-label="Legal and company links"><Link href="/about">About</Link><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link></nav></footer>
  </main>;
}


