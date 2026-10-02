"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";
import type { AuthFormState } from "@/lib/auth/form-state";

type Turnstile = {
  render: (element: HTMLElement, options: Record<string, unknown>) => string;
  remove: (id: string) => void;
};

declare global {
  interface Window { turnstile?: Turnstile }
}

/** Supabase validates this token; a widget alone is not a security boundary. */
export function AuthCaptcha({ state }: { state: AuthFormState }) {
  const sitekey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const container = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!ready || !sitekey || !container.current || !window.turnstile) return;
    const api = window.turnstile;
    const id = api.render(container.current, {
      sitekey,
      theme: "auto",
      size: "flexible",
      "error-callback": () => setFailed(true),
      callback: () => setFailed(false),
    });
    // A returned action state means the previous single-use token may be consumed.
    return () => api.remove(id);
  }, [ready, sitekey, state]);

  if (!sitekey) return null;
  return <>
    <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" strategy="afterInteractive" onReady={() => setReady(true)} onError={() => setFailed(true)} />
    <div ref={container} aria-label="Security verification" />
    {failed && <p className="form-message" role="alert">Security verification could not load. Refresh the page and try again.</p>}
  </>;
}
