import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { StructuredData } from "@/components/seo/structured-data";
import { GUIDES } from "@/lib/seo/guides";
import { publicMetadata, breadcrumbs } from "@/lib/seo/metadata";
import { GuideFlowchart } from "@/components/guides/guide-flowchart";
import { YouTubeEmbed } from "@/components/media/youtube-tutorial";

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
  return (
    <main>
      <SiteHeader />
      <article className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-12">
        <nav aria-label="Breadcrumb" className="flex flex-wrap gap-2 text-sm text-emerald-800 dark:text-emerald-400">
          <Link href="/" className="hover:text-emerald-950 dark:hover:text-emerald-300">Home</Link>
          <span aria-hidden="true" className="text-stone-400 dark:text-stone-600">/</span>
          <Link href="/guides" className="hover:text-emerald-950 dark:hover:text-emerald-300">Organizer &amp; Voter guides</Link>
        </nav>
        <h1 className="mt-6 text-3xl font-semibold leading-tight text-stone-900 sm:text-4xl dark:text-white">
          {guide.title}
        </h1>
        <p className="mt-4 text-lg leading-8 text-stone-600 dark:text-stone-300">{guide.description}</p>

        {guide.video && (
          <div className="my-8 rounded-3xl border border-stone-200 bg-linear-to-b from-stone-50/80 to-white p-6 sm:p-8 shadow-xs dark:border-[#1c2721] dark:bg-linear-to-b dark:from-[#090d0a] dark:to-[#000000]">
            <div className="text-center mb-6">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-900 dark:bg-red-950/70 dark:border dark:border-red-900/60 dark:text-red-300">
                <span className="size-2 rounded-full bg-red-600 animate-pulse" />
                OFFICIAL VIDEO TUTORIAL
              </span>
              <h2 className="mt-2 text-xl font-bold text-stone-900 dark:text-white">Watch the Step-by-Step Video</h2>
              <p className="mt-1 text-xs text-stone-600 dark:text-stone-400">
                See exactly how to cast votes and complete Mobile Money checkout on mobile
              </p>
            </div>
            <YouTubeEmbed
              videoId={guide.video.id}
              title={guide.video.title}
              youtubeUrl={guide.video.directUrl}
            />
          </div>
        )}

        <GuideFlowchart flow={guide.flow} />

        {guide.sections.map((section, index) => (
          <section className="mt-9" key={section.title}>
            <div className="flex items-baseline gap-3">
              <span className="text-sm font-bold text-emerald-800 dark:text-emerald-400">
                {String(index + 1).padStart(2, "0")}
              </span>
              <h2 className="text-xl font-semibold text-stone-900 dark:text-white">{section.title}</h2>
            </div>
            {section.paragraphs.map(paragraph => (
              <p key={paragraph} className="mt-3 leading-7 text-stone-700 dark:text-stone-300">
                {paragraph}
              </p>
            ))}
          </section>
        ))}

        <div className="mt-10 rounded-2xl bg-emerald-50 p-6 dark:border dark:border-[#143722] dark:bg-[#07160e]">
          <h2 className="text-xl font-semibold text-emerald-950 dark:text-white">Ready to start?</h2>
          <p className="mt-2 leading-7 text-emerald-900 dark:text-emerald-200">
            Create an organizer account, set up your event, or try out bot voting.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Link
              href="/sign-up"
              className="inline-flex min-h-11 items-center rounded-xl bg-emerald-900 px-5 font-semibold text-white hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500"
            >
              Create an account
            </Link>
            <Link
              href="/events"
              className="inline-flex min-h-11 items-center rounded-xl border border-emerald-300 bg-white px-5 font-semibold text-emerald-900 hover:bg-emerald-50 dark:border-[#1e4830] dark:bg-[#0b1b12] dark:text-emerald-200 dark:hover:bg-[#11291b]"
            >
              Browse live votes
            </Link>
          </div>
        </div>

        <aside className="mt-10 border-t border-stone-200 pt-6 dark:border-[#1c2721]">
          <h2 className="font-semibold text-stone-900 dark:text-white">Related guides</h2>
          <ul className="mt-3 space-y-2">
            {GUIDES.filter(item => item.slug !== slug).map(item => (
              <li key={item.slug}>
                <Link
                  className="inline-flex min-h-11 items-center text-emerald-800 underline hover:text-emerald-950 dark:text-emerald-400 dark:hover:text-emerald-300"
                  href={`/guides/${item.slug}`}
                >
                  {item.title}
                </Link>
              </li>
            ))}
          </ul>
        </aside>
      </article>

      <StructuredData
        data={breadcrumbs([
          { name: "Home", path: "/" },
          { name: "Organizer & Voter guides", path: "/guides" },
          { name: guide.title, path: `/guides/${slug}` },
        ])}
      />

      {guide.video && (
        <StructuredData
          data={{
            "@context": "https://schema.org",
            "@type": "VideoObject",
            name: guide.video.title,
            description: guide.description,
            thumbnailUrl: [
              `https://i.ytimg.com/vi/${guide.video.id}/hqdefault.jpg`,
              `https://i.ytimg.com/vi/${guide.video.id}/maxresdefault.jpg`,
            ],
            uploadDate: "2026-11-01T08:00:00+00:00",
            embedUrl: `https://www.youtube.com/embed/${guide.video.id}`,
            contentUrl: guide.video.directUrl,
          }}
        />
      )}
    </main>
  );
}
