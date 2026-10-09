import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { ResourceLinks } from "@/components/seo/resource-links";
import { publicMetadata } from "@/lib/seo/metadata";
import { GuideFlowchart } from "@/components/guides/guide-flowchart";
import { GUIDES } from "@/lib/seo/guides";

export const metadata = publicMetadata("Simple guides to online voting", "Plain-English guides for setting up an event, choosing voter checks, setting vote limits and sharing the event link.", "/guides");
export default function GuidesPage() {
  return <main><SiteHeader /><div className="mx-auto max-w-6xl px-4 pt-10 sm:px-6 sm:pt-12"><p className="text-xs font-semibold uppercase tracking-widest text-emerald-800">VotecastHub GH guides</p><h1 className="mt-3 max-w-3xl text-3xl font-semibold text-stone-900 sm:text-5xl">Simple guides to setting up and running a vote.</h1><p className="mt-4 max-w-2xl text-lg leading-8 text-stone-600">Choose a guide below. Each one explains what to do in simple steps.</p></div>
    <div className="mx-auto max-w-6xl px-4 sm:px-6"><GuideFlowchart flow={{ title: "The simple path", start: "Plan your vote", steps: ["Set up the event", "Check your rules and dates", "Get the event approved", "Share the link"], end: "Voters take part" }} /></div>
    <section aria-labelledby="choose-guide" className="mx-auto max-w-6xl px-4 py-10 sm:px-6"><h2 id="choose-guide" className="text-2xl font-semibold text-stone-900">Choose the guide you need</h2><div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{GUIDES.map((guide, index) => <article key={guide.slug} className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"><p className="text-xs font-semibold uppercase tracking-widest text-emerald-800">Guide {index + 1}</p><h3 className="mt-2 text-lg font-semibold leading-6 text-stone-900"><Link className="hover:text-emerald-800" href={`/guides/${guide.slug}`}>{guide.title}</Link></h3><p className="mt-3 text-sm leading-6 text-stone-600">{guide.description}</p><Link className="mt-4 inline-flex min-h-11 items-center font-semibold text-emerald-800 underline" href={`/guides/${guide.slug}`}>Read this guide →</Link></article>)}</div></section>
    <footer className="mx-auto max-w-6xl border-t border-stone-200 px-4 py-8 text-sm text-stone-600 sm:px-6"><Link href="/events" className="mr-6 inline-flex min-h-11 items-center text-emerald-800">Browse events</Link><Link href="/pricing" className="inline-flex min-h-11 items-center text-emerald-800">See pricing</Link></footer></main>;
}
