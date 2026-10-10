import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { EventNotices } from "@/components/events/event-notices";
import { VotingNotice } from "@/components/events/voting-notice";
import { eventPresentation } from "@/lib/events/presentation";
import { ShareButton } from "@/components/sharing/share-buttons";
import { createClient } from "@/lib/supabase/server";
import { loadPublicSearchMetadata } from "@/lib/seo/public-data";
import { publicMetadata, PRIVATE_ROBOTS } from "@/lib/seo/metadata";

type Props = { params: Promise<{ slug: string; nomineeId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, nomineeId } = await params;
  try {
    const data = await loadPublicSearchMetadata(slug, nomineeId);
    if (!data) return { title: "Nominee unavailable", robots: PRIVATE_ROBOTS };
    return publicMetadata(`${data.name} — ${data.event_name}`, data.description || `Meet ${data.name}, a nominee in ${data.event_name}, on VotecastHub GH. Explore the event and voting rules.`, data.path, `/api/og?event=${encodeURIComponent(slug)}&nominee=${encodeURIComponent(nomineeId)}`);
  } catch { return { title: "Nominee temporarily unavailable", robots: PRIVATE_ROBOTS }; }
}

export default async function NomineePage({ params }: Props) {
  const { slug, nomineeId } = await params;
  let event: { id: string; name: string; slug: string; status: string; starts_at: string; ends_at: string; voting_mode: "free" | "paid"; unit_price_minor: number } | null = null;
  let nominee: { id: string; category_id: string; name: string; public_code: string | null; biography: string | null; image_path: string | null } | null = null;
  let category: { id: string; name: string; event_id: string } | null = null;
  let imageUrl: string | null = null;
  let unavailable = false;
  try {
    const supabase = await createClient();
    const eventResult = await supabase.from("events").select("id, name, slug, status, starts_at, ends_at, voting_mode, unit_price_minor").eq("slug", slug).in("status", ["published", "paused", "closed"]).maybeSingle();
    if (eventResult.error) unavailable = true;
    else if (eventResult.data) {
      event = eventResult.data;
      const nomineeResult = await supabase.from("nominees").select("id, category_id, name, public_code, biography, image_path").eq("id", nomineeId).eq("is_active", true).maybeSingle();
      if (nomineeResult.error) unavailable = true;
      else if (nomineeResult.data) {
        nominee = nomineeResult.data;
        const categoryResult = await supabase.from("categories").select("id, name, event_id").eq("id", nominee.category_id).eq("event_id", event.id).eq("is_active", true).maybeSingle();
        if (categoryResult.error) unavailable = true;
        else {
          category = categoryResult.data;
          if (nominee.image_path && category) {
            const signed = await supabase.storage.from("nominee-images").createSignedUrl(nominee.image_path, 3600);
            imageUrl = signed.data?.signedUrl ?? null;
          }
        }
      }
    }
  } catch {
    unavailable = true;
  }
  if (!unavailable && (!event || !nominee || !category)) notFound();
  if (unavailable) return <main className="public-page"><SiteHeader /><section className="empty-state"><h1>Nominee details are temporarily unavailable.</h1><p>Please try again shortly.</p><Link className="inline-flex items-center justify-center gap-2 rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm font-semibold text-stone-800 shadow-xs hover:bg-stone-100 min-h-11 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-50" href="/events">Back to events</Link></section></main>;
  if (!event || !nominee || !category) notFound();
  return <main className="public-page"><SiteHeader /><article className="nominee-profile"><Link className="inline-flex items-center justify-center gap-2 rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm font-semibold text-stone-800 shadow-xs hover:bg-stone-100 min-h-11 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-50" href={`/events/${event.slug}`}>← Back to {event.name}</Link>{imageUrl ? <div className="nominee-photo-profile" style={{ backgroundImage: `url("${imageUrl}")` }} role="img" aria-label={`${nominee.name} photo`} /> : <span className="nominee-avatar nominee-avatar-large" aria-hidden="true">{nominee.name.trim().slice(0, 1).toUpperCase()}</span>}<p className="eyebrow">{category.name}</p><h1>{nominee.name}</h1>{nominee.public_code && <p className="nominee-profile-code">{nominee.public_code}</p>}<p className="nominee-biography">{nominee.biography || "A profile for this nominee has not been added yet."}</p><EventNotices eventId={event.id} /><VotingNotice event={event} /><ShareButton title={nominee.name} text={`${nominee.name} — ${event.name}`} url={`${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/events/${event.slug}/nominees/${nominee.id}`} flyer={{ nominee: nominee.name, category: category.name, imageUrl, eventName: event.name, code: nominee.public_code, startsAt: event.starts_at, endsAt: event.ends_at, status: event.status, votingMode: event.voting_mode, unitPriceMinor: event.unit_price_minor }} /><Link className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-900 bg-emerald-900 px-5 py-3 text-sm font-semibold text-white shadow-xs hover:bg-emerald-800 min-h-11 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-50" href={`/events/${event.slug}`}>{eventPresentation(event).key === "open" ? "Go to voting" : "Explore event & results"}</Link></article><footer className="site-footer"><Link className="brand footer-brand" href="/"><span className="brand-mark">V</span><span>VotecastHub<span className="brand-accent"> GH</span></span></Link><span>© {new Date().getFullYear()} VotecastHub GH</span><nav aria-label="Legal and company links"><Link href="/about">About</Link><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link></nav></footer></main>;
}
