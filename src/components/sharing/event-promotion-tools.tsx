"use client";

import { useId, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Icon } from "@/components/icon";
import { ghanaDate } from "@/lib/events/presentation";
import { generateQrDataUrl } from "@/lib/qr";

function escapeHtml(value: string) { return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
export function EventPromotionTools({ name, url, endsAt, phase = "open" }: { name: string; url: string; endsAt?: string; phase?: "scheduled" | "open" | "paused" | "ended" }) {
  const [message, setMessage] = useState("");
  const [copying, setCopying] = useState(false);
  const [failed, setFailed] = useState(false);
  const [qrData, setQrData] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const linkId = useId();
  const linkInput = useRef<HTMLInputElement>(null);
  const websiteInput = useRef<HTMLTextAreaElement>(null);
  const advanced = useRef<HTMLDetailsElement>(null);

  async function loadQr() {
    if (qrData) return;
    setQrLoading(true);
    try {
      const dataUrl = await generateQrDataUrl(url, { width: 320, margin: 1 });
      setQrData(dataUrl);
    } catch {
      // ignore
    } finally {
      setQrLoading(false);
    }
  }

  function downloadQr() {
    if (!qrData) return;
    const a = document.createElement("a");
    a.href = qrData;
    a.download = `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-qr.png`;
    a.click();
  }
  const snippet = `<a href="${escapeHtml(url)}">Vote in ${escapeHtml(name)} on VotecastHub GH</a>`;
  const invite = phase === "ended" ? `Explore ${name} on VotecastHub GH.` : phase === "paused" ? `Meet the nominees in ${name}. Voting is currently paused.` : phase === "scheduled" ? `Meet the nominees in ${name}. Voting opens soon!` : `Vote in ${name} on VotecastHub GH!`;
  const shareText = `${invite}${endsAt && phase !== "ended" ? `\nVoting closes ${ghanaDate(endsAt)} (Ghana time).` : ""}\n${url}`;
  async function copy(value: string, website = false) {
    setCopying(true); setFailed(false); setMessage("");
    try { await navigator.clipboard.writeText(value); setMessage(website ? "Website link copied." : "Event link copied. Ready to share!"); }
    catch {
      setFailed(true);
      if (website) { if (advanced.current) advanced.current.open = true; websiteInput.current?.focus(); websiteInput.current?.select(); }
      else { linkInput.current?.focus(); linkInput.current?.select(); }
      setMessage("Copy isn’t available here. The text is selected so you can copy it manually.");
    } finally { setCopying(false); }
  }
  return <section id="share-event" className="scroll-mt-6 overflow-hidden rounded-2xl border border-emerald-200 bg-white shadow-xs dark:border-emerald-900/40 dark:bg-[#0c120e]" aria-labelledby="promote-event-title">
    <div className="bg-linear-to-br from-emerald-50 to-white p-5 sm:p-6 dark:from-emerald-950/40 dark:to-[#0c120e]"><div className="flex items-start gap-3"><span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-900 dark:border dark:border-emerald-800/60 dark:bg-emerald-950/60 dark:text-emerald-300"><Icon name="users" size={21} /></span><div><h2 id="promote-event-title" className="text-lg font-semibold text-stone-900 dark:text-white">{phase === "ended" ? "Share your event highlights" : "Bring your audience to your event"}</h2><p className="mt-1 text-sm leading-6 text-stone-600 dark:text-stone-300">{phase === "ended" ? "Send people to the event page to explore the nominees and available results." : phase === "paused" ? "Share the event page while voting is paused. Your message will make the pause clear." : phase === "scheduled" ? "Let people meet the nominees before voting opens." : "One link takes voters straight to your event. Share it with your community."}</p></div></div>
      <label htmlFor={linkId} className="mt-5 block text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400">Your event link</label><div className="mt-2 flex flex-col gap-2 sm:flex-row"><input id={linkId} ref={linkInput} className="min-h-12 min-w-0 flex-1 rounded-xl border border-stone-200 bg-white px-3 text-base text-stone-700 focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20 sm:text-sm dark:border-[#1c2721] dark:bg-[#141d18] dark:text-stone-200" readOnly value={url} onFocus={event => event.target.select()} /><button type="button" disabled={copying} onClick={() => copy(url)} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-emerald-900 px-5 py-3 text-sm font-semibold text-white shadow-xs hover:bg-emerald-800 disabled:opacity-50 min-h-11 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed dark:bg-emerald-700 dark:hover:bg-emerald-600"><Icon name="copy" size={17} />{copying ? "Copying…" : "Copy event link"}</button></div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <a href={`https://wa.me/?text=${encodeURIComponent(shareText)}`} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900 hover:bg-emerald-100 shadow-2xs dark:border-emerald-900/60 dark:bg-emerald-950/60 dark:text-emerald-300 dark:hover:bg-emerald-900/60">
          <Image src="/images/whatsapp-logo.jpg" alt="" width={18} height={18} className="rounded-full" />
          <span>Share on WhatsApp</span>
        </a>
        <a href={`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(shareText)}`} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-sky-300 bg-sky-50 px-4 py-3 text-sm font-semibold text-sky-900 hover:bg-sky-100 shadow-2xs dark:border-sky-900/60 dark:bg-sky-950/60 dark:text-sky-300 dark:hover:bg-sky-900/60">
          <Image src="/images/telegram-logo.jpg" alt="" width={18} height={18} className="rounded-full" />
          <span>Share on Telegram</span>
        </a>
        <button
          type="button"
          onClick={loadQr}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-stone-300 bg-white px-4 py-3 text-sm font-semibold text-stone-800 hover:bg-stone-50 shadow-2xs cursor-pointer dark:border-[#1c2721] dark:bg-[#141d18] dark:text-stone-200 dark:hover:bg-[#1c2721]"
        >
          <span>📷</span>
          <span>{qrData ? "QR Code Ready" : qrLoading ? "Generating QR…" : "Get Event QR Code"}</span>
        </button>
        <span className="text-center text-xs text-stone-500 sm:text-left dark:text-stone-400">{phase === "ended" ? "Your message links to the event page." : "The message includes your link and voting deadline."}</span>
      </div>

      {qrData && (
        <div className="mt-4 rounded-xl border border-stone-200 bg-white p-4 shadow-2xs flex flex-col sm:flex-row items-center gap-4 dark:border-[#1c2721] dark:bg-[#141d18]">
          <img src={qrData} alt={`${name} QR Code`} width={120} height={120} className="rounded-lg border border-stone-200 p-1 dark:border-stone-700 bg-white" />
          <div className="space-y-1.5 text-center sm:text-left">
            <span className="font-bold text-xs text-stone-900 dark:text-white block">Print &amp; Digital Voter QR Code</span>
            <p className="text-[11px] text-stone-500 dark:text-stone-400 max-w-sm">
              Use this QR code on physical badges, roll-up banners, flyers, and projection screens. Voters scan directly to open this ballot.
            </p>
            <button
              type="button"
              onClick={downloadQr}
              className="mt-1 inline-flex items-center gap-1.5 rounded-lg bg-stone-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-stone-800 cursor-pointer dark:bg-emerald-700 dark:hover:bg-emerald-600"
            >
              <span>📥 Download High-Res QR (PNG)</span>
            </button>
          </div>
        </div>
      )}
      {message && <p className={`mt-3 rounded-xl border px-3 py-2.5 text-sm ${failed ? "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300" : "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300"}`} role={failed ? "alert" : "status"}>{message}</p>}
    </div>
    <details ref={advanced} className="border-t border-stone-100 px-5 py-3 sm:px-6 dark:border-[#1c2721]"><summary className="cursor-pointer py-2 text-sm font-semibold text-stone-600 border border-stone-300 bg-white shadow-xs rounded-xl px-4 min-h-11 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#1c2721] dark:bg-[#141d18] dark:text-stone-300">Website &amp; promotion tools</summary><div className="space-y-3 pb-2 pt-3"><label className="block text-sm font-medium text-stone-700 dark:text-stone-300">Website link HTML<textarea ref={websiteInput} readOnly value={snippet} rows={3} onFocus={event => event.target.select()} className="mt-2 w-full rounded-xl border border-stone-200 bg-stone-50 p-3 font-mono text-xs leading-5 dark:border-[#1c2721] dark:bg-[#0c120e] dark:text-stone-200" /></label><div className="flex flex-wrap gap-3"><button type="button" disabled={copying} onClick={() => copy(snippet, true)} className="min-h-11 rounded-xl border border-stone-300 px-4 text-sm font-semibold text-stone-700 hover:bg-stone-50 disabled:opacity-50 bg-white shadow-xs py-2.5 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed dark:border-[#1c2721] dark:bg-[#0c120e] dark:text-stone-200 dark:hover:bg-[#141d18]">Copy website link HTML</button><Link href="/guides/promote-your-event-and-nominees" className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-emerald-900 border border-stone-300 bg-white shadow-xs rounded-xl px-4 py-2.5 min-h-11 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#1c2721] dark:bg-[#0c120e] dark:text-emerald-300 dark:hover:bg-[#141d18]">Read the promotion guide<Icon name="arrowRight" size={15} /></Link></div></div></details>
  </section>;
}
