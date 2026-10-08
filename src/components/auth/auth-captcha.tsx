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
  const [token, setToken] = useState("");
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  function updateToken(value: string | null) {
    const nextToken = value ?? "";
    // Keep React and the submitted field in sync. Hidden-input defaultValue reflects
    // its value attribute, so a parent rerender can erase an imperatively set token.
    setToken(nextToken);
    if (response.current) response.current.value = nextToken;
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
    updateToken(null);
    const id = api.render(container.current, {
      sitekey,
      theme: "auto",
      size: "flexible",
      "response-field": false,
      "error-callback": () => { setFailed(true); updateToken(null); onVerified?.(false); },
      "timeout-callback": () => { setFailed(true); updateToken(null); onVerified?.(false); },
      "expired-callback": () => { updateToken(null); onVerified?.(false); api.reset(id); },
      callback: (value: string) => { setFailed(false); updateToken(value); onVerified?.(Boolean(value)); },
    });
    widget.current = id;
    return () => { onVerified?.(false); widget.current = null; api.remove(id); };
  }, [ready, sitekey, onVerified]);

  useEffect(() => {
    // Every completed attempt needs a fresh single-use token, even on errors.
    if (state && widget.current && window.turnstile) {
      updateToken(null);
      onVerified?.(false);
      window.turnstile.reset(widget.current);
    }
  }, [state, onVerified]);

  if (!sitekey) return null;
  return <>
    <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" strategy="afterInteractive" onReady={() => setReady(true)} onError={() => { updateToken(null); setFailed(true); onVerified?.(false); }} />
    <div ref={container} aria-label="Security verification" />
    <input ref={response} type="hidden" name="cf-turnstile-response" value={token} readOnly />
    {failed && <p className="form-message" role="alert">Complete security verification before submitting. If it cannot load, refresh the page and try again.</p>}
  </>;
}
