import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { createClient } from "@/lib/supabase/server";

type Props = { params: Promise<{ slug: string; nomineeId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, nomineeId } = await params;
  try {
    const supabase = await createClient();
    const { data: event } = await supabase.from("events").select("id").eq("slug", slug).in("status", ["published", "paused", "closed"]).maybeSingle();
    if (!event) return { title: "Nominee" };
    const { data: nominee } = await supabase.from("nominees").select("name, biography, category_id").eq("id", nomineeId).eq("is_active", true).maybeSingle();
    if (!nominee) return { title: "Nominee" };
    const { data: category } = await supabase.from("categories").select("id").eq("id", nominee.category_id).eq("event_id", event.id).eq("is_active", true).maybeSingle();
    return category ? { title: nominee.name, description: nominee.biography ?? "Nominee profile" } : { title: "Nominee" };
  } catch { return { title: "Nominee" }; }
}

export default async function NomineePage({ params }: Props) {
  const { slug, nomineeId } = await params;
  let event: { id: string; name: string; slug: string } | null = null;
  let nominee: { id: string; category_id: string; name: string; public_code: string | null; biography: string | null; image_path: string | null } | null = null;
  let category: { id: string; name: string; event_id: string } | null = null;
  let imageUrl: string | null = null;
  let unavailable = false;
  try {
    const supabase = await createClient();
    const eventResult = await supabase.from("events").select("id, name, slug").eq("slug", slug).in("status", ["published", "paused", "closed"]).maybeSingle();
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
  if (unavailable) return <main className="public-page"><SiteHeader /><section className="empty-state"><h1>Nominee details are temporarily unavailable.</h1><p>Please try again shortly.</p><Link className="text-link" href="/events">Back to events</Link></section></main>;
  if (!event || !nominee || !category) notFound();
  return <main className="public-page"><SiteHeader /><article className="nominee-profile"><Link className="back-link" href={`/events/${event.slug}`}>← Back to {event.name}</Link>{imageUrl ? <div className="nominee-photo-profile" style={{ backgroundImage: `url("${imageUrl}")` }} role="img" aria-label={`${nominee.name} photo`} /> : <span className="nominee-avatar nominee-avatar-large" aria-hidden="true">{nominee.name.trim().slice(0, 1).toUpperCase()}</span>}<p className="eyebrow">{category.name}</p><h1>{nominee.name}</h1>{nominee.public_code && <p className="nominee-profile-code">{nominee.public_code}</p>}<p className="nominee-biography">{nominee.biography || "A profile for this nominee has not been added yet."}</p><p className="vote-coming-note">View the event page for current voting options and rules.</p><Link className="primary-link" href={`/events/${event.slug}`}>Return to event</Link></article><footer className="site-footer"><Link className="brand footer-brand" href="/"><span className="brand-mark">V</span><span>VotecastHub<span className="brand-accent"> GH</span></span></Link><span>© {new Date().getFullYear()} VotecastHub GH</span><nav aria-label="Legal and company links"><Link href="/about">About</Link><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link></nav></footer></main>;
}
