import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { UssdInstructions, loadUssdInstructions } from "@/components/events/ussd-instructions";
import { SiteHeader } from "@/components/site-header";
import { BrandLogo } from "@/components/brand-logo";
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
  if (unavailable) return (
    <main className="min-h-screen bg-[var(--paper)] text-[var(--ink)]">
      <SiteHeader />
      <section className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-4 py-16 text-center sm:px-6">
        <h1 className="mb-3 font-serif text-3xl sm:text-4xl font-medium tracking-tight text-stone-900 dark:text-white">Nominee details are temporarily unavailable.</h1>
        <p className="max-w-md text-sm leading-relaxed text-stone-600 dark:text-stone-300">Please try again shortly.</p>
        <Link className="mt-8 inline-flex items-center justify-center gap-2 rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm font-semibold text-stone-800 shadow-xs hover:bg-stone-100 min-h-11 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#1c2721] dark:bg-[#0c120e] dark:text-stone-200" href="/events">Back to events</Link>
      </section>
    </main>
  );
  if (!event || !nominee || !category) notFound();
  const ussdInfo = await loadUssdInstructions(event.id);
  return (
    <main className="min-h-screen bg-[var(--paper)] text-[var(--ink)]">
      <SiteHeader />
      <article className="mx-auto flex w-full max-w-3xl flex-col items-start gap-4 px-4 py-10 sm:px-6 sm:py-16">
        <Link className="inline-flex items-center justify-center gap-2 rounded-xl border border-stone-300 bg-white px-4 py-2 text-xs font-semibold text-stone-800 shadow-2xs hover:bg-stone-50 min-h-10 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#1c2721] dark:bg-[#0c120e] dark:text-stone-200" href={`/events/${event.slug}`}>← Back to {event.name}</Link>
        {imageUrl ? (
          <div className="h-36 w-36 rounded-full bg-cover bg-center shadow-lg border-2 border-emerald-500/20 mb-2" style={{ backgroundImage: `url("${imageUrl}")` }} role="img" aria-label={`${nominee.name} photo`} />
        ) : (
          <span className="flex h-36 w-36 items-center justify-center rounded-full bg-emerald-50 text-4xl font-serif text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400 mb-2 border border-emerald-200 dark:border-emerald-900/50" aria-hidden="true">{nominee.name.trim().slice(0, 1).toUpperCase()}</span>
        )}
        <p className="text-xs font-bold tracking-widest text-emerald-800 uppercase dark:text-emerald-400">{category.name}</p>
        <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-medium tracking-tight text-stone-900 dark:text-white">{nominee.name}</h1>
        {nominee.public_code && <p className="text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400">Code: {nominee.public_code}</p>}
        <p className="text-sm sm:text-base leading-relaxed text-stone-600 dark:text-stone-300 whitespace-pre-wrap max-w-2xl">{nominee.biography || "A profile for this nominee has not been added yet."}</p>
        <EventNotices eventId={event.id} />
        <VotingNotice event={event} />
        <UssdInstructions eventId={event.id} />
        <ShareButton title={nominee.name} text={`${nominee.name} — ${event.name}`} url={`${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/events/${event.slug}/nominees/${nominee.id}`} flyer={{ ussd: ussdInfo ?? undefined, nominee: nominee.name, category: category.name, imageUrl, eventName: event.name, code: nominee.public_code, startsAt: event.starts_at, endsAt: event.ends_at, status: event.status, votingMode: event.voting_mode, unitPriceMinor: event.unit_price_minor, eventCode: ussdInfo?.event_code ? String(ussdInfo.event_code) : event.slug }} />
        <Link
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-900 bg-emerald-900 px-6 py-3.5 text-sm font-semibold text-white shadow-md hover:bg-emerald-800 min-h-11 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-emerald-600 dark:hover:bg-emerald-500"
          href={`/events/${event.slug}?nominee=${nominee.id}`}
        >
          {eventPresentation(event).key === "open" ? `Vote for ${nominee.name} →` : "Explore event & results"}
        </Link>
      </article>
      <footer className="mx-auto mt-16 max-w-6xl border-t border-stone-200 px-4 py-8 sm:px-6 text-xs text-stone-600 dark:border-[#1c2721] dark:text-stone-400 flex flex-wrap items-center justify-between gap-4">
        <Link className="inline-flex items-center" href="/"><BrandLogo height={34} /></Link>
        <span>© {new Date().getFullYear()} VotecastHub GH</span>
        <nav aria-label="Legal and company links" className="flex items-center gap-4 font-medium">
          <Link href="/about" className="hover:text-emerald-700 dark:hover:text-emerald-400">About</Link>
          <Link href="/privacy" className="hover:text-emerald-700 dark:hover:text-emerald-400">Privacy</Link>
          <Link href="/terms" className="hover:text-emerald-700 dark:hover:text-emerald-400">Terms</Link>
        </nav>
      </footer>
    </main>
  );
}
