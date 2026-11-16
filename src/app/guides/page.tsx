import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { publicMetadata } from "@/lib/seo/metadata";
import { GuideFlowchart } from "@/components/guides/guide-flowchart";
import { GUIDES } from "@/lib/seo/guides";
import { YouTubeTutorialButton } from "@/components/media/youtube-tutorial";

export const metadata = publicMetadata(
  "Official Guides & Video Tutorials - VoteCastHub GH",
  "Step-by-step guides and video tutorials for voters and organizers. Learn how to vote on WhatsApp, Telegram, USSD, and online with Mobile Money.",
  "/guides"
);

export default function GuidesPage() {
  const videoGuides = GUIDES.filter((g) => g.video);
  const standardGuides = GUIDES.filter((g) => !g.video);

  return (
    <main>
      <SiteHeader />

      <div className="mx-auto max-w-6xl px-4 pt-10 sm:px-6 sm:pt-12">
        <p className="text-xs font-semibold uppercase tracking-widest text-emerald-800 dark:text-emerald-400">
          VotecastHub GH guides &amp; tutorials
        </p>
        <h1 className="mt-3 max-w-3xl text-3xl font-semibold text-stone-900 sm:text-5xl dark:text-white">
          Simple guides to voting and running an event.
        </h1>
        <p className="mt-4 max-w-2xl text-lg leading-8 text-stone-600 dark:text-stone-300">
          Watch our official video tutorials or read plain-English step-by-step walkthroughs for WhatsApp, Telegram, USSD, and the web.
        </p>
      </div>

      {/* Featured Video Tutorials Section */}
      <section
        aria-labelledby="video-tutorials-heading"
        className="mx-auto max-w-6xl px-4 pt-8 sm:px-6"
      >
        <div className="rounded-3xl border border-emerald-200/90 bg-linear-to-br from-emerald-50/80 via-white to-sky-50/60 p-6 sm:p-8 shadow-xs dark:border-[#1c2721] dark:bg-linear-to-br dark:from-[#06150d] dark:via-[#000000] dark:to-[#07131b]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex size-6 items-center justify-center rounded-full bg-red-600 text-[10px] font-black text-white">
                  ▶
                </span>
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-950 dark:text-emerald-400">
                  Featured Official Video Tutorials
                </span>
              </div>
              <h2
                id="video-tutorials-heading"
                className="mt-2 text-2xl font-bold font-serif text-stone-900 sm:text-3xl dark:text-white"
              >
                Learn How to Vote in 1 Minute
              </h2>
            </div>
            <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-stone-700 border border-stone-200 shadow-2xs dark:bg-[#0a0d0b] dark:border-[#1c2721] dark:text-stone-300">
              Recorded in Ghana 🇬🇭
            </span>
          </div>

          <div className="mt-6 grid gap-6 md:grid-cols-2">
            {/* WhatsApp Video Guide Card */}
            <div className="flex flex-col justify-between rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm hover:border-emerald-300 transition-all dark:border-[#173b27] dark:bg-[#070d0a] dark:hover:border-emerald-700">
              <div>
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-800 dark:text-emerald-400">
                  <span className="size-2 rounded-full bg-emerald-600 animate-pulse" />
                  <span>WhatsApp Video Tutorial</span>
                </div>
                <h3 className="mt-2 text-lg font-bold text-stone-900 dark:text-white">
                  How to Vote on VoteCastHub GH Using WhatsApp
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-stone-600 dark:text-stone-300">
                  Watch how to message <strong>+233 59 299 2566</strong>, pick a contestant code, and complete your Mobile Money payment via Paystack.
                </p>
              </div>

              <div className="mt-5 pt-4 border-t border-stone-100 flex flex-wrap items-center justify-between gap-3 dark:border-[#1c2721]">
                <YouTubeTutorialButton
                  platform="whatsapp"
                  label="Play Video (1 min)"
                  variant="primary"
                  size="md"
                />
                <Link
                  href="/guides/how-to-vote-on-whatsapp"
                  className="text-xs font-bold text-emerald-800 hover:text-emerald-950 dark:text-emerald-400 dark:hover:text-emerald-300 underline"
                >
                  Read full guide →
                </Link>
              </div>
            </div>

            {/* Telegram Video Guide Card */}
            <div className="flex flex-col justify-between rounded-2xl border border-sky-200 bg-white p-5 shadow-sm hover:border-sky-300 transition-all dark:border-[#132c3f] dark:bg-[#050e17] dark:hover:border-sky-700">
              <div>
                <div className="flex items-center gap-2 text-xs font-bold text-sky-800 dark:text-sky-400">
                  <span className="size-2 rounded-full bg-sky-600 animate-pulse" />
                  <span>Telegram Video Tutorial</span>
                </div>
                <h3 className="mt-2 text-lg font-bold text-stone-900 dark:text-white">
                  How to Vote on VoteCastHub GH Using Telegram
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-stone-600 dark:text-stone-300">
                  Watch how to launch <strong>@VotecastHubGH_bot</strong>, verify your contact with 1 tap, browse contestant photo cards, and get your digital receipt.
                </p>
              </div>

              <div className="mt-5 pt-4 border-t border-stone-100 flex flex-wrap items-center justify-between gap-3 dark:border-[#1c2721]">
                <YouTubeTutorialButton
                  platform="telegram"
                  label="Play Video (1 min)"
                  variant="primary"
                  size="md"
                />
                <Link
                  href="/guides/how-to-vote-on-telegram"
                  className="text-xs font-bold text-sky-800 hover:text-sky-950 dark:text-sky-400 dark:hover:text-sky-300 underline"
                >
                  Read full guide →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 pt-10 sm:px-6">
        <GuideFlowchart
          flow={{
            title: "The simple path",
            start: "Plan your vote",
            steps: [
              "Set up the event",
              "Check your rules and dates",
              "Get the event approved",
              "Share the link",
            ],
            end: "Voters take part",
          }}
        />
      </div>

      {/* Complete Guides Grid */}
      <section aria-labelledby="choose-guide" className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <h2 id="choose-guide" className="text-2xl font-semibold text-stone-900 dark:text-white">
          All Guides &amp; Walkthroughs
        </h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {GUIDES.map((guide, index) => (
            <article
              key={guide.slug}
              className="flex flex-col justify-between rounded-2xl border border-stone-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-[#1c2721] dark:bg-[#080b09] dark:hover:border-emerald-800/70"
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-widest text-emerald-800 dark:text-emerald-400">
                    Guide {index + 1}
                  </p>
                  {guide.video && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-red-50 border border-red-200 px-2 py-0.5 text-[10px] font-bold text-red-700 dark:bg-red-950/60 dark:border-red-900/60 dark:text-red-300">
                      <span className="size-1.5 rounded-full bg-red-600" />
                      Video Included
                    </span>
                  )}
                </div>
                <h3 className="mt-2 text-lg font-semibold leading-6 text-stone-900 dark:text-white">
                  <Link className="hover:text-emerald-800 dark:hover:text-emerald-400" href={`/guides/${guide.slug}`}>
                    {guide.title}
                  </Link>
                </h3>
                <p className="mt-3 text-sm leading-6 text-stone-600 dark:text-stone-300">{guide.description}</p>
              </div>
              <div className="mt-5 pt-3 border-t border-stone-100 flex items-center justify-between dark:border-[#1c2721]">
                <Link
                  className="inline-flex min-h-11 items-center font-semibold text-emerald-800 underline hover:text-emerald-950 dark:text-emerald-400 dark:hover:text-emerald-300"
                  href={`/guides/${guide.slug}`}
                >
                  Read this guide →
                </Link>
                {guide.video && (
                  <YouTubeTutorialButton
                    platform={guide.video.platform}
                    label="Watch"
                    variant="ghost"
                    size="sm"
                  />
                )}
              </div>
            </article>
          ))}
        </div>
      </section>

      <footer className="mx-auto max-w-6xl border-t border-stone-200 px-4 py-8 text-sm text-stone-600 sm:px-6 dark:border-[#1c2721] dark:text-stone-400">
        <Link href="/events" className="mr-6 inline-flex min-h-11 items-center text-emerald-800 hover:text-emerald-950 dark:text-emerald-400 dark:hover:text-emerald-300">
          Browse events
        </Link>
        <Link href="/pricing" className="inline-flex min-h-11 items-center text-emerald-800 hover:text-emerald-950 dark:text-emerald-400 dark:hover:text-emerald-300">
          See pricing
        </Link>
      </footer>
    </main>
  );
}
