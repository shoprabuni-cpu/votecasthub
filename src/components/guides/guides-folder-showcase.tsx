'use client';

import React from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import type { FolderItem } from '@/components/ui/Folder/Folder';
import { GUIDES } from '@/lib/seo/guides';

const DynamicFolder = dynamic(
  () => import('@/components/ui/Folder/Folder').then((mod) => mod.Folder),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-52 w-52 items-center justify-center rounded-2xl border border-stone-200 bg-stone-50 text-xs font-medium text-stone-400 dark:border-stone-800 dark:bg-[#0d1410] dark:text-stone-500">
        Loading folder...
      </div>
    ),
  }
);

interface ColoredSheetProps {
  category: string;
  categoryBg: string;
  categoryText: string;
  accentGradient: string;
  title: string;
  subtitle: string;
  iconText: string;
  bullet1: string;
  bullet2: string;
}

function ColoredSheet({
  category,
  categoryBg,
  categoryText,
  accentGradient,
  title,
  subtitle,
  iconText,
  bullet1,
  bullet2
}: ColoredSheetProps) {
  return (
    <div className="flex h-full w-full flex-col justify-between overflow-hidden rounded-[6px] bg-white text-stone-900 shadow-sm select-none">
      {/* Top Accent Gradient Bar */}
      <div className={`h-2 w-full ${accentGradient}`} />

      {/* Main Sheet Body */}
      <div className="flex flex-1 flex-col justify-between p-2.5 sm:p-3">
        {/* Category Pill & Icon */}
        <div className="flex items-center justify-between gap-1">
          <span className={`rounded px-1.5 py-0.5 text-[8px] font-bold tracking-wide uppercase ${categoryBg} ${categoryText}`}>
            {category}
          </span>
          <span className="text-[10px] font-bold text-stone-400">{iconText}</span>
        </div>

        {/* Title & Subtitle */}
        <div className="my-1">
          <h4 className="line-clamp-2 text-[10px] font-bold leading-tight text-stone-900 sm:text-[11px]">
            {title}
          </h4>
          <p className="mt-0.5 line-clamp-1 text-[8px] font-medium text-stone-500">
            {subtitle}
          </p>
        </div>

        {/* Feature bullets / document structure lines */}
        <div className="space-y-1 rounded bg-stone-50 p-1.5 border border-stone-100">
          <div className="flex items-center gap-1 text-[7.5px] text-stone-600">
            <span className="h-1 w-1 rounded-full bg-emerald-600" />
            <span className="truncate">{bullet1}</span>
          </div>
          <div className="flex items-center gap-1 text-[7.5px] text-stone-600">
            <span className="h-1 w-1 rounded-full bg-emerald-600" />
            <span className="truncate">{bullet2}</span>
          </div>
        </div>

        {/* Footer Action Bar */}
        <div className="mt-1 flex items-center justify-between border-t border-stone-100 pt-1 text-[7.5px] font-semibold text-emerald-700">
          <span>Official Guide</span>
          <span className="flex items-center gap-0.5">Read →</span>
        </div>
      </div>
    </div>
  );
}

