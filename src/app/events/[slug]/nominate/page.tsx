import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { PublicNominationForm } from "@/components/events/public-nomination-form";
import { createClient } from "@/lib/supabase/server";
import { getCachedSignedUrl } from "@/lib/storage/signed-url-cache";
import { publicMetadata, PRIVATE_ROBOTS, breadcrumbs } from "@/lib/seo/metadata";
import { StructuredData } from "@/components/seo/structured-data";

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  try {
    const supabase = await createClient();
    const { data: event } = await supabase
      .from("events")
      .select("name, description")
      .eq("slug", slug)
      .maybeSingle();

    if (!event) return { title: "Nominations unavailable", robots: PRIVATE_ROBOTS };
    return publicMetadata(
      `File Nomination — ${event.name}`,
      `Submit your nomination entry for ${event.name} on VoteCastHub GH.`,
      `/events/${slug}/nominate`
    );
  } catch {
    return { title: "Nominations unavailable", robots: PRIVATE_ROBOTS };
  }
}

export default async function EventNominationPage({ params }: Props) {
  const { slug } = await params;
  const supabase = await createClient();

  const [eventRes, categoriesRes] = await Promise.all([
    supabase
      .from("events")
      .select(
        "id, name, slug, description, image_path, status, nominations_enabled, nomination_fee_minor, nominations_starts_at, nominations_ends_at, allow_self_nomination, allow_third_party_nomination"
      )
      .eq("slug", slug)
      .maybeSingle(),
    supabase
      .from("categories")
      .select("id, name, description")
      .eq("is_active", true)
      .order("display_order", { ascending: true }),
  ]);

  const event = eventRes.data;
  if (!event || event.status !== "published") notFound();

  // Filter categories belonging to this event
  const { data: eventCategories } = await supabase
    .from("categories")
    .select("id, name, description")
    .eq("event_id", event.id)
    .eq("is_active", true)
    .order("display_order", { ascending: true });

  const categories = eventCategories ?? [];

  const now = new Date();
  const startsAt = event.nominations_starts_at ? new Date(event.nominations_starts_at) : null;
  const endsAt = event.nominations_ends_at ? new Date(event.nominations_ends_at) : null;

  const isNotStarted = startsAt && now < startsAt;
  const isClosed = endsAt && now >= endsAt;
  const isOpen = event.nominations_enabled && !isNotStarted && !isClosed;

  let coverImageUrl: string | null = null;
  if (event.image_path) {
    coverImageUrl = await getCachedSignedUrl(supabase, "nominee-images", event.image_path, 3600);
  }

  return (
    <main className="min-h-screen bg-stone-50/70 pb-24 text-stone-900 transition-colors dark:bg-[#080b09] dark:text-stone-100">
      <SiteHeader />
      <StructuredData
        data={breadcrumbs([
          { name: "Home", path: "/" },
          { name: "Events", path: "/events" },
          { name: event.name, path: `/events/${slug}` },
          { name: "Nominate", path: `/events/${slug}/nominate` },
        ])}
      />

      <div className="mx-auto max-w-2xl px-4 sm:px-6 pt-6 space-y-6">
        {/* Navigation Breadcrumb */}
        <Link
          href={`/events/${slug}`}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-800 hover:underline dark:text-emerald-400"
        >
          <span>← Back to {event.name}</span>
        </Link>

        {/* Header Hero Banner */}
        <div className="rounded-3xl border border-stone-200/90 bg-white p-6 sm:p-8 shadow-xs dark:border-[#1c2721] dark:bg-[#0c120e]">
          <div className="flex items-center gap-2 mb-2">
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">
              Official Call for Nominations
            </span>
          </div>
          <h1 className="font-serif text-2xl sm:text-3xl font-bold tracking-tight text-stone-900 dark:text-white">
            File a Nomination in {event.name}
          </h1>
          <p className="mt-2 text-xs sm:text-sm text-stone-600 leading-relaxed dark:text-stone-300">
            Submit your candidacy or nominate someone who deserves recognition. All applications are reviewed by the official vetting committee.
          </p>
        </div>

        {/* State Banners or Form */}
        {!event.nominations_enabled ? (
          <div className="rounded-3xl border border-dashed border-stone-300 bg-white p-10 text-center dark:border-[#223028] dark:bg-[#0c120e]">
            <h3 className="font-serif text-base font-bold text-stone-800 dark:text-stone-200">
              Nominations are currently closed.
            </h3>
            <p className="mt-1 text-xs text-stone-500">
              The organizer has not opened public nominations for this event.
            </p>
          </div>
        ) : isNotStarted ? (
          <div className="rounded-3xl border border-amber-200 bg-amber-50/70 p-8 text-center text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300">
            Nominations for {event.name} will officially open on{" "}
            <strong>{startsAt?.toLocaleString("en-GH", { timeZone: "Africa/Accra" })}</strong>.
          </div>
        ) : isClosed ? (
          <div className="rounded-3xl border border-stone-200 bg-white p-8 text-center text-xs text-stone-600 dark:border-[#1c2721] dark:bg-[#0c120e] dark:text-stone-400">
            Nominations for {event.name} officially closed on{" "}
            <strong>{endsAt?.toLocaleString("en-GH", { timeZone: "Africa/Accra" })}</strong>.
          </div>
        ) : categories.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-stone-300 bg-white p-10 text-center dark:border-[#223028] dark:bg-[#0c120e]">
            <p className="text-xs text-stone-500">
              Award categories are being set up. Please check back shortly.
            </p>
          </div>
        ) : (
          <PublicNominationForm
            eventId={event.id}
            eventSlug={slug}
            eventName={event.name}
            feeMinor={event.nomination_fee_minor ?? 0}
            allowSelfNomination={event.allow_self_nomination}
            allowThirdPartyNomination={event.allow_third_party_nomination}
            categories={categories}
          />
        )}
      </div>
    </main>
  );
}
