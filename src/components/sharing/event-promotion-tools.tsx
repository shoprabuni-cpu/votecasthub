"use client";
import { useState } from "react";
import Link from "next/link";

function escapeHtml(value: string) { return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
export function EventPromotionTools({ name, url }: { name: string; url: string }) {
  const [message, setMessage] = useState("");
  const snippet = `<a href="${escapeHtml(url)}">Vote in ${escapeHtml(name)} on VotecastHub GH</a>`;
  async function copy(value: string, label: string) {
    try { await navigator.clipboard.writeText(value); setMessage(`${label} copied.`); }
    catch { setMessage("Copying could not open. Select and copy the text below."); }
  }
  return <section className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-5 sm:p-6" aria-labelledby="promote-event-title">
    <h2 id="promote-event-title" className="text-lg font-semibold text-emerald-950">Share your public event</h2><p className="mt-2 text-sm leading-6 text-stone-700">Put this link on your organization’s website and social profiles. Include the event name, voting deadline and participation rules in your announcement.</p>
    <label className="mt-4 block text-sm font-semibold text-stone-800">Public event link<input className="mt-2 min-h-11 w-full rounded-xl border border-stone-300 bg-white px-3 text-sm font-normal" readOnly value={url} onFocus={event => event.target.select()} /></label>
    <div className="mt-3 flex flex-wrap gap-3"><button type="button" onClick={() => copy(url, "Event link")} className="min-h-11 rounded-xl bg-emerald-900 px-4 text-sm font-semibold text-white">Copy event link</button><button type="button" onClick={() => copy(snippet, "Website link")} className="min-h-11 rounded-xl border border-emerald-300 bg-white px-4 text-sm font-semibold text-emerald-900">Copy website link HTML</button><Link href="/guides/promote-your-event-and-nominees" className="inline-flex min-h-11 items-center text-sm font-semibold text-emerald-900 underline">Read the promotion guide</Link></div>
    <details className="mt-3 text-sm text-stone-700"><summary className="cursor-pointer py-2">Website link HTML</summary><pre className="mt-2 overflow-x-auto rounded-xl bg-white p-3 text-xs"><code>{snippet}</code></pre></details>
    {message && <p className="mt-3 text-sm text-emerald-900" role="status">{message}</p>}
  </section>;
}
