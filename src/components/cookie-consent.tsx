"use client";

import { useEffect, useState } from "react";

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

export function CookieSettingsLink() {
  return <button className="cookie-settings-link" type="button" onClick={() => window.dispatchEvent(new Event("vch-cookie-settings"))}>Cookie settings</button>;
}

export function CookieConsent() {
  const [consent, setConsent] = useState<Consent | null>(null);
  const [open, setOpen] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);

  useEffect(() => {
    const existing = loadConsent();
    setConsent(existing);
    setAnalytics(existing?.analytics ?? false);
    setMarketing(existing?.marketing ?? false);
    const show = () => setOpen(true);
    window.addEventListener("vch-cookie-settings", show);
    return () => window.removeEventListener("vch-cookie-settings", show);
  }, []);

  function save(next: Pick<Consent, "analytics" | "marketing">) {
    const value = { ...next, updatedAt: new Date().toISOString() };
    try { window.localStorage.setItem(KEY, JSON.stringify(value)); } catch { /* Preferences remain optional if storage is unavailable. */ }
    setConsent(value);
    setOpen(false);
    window.dispatchEvent(new CustomEvent("vch-consent-updated", { detail: value }));
  }

  if (consent && !open) return <button className="cookie-reopen" type="button" onClick={() => setOpen(true)}>Privacy choices</button>;
  return (
    <aside className="cookie-banner" aria-label="Cookie and tracking preferences">
      <div className="cookie-copy">
        <p className="eyebrow">YOUR PRIVACY, YOUR CHOICE</p>
        <h2>{open ? "Choose what you allow" : "Your privacy choices"}</h2>
        <p>Essential storage keeps sign-in and security working. Optional analytics help us understand site use; marketing trackers may measure campaigns. Optional categories stay off until you choose them. See our <a href="/privacy">Privacy Policy</a>.</p>
        {open && <div className="cookie-options">
          <label><span><strong>Essential</strong><small>Sign-in, security and core site functions</small></span><input type="checkbox" checked disabled aria-label="Essential storage always enabled" /></label>
          <label><span><strong>Analytics</strong><small>Usage measurement, only when a provider is configured</small></span><input type="checkbox" checked={analytics} onChange={e => setAnalytics(e.target.checked)} /></label>
          <label><span><strong>Marketing</strong><small>Advertising measurement, only when a provider is configured</small></span><input type="checkbox" checked={marketing} onChange={e => setMarketing(e.target.checked)} /></label>
        </div>}
      </div>
      <div className="cookie-actions">
        {open ? <>
          <button type="button" className="secondary-button" onClick={() => save({ analytics: false, marketing: false })}>Reject optional</button>
          <button type="button" className="secondary-button" onClick={() => save({ analytics, marketing })}>Save choices</button>
          <button type="button" className="primary-link" onClick={() => save({ analytics: true, marketing: true })}>Allow all</button>
        </> : <>
          <button type="button" className="secondary-button" onClick={() => save({ analytics: false, marketing: false })}>Reject optional</button>
          <button type="button" className="secondary-button" onClick={() => setOpen(true)}>Manage</button>
          <button type="button" className="primary-link" onClick={() => save({ analytics: true, marketing: true })}>Allow all</button>
        </>}
      </div>
    </aside>
  );
}
