"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";
import type { AuthFormState } from "@/lib/auth/form-state";

type Turnstile = {
  render: (element: HTMLElement, options: Record<string, unknown>) => string;
  remove: (id: string) => void;
  reset: (id: string) => void;
};

declare global {
  interface Window { turnstile?: Turnstile }
}

/** Supabase validates this token; a widget alone is not a security boundary. */
export function AuthCaptcha({
  state,
  onVerified,
}: {
  state: AuthFormState;
  /** Called with `true` when a valid token is obtained, `false` when it expires/fails. */
  onVerified?: (verified: boolean) => void;
}) {
  const sitekey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const container = useRef<HTMLDivElement>(null);
  const response = useRef<HTMLInputElement>(null);
  const widget = useRef<string | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  function setToken(token: string | null) {
    if (response.current) response.current.value = token ?? "";
  }

  useEffect(() => {
    if (!sitekey) return;
    const form = container.current?.closest("form");
    if (!form) return;
    function guardSubmission(event: SubmitEvent) {
      if (!response.current?.value) {
        event.preventDefault();
        event.stopImmediatePropagation();
        setFailed(true);
        onVerified?.(false);
      }
    }
    form.addEventListener("submit", guardSubmission, true);
    return () => form.removeEventListener("submit", guardSubmission, true);
  }, [sitekey, onVerified]);

  useEffect(() => {
    if (!ready || !sitekey || !container.current || !window.turnstile) return;
    const api = window.turnstile;
    setToken(null);
    const id = api.render(container.current, {
      sitekey,
      theme: "auto",
      size: "flexible",
      "response-field": false,
      "error-callback": () => { setFailed(true); setToken(null); onVerified?.(false); },
      "timeout-callback": () => { setFailed(true); setToken(null); onVerified?.(false); },
      "expired-callback": () => { setToken(null); onVerified?.(false); api.reset(id); },
      callback: (token: string) => { setFailed(false); setToken(token); onVerified?.(true); },
    });
    widget.current = id;
    return () => { setToken(null); onVerified?.(false); widget.current = null; api.remove(id); };
  }, [ready, sitekey, onVerified]);

  useEffect(() => {
    // Every completed attempt needs a fresh single-use token, even on errors.
    if (state && widget.current && window.turnstile) {
      setToken(null);
      onVerified?.(false);
      window.turnstile.reset(widget.current);
    }
  }, [state, onVerified]);

  if (!sitekey) return null;
  return <>
    <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" strategy="afterInteractive" onReady={() => setReady(true)} onError={() => { setToken(null); setFailed(true); onVerified?.(false); }} />
    <div ref={container} aria-label="Security verification" />
    <input ref={response} type="hidden" name="cf-turnstile-response" defaultValue="" />
    {failed && <p className="form-message" role="alert">Complete security verification before submitting. If it cannot load, refresh the page and try again.</p>}
  </>;
}
