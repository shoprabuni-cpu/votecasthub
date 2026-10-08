import Link from "next/link";
import { GUIDES } from "@/lib/seo/guides";

export function ResourceLinks() {
  return <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6" aria-labelledby="organizer-guides-title">
    <p className="text-xs font-semibold uppercase tracking-widest text-emerald-800">For organizers</p>
    <div className="mt-2 flex flex-wrap items-center justify-between gap-4"><h2 id="organizer-guides-title" className="text-2xl font-semibold text-stone-900">Plan your next vote.</h2><Link href="/guides" className="inline-flex min-h-11 items-center text-sm font-semibold text-emerald-800">All organizer guides →</Link></div>
    <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{GUIDES.map(guide => <article key={guide.slug} className="rounded-2xl border border-stone-200 bg-white p-5"><h3 className="font-semibold text-stone-900"><Link className="hover:text-emerald-800" href={`/guides/${guide.slug}`}>{guide.title}</Link></h3><p className="mt-3 text-sm leading-6 text-stone-600">{guide.description}</p></article>)}</div>
    <p className="mt-6 text-sm text-stone-600">Considering paid voting? <Link href="/pricing" className="inline-flex min-h-11 items-center font-semibold text-emerald-800 underline">Read how pricing works.</Link></p>
  </section>;
}