// 4 Designed Organizer Sheets
const ORGANIZER_ITEMS: FolderItem[] = [
  {
    title: 'How to run an online awards vote',
    slug: 'online-voting-for-awards-in-ghana',
    content: (
      <ColoredSheet
        category="Awards Gala"
        categoryBg="bg-amber-100"
        categoryText="text-amber-900"
        accentGradient="bg-gradient-to-r from-amber-500 via-amber-600 to-yellow-500"
        title="Online Awards Vote"
        subtitle="Nominees, categories & pricing"
        iconText="AWARDS"
        bullet1="Category & nominee setup"
        bullet2="Live audit-ready tally"
      />
    )
  },
  {
    title: 'School & association elections',
    slug: 'planning-a-school-or-association-election',
    content: (
      <ColoredSheet
        category="Elections"
        categoryBg="bg-indigo-100"
        categoryText="text-indigo-900"
        accentGradient="bg-gradient-to-r from-indigo-500 via-purple-600 to-indigo-700"
        title="School & Association"
        subtitle="Ballot positions & schedules"
        iconText="CAMPUS"
        bullet1="Candidate portfolios"
        bullet2="Voter roster authentication"
      />
    )
  },
  {
    title: 'Voter checks & vote limits',
    slug: 'voter-verification-and-voting-limits',
    content: (
      <ColoredSheet
        category="Security"
        categoryBg="bg-emerald-100"
        categoryText="text-emerald-900"
        accentGradient="bg-gradient-to-r from-emerald-500 via-teal-600 to-emerald-700"
        title="Voter Verification"
        subtitle="Fraud defense & ballot limits"
        iconText="AUDIT"
        bullet1="Device & IP rate capping"
        bullet2="MoMo duplicate protection"
      />
    )
  },
  {
    title: 'Promote your event & nominees',
    slug: 'promote-your-event-and-nominees',
    content: (
      <ColoredSheet
        category="Promotion"
        categoryBg="bg-rose-100"
        categoryText="text-rose-900"
        accentGradient="bg-gradient-to-r from-rose-500 via-pink-600 to-rose-700"
        title="Promote & Share"
        subtitle="Direct links & vote flyers"
        iconText="GROWTH"
        bullet1="1-tap WhatsApp badges"
        bullet2="Nominee social flyers"
      />
    )
  }
];

// 3 Designed Voter Channel Sheets
const VOTER_CHANNEL_ITEMS: FolderItem[] = [
  {
    title: 'Vote with WhatsApp (+233 59 299 2566)',
    slug: 'how-to-vote-on-whatsapp',
    content: (
      <ColoredSheet
        category="WhatsApp Bot"
        categoryBg="bg-emerald-100"
        categoryText="text-emerald-900"
        accentGradient="bg-gradient-to-r from-[#25D366] via-[#1ebd5b] to-[#128C7E]"
        title="WhatsApp Voting"
        subtitle="+233 59 299 2566 official bot"
        iconText="WHATSAPP"
        bullet1="Type 'VOTE' or event code"
        bullet2="Instant Mobile Money prompt"
      />
    )
  },
  {
    title: 'Vote with Telegram (@VotecastHubGH_bot)',
    slug: 'how-to-vote-on-telegram',
    content: (
      <ColoredSheet
        category="Telegram Bot"
        categoryBg="bg-sky-100"
        categoryText="text-sky-900"
        accentGradient="bg-gradient-to-r from-[#2AABEE] via-[#229ED9] to-[#0088cc]"
        title="Telegram Voting"
        subtitle="@VotecastHubGH_bot official"
        iconText="TELEGRAM"
        bullet1="Interactive photo cards"
        bullet2="One-tap secure MoMo checkout"
      />
    )
  },
  {
    title: 'Offline USSD phone dialing',
    slug: 'vote-without-internet-ussd',
    content: (
      <ColoredSheet
        category="USSD Offline"
        categoryBg="bg-orange-100"
        categoryText="text-orange-900"
        accentGradient="bg-gradient-to-r from-amber-500 via-orange-600 to-amber-700"
        title="USSD Phone Voting"
        subtitle="Dial *920# without internet"
        iconText="OFFLINE"
        bullet1="Works on basic feature phones"
        bullet2="Direct airtime & MoMo debit"
      />
    )
  }
];

// Rich Color Trail metadata for each guide card
const GUIDE_TRAILS: Record<
  string,
  {
    category: string;
    trailBar: string;
    badgeBg: string;
    badgeBorder: string;
    textColor: string;
    readTime: string;
    stepTag: string;
  }
