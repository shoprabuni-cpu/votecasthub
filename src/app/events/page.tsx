import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { MobileTabBar } from "@/components/home/mobile-tab-bar";
import { type PublicEventCardData } from "@/components/events/public-event-card";
import { EventBrowser } from "@/components/events/event-browser";
import { createClient } from "@/lib/supabase/server";
import { Icon } from "@/components/icon";

export const metadata: Metadata = {
  title: "Browse Events & Awards | VotecastHub GH",
  description: "Explore verified Ghanaian awards, pageants, and campus elections. Meet the nominees and cast your vote.",
};

export default async function EventsPage() {
  let events: PublicEventCardData[] = [];
  let unavailable = false;

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("events")
      .select("id, name, slug, description, image_path, unit_price_minor, starts_at, ends_at, status, voting_mode")
      .in("status", ["published", "paused", "closed"])
      .order("starts_at", { ascending: true });

    if (error) {
      unavailable = true;
    } else {
      const imagePaths = (data ?? [])
        .map((event) => event.image_path)
        .filter((path): path is string => Boolean(path));

      const { data: signedImages } = imagePaths.length
        ? await supabase.storage.from("nominee-images").createSignedUrls(imagePaths, 3600)
        : { data: [] };

      const imageUrls = new Map(
        (signedImages ?? []).flatMap((image) =>
          image.signedUrl && image.path ? [[image.path, image.signedUrl] as const] : []
        )
      );

      events = (data ?? []).map((event) => ({
        ...event,
        imageUrl: event.image_path ? imageUrls.get(event.image_path) ?? null : null,
      })) as PublicEventCardData[];
    }
  } catch {
    unavailable = true;
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#fafbf9] text-slate-900 selection:bg-emerald-700/15 selection:text-emerald-950">
      <SiteHeader />

      <main className="flex-1">
        {/* Header Hero Banner for Directory */}
        <section className="bg-gradient-to-b from-emerald-950 via-emerald-900 to-slate-900 text-white py-12 sm:py-16 relative overflow-hidden">
          <div className="absolute top-0 right-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="max-w-2xl">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-800/80 text-emerald-200 border border-emerald-700/50 mb-3">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                OFFICIAL DIRECTORY
              </span>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white mb-3">
                Events Worth Showing Up For.
              </h1>
              <p className="text-sm sm:text-base text-emerald-100/80 leading-relaxed">
                Discover verified awards, pageants, and talent contests happening across Ghana. Meet the nominees, review voting rules, and cast your vote.
              </p>
            </div>
          </div>
        </section>

        {/* Directory Body */}
        {unavailable ? (
          <section className="max-w-xl mx-auto px-4 py-20 text-center" role="status">
            <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center mx-auto mb-4 border border-amber-200">
              <Icon name="clock" size={26} />
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">Events are temporarily unavailable</h2>
            <p className="text-sm text-slate-600 mb-6 leading-relaxed">
              We are connecting to the voting registry. Please refresh your browser or try again shortly.
            </p>
            <Link
              href="/events"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-800 text-white font-semibold text-xs hover:bg-emerald-900 transition-all shadow-xs"
            >
              <span>Refresh Directory</span>
              <span>↻</span>
            </Link>
          </section>
        ) : events.length ? (
          <EventBrowser events={events} />
        ) : (
          <section className="max-w-xl mx-auto px-4 py-20 text-center">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-800 flex items-center justify-center mx-auto mb-4 border border-emerald-100">
              <Icon name="sparkle" size={26} />
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">No events are published yet</h2>
            <p className="text-sm text-slate-600 mb-6 leading-relaxed">
              Organizers are preparing their categories and nominees. Check back soon or set up your own event.
            </p>
            <Link
              href="/sign-up"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-800 text-white font-semibold text-sm hover:bg-emerald-900 transition-all shadow-xs"
            >
              <span>Create an Event</span>
              <Icon name="arrowUpRight" size={14} />
            </Link>
          </section>
        )}
      </main>

      <SiteFooter />

      <MobileTabBar />
    </div>
  );
}
