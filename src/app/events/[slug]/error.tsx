"use client";
import Link from "next/link";
export default function EventError({ reset }: { reset: () => void }) {
  return <main className="public-page"><section className="empty-state"><h1>We couldn’t load this event just now.</h1><p>Please try again in a moment. If you recently paid, check your payment confirmation before making another payment.</p><button type="button" className="primary-link" onClick={reset}>Try again</button><Link className="text-link" href="/events">Browse other events</Link></section></main>;
}
