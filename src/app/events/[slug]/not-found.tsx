import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
export default function EventNotFound() {
  return <main className="public-page"><SiteHeader /><section className="empty-state"><span className="empty-icon" aria-hidden="true">◇</span><h1>This page is no longer available.</h1><p>The organizer may have unpublished or archived the event, or the link may be out of date. No vote or payment was started from this page.</p><Link className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-900 bg-emerald-900 px-5 py-3 text-sm font-semibold text-white shadow-xs hover:bg-emerald-800 min-h-11 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-50" href="/events">Explore available events</Link></section></main>;
}
