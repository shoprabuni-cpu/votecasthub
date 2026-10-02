import type { Metadata } from "next";
import { randomUUID } from "node:crypto";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { FreeVoteForm } from "@/components/voting/free-vote-form";
import { createClient } from "@/lib/supabase/server";

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
  let event: { id: string; name: string; description: string | null; image_path: string | null; unit_price_minor: number; starts_at: string; ends_at: string; status: string; voting_mode: "free" | "paid"; voting_rules: string | null; free_vote_limit_per_phone: number | null; results_visibility: string } | null = null;
  let categories: Array<{ id: string; name: string; description: string | null }> = [];
  let nominees: Array<{ id: string; category_id: string; name: string; public_code: string | null; biography: string | null; image_path: string | null }> = [];
  let imageUrlByPath = new Map<string, string>();
  let eventImageUrl: string | null = null;
  let publicResults: Array<{ nominee_id: string; vote_count: number }> = [];
  let unavailable = false;
  let signedIn = false;
  let votingOpen = false;
  try {
    const supabase = await createClient();
    const { data: claims } = await supabase.auth.getClaims();
    signedIn = typeof claims?.claims?.sub === "string";
    const eventResult = await supabase.from("events").select("id, name, description, image_path, unit_price_minor, starts_at, ends_at, status, voting_mode, voting_rules, free_vote_limit_per_phone, results_visibility").eq("slug", slug).in("status", ["published", "paused", "closed"]).maybeSingle();
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
  const status = event.status === "paused" ? "Voting paused" : event.status === "closed" ? "Voting closed" : "Published event";
  const votePath = `/events/${slug}`;
  const resultsByNominee = new Map(publicResults.map((result) => [result.nominee_id, Number(result.vote_count)]));

  return <main className="public-page"><SiteHeader />
    <section className="event-hero">{eventImageUrl && <div className="event-hero-cover" style={{ backgroundImage: `url("${eventImageUrl}")` }} role="img" aria-label={`${event.name} cover image`} />}<Link className="back-link" href="/events">← All events</Link><p className="eyebrow">EVENT DETAILS</p><span className="public-status">{status}</span><h1>{event.name}</h1><p className="event-hero-description">{event.description || "Explore event categories and nominees."}</p><div className="event-facts"><span><small>VOTING OPENS</small>{ghDate(event.starts_at)}</span><span><small>VOTING CLOSES</small>{ghDate(event.ends_at)}</span><span><small>VOTING TYPE</small>{event.voting_mode === "free" ? "Free voting" : `GHS ${(event.unit_price_minor / 100).toFixed(2)} per vote`}</span></div>{event.voting_rules && <section className="public-rules"><p className="eyebrow">HOW VOTING WORKS</p><p>{event.voting_rules}</p></section>}<p className="vote-coming-note">{event.voting_mode === "free" ? votingOpen ? `Voting is open. Each verified phone may cast up to ${event.free_vote_limit_per_phone} votes per category.` : "Free voting opens during the scheduled voting window. Phone verification is required." : "Paid checkout is being prepared. No payment is accepted on this page yet."}</p></section>
    <section className="public-categories"><div className="section-title-row"><div><p className="eyebrow">THE NOMINEES</p><h2>Categories and nominees</h2></div><span>{categories.length} {categories.length === 1 ? "category" : "categories"}</span></div>
      {categories.length ? categories.map((category) => <section className="public-category" key={category.id}><div className="category-heading"><div><h3>{category.name}</h3>{category.description && <p>{category.description}</p>}</div><span>{nomineesByCategory.get(category.id)?.length ?? 0} nominees</span></div><div className="nominee-grid">{(nomineesByCategory.get(category.id) ?? []).map((nominee) => <article className="public-nominee-card" key={nominee.id}><Link className="nominee-profile-link" href={`/events/${slug}/nominees/${nominee.id}`}>{imageUrlByPath.get(nominee.image_path ?? "") ? <div className="nominee-photo-card" style={{ backgroundImage: `url("${imageUrlByPath.get(nominee.image_path ?? "")}")` }} role="img" aria-label={`${nominee.name} photo`} /> : <span className="nominee-avatar" aria-hidden="true">{nominee.name.trim().slice(0, 1).toUpperCase()}</span>}<span className="nominee-card-copy"><strong>{nominee.name}</strong>{nominee.public_code && <small>{nominee.public_code}</small>}</span><span className="nominee-arrow" aria-hidden="true">↗</span></Link>{resultsByNominee.has(nominee.id) && <p className="nominee-results"><span>Votes</span><strong>{resultsByNominee.get(nominee.id)?.toLocaleString("en-GH")}</strong></p>}{event.voting_mode === "free" && votingOpen && <FreeVoteForm eventId={event.id} categoryId={category.id} nomineeId={nominee.id} nomineeName={nominee.name} nextPath={votePath} maxQuantity={event.free_vote_limit_per_phone ?? 1} requestKey={randomUUID()} signedIn={signedIn} />}</article>)}</div></section>) : <div className="empty-state compact-empty"><h3>Nominees are being prepared.</h3><p>Check back closer to the event.</p></div>}
    </section>
    <footer className="site-footer"><Link className="brand footer-brand" href="/"><span className="brand-mark">V</span><span>VotecastHub<span className="brand-accent"> GH</span></span></Link><span>Voting for events and awards.</span><span>© {new Date().getFullYear()} VotecastHub GH</span><nav aria-label="Legal and company links"><Link href="/about">About</Link><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link></nav></footer>
  </main>;
}
