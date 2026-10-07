"use client";
import { useEffect, useTransition, useState } from "react";
import { useRouter } from "next/navigation";

export function AnalyticsLiveStatus({ asOf, refresh, startsAt, upcoming }: { asOf: string; refresh: boolean; startsAt: string; upcoming: boolean }) {
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
  return <div className="flex flex-wrap items-center gap-3 text-xs text-green-100">
    <span>Last updated: {age < 60 ? `${age}s ago` : `${Math.floor(age / 60)}m ago`}</span>
    {refresh && <span>Updates every 30 seconds while visible</span>}
    {upcoming && <span>{remaining ? `Opens in ${Math.floor(remaining / 1440)}d ${Math.floor(remaining % 1440 / 60)}h ${remaining % 60}m` : "Scheduled start reached · refresh for status"}</span>}
    <button type="button" disabled={pending} onClick={() => startTransition(() => router.refresh())} className="rounded-lg border border-white/30 px-3 py-2">{pending ? "Updating…" : "Refresh now"}</button>
  </div>;
}

export function ShareEventButton({ slug }: { slug: string }) {
  const [message, setMessage] = useState("");
  async function copy() {
    const url = new URL(`/events/${encodeURIComponent(slug)}`, window.location.origin).href;
    try { await navigator.clipboard.writeText(url); setMessage("Event link copied"); }
    catch { setMessage("Copy the link from the event page."); }
  }
  return <div className="flex flex-wrap items-center gap-3"><button type="button" onClick={copy} className="rounded-xl bg-[#1e704d] px-4 py-2 text-sm font-semibold text-white">Copy event link</button><a className="text-sm text-green-800 underline" href={`/events/${encodeURIComponent(slug)}`}>Open event page</a><span role="status" className="text-sm text-slate-500">{message}</span></div>;
}
