import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { ResourceLinks } from "@/components/seo/resource-links";
import { publicMetadata } from "@/lib/seo/metadata";

export const metadata = publicMetadata("Organizer guides for online voting in Ghana", "Learn how to plan awards voting, prepare voter lists, set voting limits and promote your approved VotecastHub event.", "/guides");
export default function GuidesPage() {
  return <main><SiteHeader /><div className="mx-auto max-w-6xl px-4 pt-12 sm:px-6"><p className="text-xs font-semibold uppercase tracking-widest text-emerald-800">VotecastHub GH guides</p><h1 className="mt-3 max-w-3xl text-3xl font-semibold text-stone-900 sm:text-5xl">From your first draft to a public vote.</h1><p className="mt-5 max-w-2xl text-lg leading-8 text-stone-600">Practical guidance for organizers running awards, competitions and community votes in Ghana. Understand the setup before inviting people to participate.</p></div><ResourceLinks /><footer className="mx-auto max-w-6xl border-t border-stone-200 px-4 py-8 text-sm text-stone-600 sm:px-6"><Link href="/events" className="mr-6 inline-flex min-h-11 items-center text-emerald-800">Browse public events</Link><Link href="/pricing" className="inline-flex min-h-11 items-center text-emerald-800">Pricing and costs</Link></footer></main>;
}
