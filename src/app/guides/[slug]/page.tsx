import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { StructuredData } from "@/components/seo/structured-data";
import { GUIDES } from "@/lib/seo/guides";
import { publicMetadata, breadcrumbs } from "@/lib/seo/metadata";
import { GuideFlowchart } from "@/components/guides/guide-flowchart";

type Props = { params: Promise<{ slug: string }> };
export function generateStaticParams() { return GUIDES.map(({ slug }) => ({ slug })); }
export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const guide = GUIDES.find(item => item.slug === slug);
  if (!guide) notFound();
  return publicMetadata(guide.title, guide.description, `/guides/${slug}`);
}
export default async function GuidePage({ params }: Props) {
  const { slug } = await params;
  const guide = GUIDES.find(item => item.slug === slug);
  if (!guide) notFound();
  return <main><SiteHeader /><article className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-12">
    <nav aria-label="Breadcrumb" className="flex flex-wrap gap-2 text-sm text-emerald-800"><Link href="/">Home</Link><span aria-hidden="true">/</span><Link href="/guides">Organizer guides</Link></nav>
    <h1 className="mt-6 text-3xl font-semibold leading-tight text-stone-900 sm:text-4xl">{guide.title}</h1><p className="mt-4 text-lg leading-8 text-stone-600">{guide.description}</p>
    <GuideFlowchart flow={guide.flow} />
    {guide.sections.map((section, index) => <section className="mt-9" key={section.title}><div className="flex items-baseline gap-3"><span className="text-sm font-bold text-emerald-800">{String(index + 1).padStart(2, "0")}</span><h2 className="text-xl font-semibold text-stone-900">{section.title}</h2></div>{section.paragraphs.map(paragraph => <p key={paragraph} className="mt-3 leading-7 text-stone-700">{paragraph}</p>)}</section>)}
    <div className="mt-10 rounded-2xl bg-emerald-50 p-6"><h2 className="text-xl font-semibold text-emerald-950">Ready to start?</h2><p className="mt-2 leading-7 text-emerald-900">Create an organizer account, set up your event, and send it for review.</p><Link href="/sign-up" className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-emerald-900 px-5 font-semibold text-white">Create an account</Link><Link href="/pricing" className="ml-4 inline-flex min-h-11 items-center text-sm font-semibold text-emerald-900 underline">See pricing</Link></div>
    <aside className="mt-10 border-t border-stone-200 pt-6"><h2 className="font-semibold text-stone-900">Related guides</h2><ul className="mt-3 space-y-2">{GUIDES.filter(item => item.slug !== slug).map(item => <li key={item.slug}><Link className="inline-flex min-h-11 items-center text-emerald-800 underline" href={`/guides/${item.slug}`}>{item.title}</Link></li>)}</ul></aside>
  </article><StructuredData data={breadcrumbs([{ name: "Home", path: "/" }, { name: "Organizer guides", path: "/guides" }, { name: guide.title, path: `/guides/${slug}` }])} /></main>;
}
