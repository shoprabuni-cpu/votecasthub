"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

type Consent = { analytics: boolean; marketing: boolean; updatedAt: string };
const KEY = "vch-cookie-consent-v1";

function loadConsent(): Consent | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) as Consent : null;
  } catch {
    return null;
  }
}

function consentSnapshot() {
  try { return window.localStorage.getItem(KEY); } catch { return null; }
}
function subscribeToConsent(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener("vch-consent-updated", onChange);
  return () => { window.removeEventListener("storage", onChange); window.removeEventListener("vch-consent-updated", onChange); };
}
const serverConsent = () => null;

export function CookieSettingsLink() {
  return (
    <button
      className="cursor-pointer text-inherit underline underline-offset-4 hover:text-emerald-700 dark:hover:text-emerald-400"
      type="button"
      onClick={() => window.dispatchEvent(new Event("vch-cookie-settings"))}
    >
      Cookie settings
    </button>
  );
}

export function CookieConsent() {
  const [sessionConsent, setConsent] = useState<Consent | null>(null);
  const storedConsent = useSyncExternalStore(subscribeToConsent, consentSnapshot, serverConsent);
  let consent = sessionConsent;
  try { if (!consent && storedConsent) consent = JSON.parse(storedConsent) as Consent; } catch { /* Invalid storage leaves optional consent unset. */ }
  const [open, setOpen] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);

  useEffect(() => {
    const show = () => {
      const existing = loadConsent();
      setAnalytics(existing?.analytics ?? false);
      setMarketing(existing?.marketing ?? false);
      setOpen(true);
    };
    window.addEventListener("vch-cookie-settings", show);
    return () => window.removeEventListener("vch-cookie-settings", show);
  }, []);

  function save(next: Pick<Consent, "analytics" | "marketing">) {
    const value = { ...next, updatedAt: new Date().toISOString() };
    let stored = false;
    try { window.localStorage.setItem(KEY, JSON.stringify(value)); stored = true; } catch { /* Preferences remain optional if storage is unavailable. */ }
    setConsent(stored ? null : value);
    setOpen(false);
    window.dispatchEvent(new CustomEvent("vch-consent-updated", { detail: value }));
  }

  function showChoices() {
    setAnalytics(consent?.analytics ?? false);
    setMarketing(consent?.marketing ?? false);
    setOpen(true);
  }
  if (consent && !open) {
    return (
      <button
        className="fixed bottom-4 right-4 z-40 rounded-full border border-stone-200 bg-white px-3.5 py-2 text-xs font-semibold text-stone-700 shadow-md transition hover:bg-stone-50 cursor-pointer dark:border-[#1c2721] dark:bg-[#0c120e] dark:text-stone-300"
        type="button"
        onClick={showChoices}
      >
        Privacy choices
      </button>
    );
  }
  return (
    <aside className="fixed bottom-5 right-5 z-50 w-[min(600px,calc(100vw-32px))] rounded-2xl border border-stone-200 bg-white p-5 shadow-2xl dark:border-[#1c2721] dark:bg-[#0c120e] dark:text-stone-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-5" aria-label="Cookie and tracking preferences">
      <div className="flex-1">
        <p className="text-[10px] font-bold tracking-widest text-emerald-800 dark:text-emerald-400 uppercase">YOUR PRIVACY, YOUR CHOICE</p>
        <h2 className="font-serif text-lg font-medium text-stone-900 dark:text-white mt-1 mb-1.5">{open ? "Choose what you allow" : "Your privacy choices"}</h2>
        <p className="text-xs leading-relaxed text-stone-600 dark:text-stone-300 max-w-sm">Essential storage keeps sign-in and security working. Optional analytics help us understand site use; marketing trackers may measure campaigns. Optional categories stay off until you choose them. See our <a href="/privacy" className="font-semibold text-emerald-800 underline dark:text-emerald-400">Privacy Policy</a>.</p>
        {open && (
          <div className="mt-3 space-y-2">
            <label className="flex items-center justify-between gap-3 p-2 rounded-lg border border-stone-200 dark:border-stone-800 text-xs">
              <span><strong>Essential</strong><small className="block text-[10px] text-stone-500">Sign-in, security and core site functions</small></span>
              <input type="checkbox" checked disabled aria-label="Essential storage always enabled" className="accent-emerald-800" />
            </label>
            <label className="flex items-center justify-between gap-3 p-2 rounded-lg border border-stone-200 dark:border-stone-800 text-xs cursor-pointer">
              <span><strong>Analytics</strong><small className="block text-[10px] text-stone-500">Usage measurement, only when a provider is configured</small></span>
              <input type="checkbox" checked={analytics} onChange={e => setAnalytics(e.target.checked)} className="accent-emerald-800" />
            </label>
            <label className="flex items-center justify-between gap-3 p-2 rounded-lg border border-stone-200 dark:border-stone-800 text-xs cursor-pointer">
              <span><strong>Marketing</strong><small className="block text-[10px] text-stone-500">Advertising measurement, only when a provider is configured</small></span>
              <input type="checkbox" checked={marketing} onChange={e => setMarketing(e.target.checked)} className="accent-emerald-800" />
            </label>
          </div>
        )}
      </div>
      <div className="flex flex-col gap-2 shrink-0 w-full md:w-auto">
        {open ? (
          <>
            <button type="button" className="inline-flex min-h-9 items-center justify-center rounded-xl border border-stone-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-stone-700 shadow-2xs hover:bg-stone-50 transition cursor-pointer dark:border-[#1c2721] dark:bg-[#141d18] dark:text-stone-200" onClick={() => save({ analytics: false, marketing: false })}>Reject optional</button>
            <button type="button" className="inline-flex min-h-9 items-center justify-center rounded-xl border border-stone-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-stone-700 shadow-2xs hover:bg-stone-50 transition cursor-pointer dark:border-[#1c2721] dark:bg-[#141d18] dark:text-stone-200" onClick={() => save({ analytics, marketing })}>Save choices</button>
            <button type="button" className="inline-flex min-h-9 items-center justify-center rounded-xl bg-emerald-900 px-3.5 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-emerald-800 transition cursor-pointer dark:bg-emerald-600 dark:hover:bg-emerald-500" onClick={() => save({ analytics: true, marketing: true })}>Allow all</button>
          </>
        ) : (
          <>
            <button type="button" className="inline-flex min-h-9 items-center justify-center rounded-xl border border-stone-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-stone-700 shadow-2xs hover:bg-stone-50 transition cursor-pointer dark:border-[#1c2721] dark:bg-[#141d18] dark:text-stone-200" onClick={() => save({ analytics: false, marketing: false })}>Reject optional</button>
            <button type="button" className="inline-flex min-h-9 items-center justify-center rounded-xl border border-stone-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-stone-700 shadow-2xs hover:bg-stone-50 transition cursor-pointer dark:border-[#1c2721] dark:bg-[#141d18] dark:text-stone-200" onClick={showChoices}>Manage</button>
            <button type="button" className="inline-flex min-h-9 items-center justify-center rounded-xl bg-emerald-900 px-3.5 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-emerald-800 transition cursor-pointer dark:bg-emerald-600 dark:hover:bg-emerald-500" onClick={() => save({ analytics: true, marketing: true })}>Allow all</button>
          </>
        )}
      </div>
    </aside>
  );
}
