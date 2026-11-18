'use client';

import React, { useState } from 'react';
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
      <div className="flex h-48 w-48 items-center justify-center rounded-2xl border border-stone-200/80 bg-stone-100/40 text-xs font-medium text-stone-400 dark:border-[#1c2721] dark:bg-[#0c120e]">
        Loading folder...
      </div>
    ),
  }
);

const ORGANIZER_ITEMS: FolderItem[] = [
  {
    title: 'How to run an online awards vote',
    description: 'Plan categories, add nominees & set rules',
    slug: 'online-voting-for-awards-in-ghana',
    tag: 'Awards'
  },
  {
    title: 'School & association elections',
    description: 'Ballot positions, schedules & voter roster',
    slug: 'planning-a-school-or-association-election',
    tag: 'Elections'
  },
  {
    title: 'Voter checks & vote limits',
    description: 'Fraud prevention & transparent audit controls',
    slug: 'voter-verification-and-voting-limits',
    tag: 'Security'
  },
  {
    title: 'Promote your event & nominees',
    description: 'Share direct event links & voting badges',
    slug: 'promote-your-event-and-nominees',
    tag: 'Promotion'
  }
];

const VOTER_CHANNEL_ITEMS: FolderItem[] = [
  {
    title: 'Vote with WhatsApp (+233 59 299 2566)',
    description: 'Step-by-step bot flow & instant Mobile Money',
    slug: 'how-to-vote-on-whatsapp',
    tag: 'WhatsApp'
  },
  {
    title: 'Vote with Telegram (@VotecastHubGH_bot)',
    description: 'Interactive nominee photos & one-tap MoMo',
    slug: 'how-to-vote-on-telegram',
    tag: 'Telegram'
  },
  {
    title: 'Offline USSD phone dialing',
    description: 'Vote on basic feature phones without internet',
    slug: 'vote-without-internet-ussd',
    tag: 'USSD'
  }
];

export function GuidesFolderShowcase() {
  const router = useRouter();
  const [, setSelectedGuide] = useState<FolderItem | null>(null);

  const handleItemSelect = (item: FolderItem) => {
    setSelectedGuide(item);
    if (item?.slug) {
      router.push(`/guides/${item.slug}`);
    }
  };

  return (
    <div className="w-full">
      {/* 3D Folders Interactive Area */}
      <div className="relative my-8 flex flex-col items-center justify-center gap-10 rounded-3xl border border-stone-200/80 bg-gradient-to-b from-stone-50/80 via-white to-stone-50/50 p-6 sm:p-10 md:flex-row md:gap-16 dark:border-[#1c2721] dark:bg-gradient-to-b dark:from-[#0a0f0d] dark:via-[#0c1310] dark:to-[#080b09]">
        {/* Helper instruction */}
        <div className="absolute top-3 left-4 right-4 flex items-center justify-between text-[11px] font-semibold tracking-wider text-stone-500 uppercase dark:text-stone-400">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 animate-ping rounded-full bg-emerald-500" />
            Interactive 3D Folders • Click to open &amp; drag sheets
          </span>
          <span className="hidden sm:inline">Select any sheet to view guide</span>
        </div>

        {/* Folder 1: Organizer Playbooks */}
        <div className="flex flex-col items-center pt-4">
          <div className="py-2">
            <DynamicFolder
              label="Organizer Guides"
              mode="flap"
              variant="glass"
              color="#059669"
              tabPosition="right"
              layout="spread"
              size={1.05}
              openOn="click"
              draggable={true}
              zoomOnClick={false}
              items={ORGANIZER_ITEMS}
              onItemClick={(item) => handleItemSelect(item)}
              theme="dark"
            />
          </div>
          <div className="mt-3 text-center">
            <p className="text-sm font-semibold text-stone-900 dark:text-white">🏆 Organizer Playbooks</p>
            <p className="text-xs text-stone-500 dark:text-stone-400">Awards, elections, rules &amp; promotion (4 guides)</p>
          </div>
        </div>

        {/* Folder 2: Voter Channels */}
        <div className="flex flex-col items-center pt-4">
          <div className="py-2">
            <DynamicFolder
              label="Voter Channels"
              mode="book"
              variant="glass"
              color="#0284c7"
              tabPosition="right"
              layout="spread"
              size={1.05}
              openOn="click"
              draggable={true}
              zoomOnClick={false}
              items={VOTER_CHANNEL_ITEMS}
              onItemClick={(item) => handleItemSelect(item)}
              theme="dark"
            />
          </div>
          <div className="mt-3 text-center">
            <p className="text-sm font-semibold text-stone-900 dark:text-white">📱 Voter Channels &amp; Bots</p>
            <p className="text-xs text-stone-500 dark:text-stone-400">WhatsApp, Telegram &amp; USSD (3 guides)</p>
          </div>
        </div>
      </div>

      {/* Tactile Quick-Action Buttons */}
      <div className="mt-6">
        <p className="mb-3 text-xs font-bold tracking-wider text-stone-500 uppercase dark:text-stone-400">
          Quick Access Guide Buttons:
        </p>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {GUIDES.map((guide) => (
            <Link
              key={guide.slug}
              href={`/guides/${guide.slug}`}
              className="group flex items-center justify-between rounded-xl border border-stone-200/90 bg-white px-4 py-3 text-left shadow-2xs transition-all hover:-translate-y-0.5 hover:border-emerald-600 hover:shadow-md dark:border-[#1c2721] dark:bg-[#0c120e] dark:hover:border-emerald-500/60 dark:hover:bg-[#101914]"
            >
              <div className="min-w-0 pr-3">
                <p className="truncate text-xs font-semibold text-stone-900 group-hover:text-emerald-700 dark:text-stone-100 dark:group-hover:text-emerald-400">
                  {guide.title}
                </p>
                <p className="mt-0.5 line-clamp-1 text-[11px] text-stone-500 dark:text-stone-400">
                  {guide.description}
                </p>
              </div>
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-stone-200 bg-stone-50 text-xs font-bold text-stone-700 transition group-hover:border-emerald-500 group-hover:bg-emerald-600 group-hover:text-white dark:border-[#223329] dark:bg-[#141e18] dark:text-stone-300 dark:group-hover:bg-emerald-500 dark:group-hover:text-black">
                →
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
