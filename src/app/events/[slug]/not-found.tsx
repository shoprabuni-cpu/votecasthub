import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
export default function EventNotFound() {
  return <main className="public-page"><SiteHeader /><section className="empty-state"><span className="empty-icon" aria-hidden="true">◇</span><h1>This page is no longer available.</h1><p>The organizer may have unpublished or archived the event, or the link may be out of date. No vote or payment was started from this page.</p><Link className="primary-link" href="/events">Explore available events</Link></section></main>;
}