> = {
  'how-to-vote-on-whatsapp': {
    category: 'WhatsApp Bot',
    trailBar: 'bg-emerald-500',
    badgeBg: 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300',
    badgeBorder: 'border-emerald-200 dark:border-emerald-800/60',
    textColor: 'text-emerald-700 dark:text-emerald-400',
    readTime: '3 min read',
    stepTag: 'Official WhatsApp Flow'
  },
  'how-to-vote-on-telegram': {
    category: 'Telegram Bot',
    trailBar: 'bg-sky-500',
    badgeBg: 'bg-sky-50 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300',
    badgeBorder: 'border-sky-200 dark:border-sky-800/60',
    textColor: 'text-sky-700 dark:text-sky-400',
    readTime: '3 min read',
    stepTag: 'Telegram Photo Cards'
  },
  'vote-without-internet-ussd': {
    category: 'Offline USSD',
    trailBar: 'bg-amber-500',
    badgeBg: 'bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300',
    badgeBorder: 'border-amber-200 dark:border-amber-800/60',
    textColor: 'text-amber-700 dark:text-amber-400',
    readTime: '2 min read',
    stepTag: 'No Internet Needed'
  },
  'online-voting-for-awards-in-ghana': {
    category: 'Awards Gala',
    trailBar: 'bg-yellow-500',
    badgeBg: 'bg-yellow-50 text-yellow-800 dark:bg-yellow-950/60 dark:text-yellow-300',
    badgeBorder: 'border-yellow-200 dark:border-yellow-800/60',
    textColor: 'text-yellow-700 dark:text-yellow-400',
    readTime: '5 min read',
    stepTag: 'Award Categories'
  },
  'planning-a-school-or-association-election': {
    category: 'Campus Elections',
    trailBar: 'bg-indigo-500',
    badgeBg: 'bg-indigo-50 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300',
    badgeBorder: 'border-indigo-200 dark:border-indigo-800/60',
    textColor: 'text-indigo-700 dark:text-indigo-400',
    readTime: '4 min read',
    stepTag: 'Voter Verification'
  },
  'voter-verification-and-voting-limits': {
    category: 'Security & Caps',
    trailBar: 'bg-red-500',
    badgeBg: 'bg-red-50 text-red-800 dark:bg-red-950/60 dark:text-red-300',
    badgeBorder: 'border-red-200 dark:border-red-800/60',
    textColor: 'text-red-700 dark:text-red-400',
    readTime: '4 min read',
    stepTag: 'Anti-Fraud Controls'
  },
  'promote-your-event-and-nominees': {
    category: 'Promote & Share',
    trailBar: 'bg-rose-500',
    badgeBg: 'bg-rose-50 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300',
    badgeBorder: 'border-rose-200 dark:border-rose-800/60',
    textColor: 'text-rose-700 dark:text-rose-400',
    readTime: '3 min read',
    stepTag: '1-Tap Vote Badges'
  }
};

