import { SiteHeader } from "@/components/site-header";
import { HeroSection } from "@/components/home/hero-section";
import { TrustSection } from "@/components/home/trust-section";
import { SolutionsTabs } from "@/components/home/solutions-tabs";
import { MobileTabBar } from "@/components/home/mobile-tab-bar";
import { SiteFooter } from "@/components/site-footer";
import { PublishedEventsCarousel } from "@/components/events/published-events-carousel";
import { createClient } from "@/lib/supabase/server";
import type { PublicEventCardData } from "@/components/events/public-event-card";

export default async function HomePage() {
  let featured: PublicEventCardData[] = [];
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("events")
      .select("id,name,slug,description,image_path,unit_price_minor,starts_at,ends_at,status,voting_mode")
      .in("status", ["published", "paused"])
      .order("starts_at", { ascending: true })
      .limit(8);

    const paths = (data ?? []).map((e) => e.image_path).filter((p): p is string => Boolean(p));
    const { data: images } = paths.length
      ? await supabase.storage.from("nominee-images").createSignedUrls(paths, 3600)
      : { data: [] };
    const urls = new Map((images ?? []).flatMap((i) => (i.signedUrl && i.path ? [[i.path, i.signedUrl] as const] : [])));
    featured = (data ?? []).map((e) => ({
      ...e,
      imageUrl: e.image_path ? urls.get(e.image_path) ?? null : null,
    })) as PublicEventCardData[];
  } catch {
    featured = [];
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#fafbf9] text-slate-900 selection:bg-emerald-700/15 selection:text-emerald-950">
      <SiteHeader />

      <main className="flex-1">
        <HeroSection />

        <TrustSection />

        <PublishedEventsCarousel events={featured} />

        <SolutionsTabs />
      </main>

      <SiteFooter />

      <MobileTabBar />
    </div>
  );
}
