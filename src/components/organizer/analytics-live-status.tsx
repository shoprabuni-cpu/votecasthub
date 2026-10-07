"use client";

import { useEffect, useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icon";

export function AnalyticsLiveStatus({
  asOf,
  refresh,
  startsAt,
  upcoming,
}: {
  asOf: string;
  refresh: boolean;
  startsAt: string;
  upcoming: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [now, setNow] = useState(() => Date.parse(asOf));

  useEffect(() => {
    const clock = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(clock);
  }, []);

  useEffect(() => {
    if (!refresh || pending) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState !== "visible" || document.activeElement?.matches("input,select,textarea")) return;
      startTransition(() => router.refresh());
    }, 30000);
    return () => window.clearInterval(timer);
  }, [refresh, pending, router]);

  const age = Math.max(0, Math.floor((now - Date.parse(asOf)) / 1000));
  const remaining = Math.max(0, Math.ceil((Date.parse(startsAt) - now) / 60000));

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-emerald-100/90 pt-3 border-t border-white/10">
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex items-center gap-1.5 font-medium">
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>Last synced {age < 60 ? `${age}s ago` : `${Math.floor(age / 60)}m ago`}</span>
        </span>
        {refresh && <span className="text-emerald-200/60 hidden sm:inline">· Auto-syncs every 30s</span>}
        {upcoming && (
          <span className="font-semibold text-amber-200">
            {remaining
              ? `· Opens in ${Math.floor(remaining / 1440)}d ${Math.floor((remaining % 1440) / 60)}h ${remaining % 60}m`
              : "· Start time reached"}
          </span>
        )}
      </div>

      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(() => router.refresh())}
        className="inline-flex items-center gap-1.5 rounded-xl border border-white/20 bg-white/10 px-3 py-1.5 font-semibold text-white hover:bg-white/20 transition-all active:scale-95 cursor-pointer disabled:opacity-50"
      >
        <span className={pending ? "animate-spin" : ""}>↻</span>
        <span>{pending ? "Syncing..." : "Sync Now"}</span>
      </button>
    </div>
  );
}

export function ShareEventButton({ slug }: { slug: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    const url = new URL(`/events/${encodeURIComponent(slug)}`, window.location.origin).href;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // fallback
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={copy}
        className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-900 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-800 transition-all active:scale-95 cursor-pointer"
      >
        <Icon name="sparkle" size={13} />
        <span>{copied ? "Link Copied! ✓" : "Copy Ballot Link"}</span>
      </button>

      <a
        href={`/events/${encodeURIComponent(slug)}`}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1 text-xs font-semibold text-stone-700 hover:text-emerald-900 px-3 py-2"
      >
        <span>Open Public Page</span>
        <Icon name="arrowRight" size={13} />
      </a>
    </div>
  );
}