export function GuidesFolderShowcase() {
  const router = useRouter();

  const handleItemSelect = (item: FolderItem) => {
    if (item?.slug) {
      router.push(`/guides/${item.slug}`);
    }
  };

  return (
    <div className="w-full">
      {/* 3D Solid Folders Display (spaced generously with clean layout) */}
      <div className="my-8 flex flex-col items-center justify-center gap-16 py-8 sm:py-12 md:flex-row md:gap-24 lg:gap-36">
        {/* Folder 1: Organizer Playbooks (Solid Emerald) */}
        <div className="flex flex-col items-center">
          <div className="py-2">
            <DynamicFolder
              label="Organizer Guides"
              mode="flap"
              variant="solid"
              color="#047857"
              tabPosition="right"
              layout="spread"
              size={1.1}
              openOn="click"
              draggable={true}
              zoomOnClick={false}
              items={ORGANIZER_ITEMS}
              onItemClick={(item) => handleItemSelect(item)}
              theme="dark"
            />
          </div>
          <div className="mt-5 text-center">
            <h3 className="text-base font-semibold text-stone-900 dark:text-white tracking-tight">Organizer Playbooks</h3>
            <p className="mt-1 text-xs text-stone-500 dark:text-stone-400 max-w-[240px]">
              Step-by-step blueprints for awards, campus elections, security &amp; event promotion.
            </p>
          </div>
        </div>

        {/* Folder 2: Voter Channels (Solid Sapphire) */}
        <div className="flex flex-col items-center">
          <div className="py-2">
            <DynamicFolder
              label="Voter Channels"
              mode="book"
              variant="solid"
              color="#0284c7"
              tabPosition="right"
              layout="spread"
              size={1.1}
              openOn="click"
              draggable={true}
              zoomOnClick={false}
              items={VOTER_CHANNEL_ITEMS}
              onItemClick={(item) => handleItemSelect(item)}
              theme="dark"
            />
          </div>
          <div className="mt-5 text-center">
            <h3 className="text-base font-semibold text-stone-900 dark:text-white tracking-tight">Voter Channels &amp; Bots</h3>
            <p className="mt-1 text-xs text-stone-500 dark:text-stone-400 max-w-[240px]">
              Complete walkthroughs for WhatsApp bot, Telegram bot, and offline USSD dialing.
            </p>
          </div>
        </div>
      </div>

      {/* Guide Cards with Color Trails (Red, Blue, Amber, Yellow, Purple, etc.) */}
      <div className="mt-10">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-xs font-bold tracking-widest text-emerald-800 dark:text-emerald-400 uppercase">
            All Guides &amp; Tutorials
          </p>
          <span className="text-xs text-stone-500 dark:text-stone-400">7 playbooks available</span>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {GUIDES.map((guide) => {
            const trail = GUIDE_TRAILS[guide.slug] || {
              category: 'Guide',
              trailBar: 'bg-emerald-500',
              badgeBg: 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300',
              badgeBorder: 'border-emerald-200 dark:border-emerald-800/60',
              textColor: 'text-emerald-700 dark:text-emerald-400',
              readTime: '3 min read',
              stepTag: 'Step-by-step'
            };

            return (
              <Link
                key={guide.slug}
                href={`/guides/${guide.slug}`}
                className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-stone-200 bg-white p-5 text-left shadow-2xs transition-all duration-200 hover:-translate-y-1 hover:shadow-lg dark:border-[#1c2721] dark:bg-[#0c120e] dark:hover:border-stone-700"
              >
                {/* Vertical Color Trail Bar */}
                <div
                  className={`absolute top-0 bottom-0 left-0 w-1.5 transition-all group-hover:w-2 ${trail.trailBar}`}
                  aria-hidden="true"
                />

                <div>
                  {/* Top Badge & Read Time */}
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`rounded-full border px-2.5 py-0.5 text-[10.5px] font-bold tracking-wider uppercase ${trail.badgeBg} ${trail.badgeBorder}`}
                    >
                      {trail.category}
                    </span>
                    <span className="text-[11px] font-medium text-stone-400 dark:text-stone-500">
                      {trail.readTime}
                    </span>
                  </div>

                  {/* Title */}
                  <h4 className="mt-3 text-sm font-bold leading-snug text-stone-900 transition-colors group-hover:text-emerald-800 dark:text-stone-100 dark:group-hover:text-emerald-400">
                    {guide.title}
                  </h4>

                  {/* Description */}
                  <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-stone-600 dark:text-stone-300">
                    {guide.description}
                  </p>
                </div>

                {/* Footer with Step Tag and Action Pill */}
                <div className="mt-4 flex items-center justify-between border-t border-stone-100 pt-3 dark:border-stone-800/70">
                  <span className="text-[11px] font-medium text-stone-500 dark:text-stone-400">
                    {trail.stepTag}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 text-xs font-semibold ${trail.textColor}`}
                  >
                    Read Guide
                    <span className="transition-transform group-hover:translate-x-1">→</span>
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
