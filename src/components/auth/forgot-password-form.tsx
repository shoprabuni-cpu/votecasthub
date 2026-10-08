"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { requestPasswordResetAction } from "@/lib/auth/actions";
import type { AuthFormState } from "@/lib/auth/form-state";
import { AuthCaptcha } from "@/components/auth/auth-captcha";

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(requestPasswordResetAction, null);
  const [captchaReady, setCaptchaReady] = useState(!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);

  return (
    <form action={formAction} className="auth-form">
      <label htmlFor="email">Email address</label>
      <input id="email" name="email" type="email" autoComplete="email" maxLength={254} required />
      <AuthCaptcha state={state} onVerified={setCaptchaReady} />
      {state?.message && <p className={state.success ? "form-message form-success" : "form-message"} role={state.success ? "status" : "alert"}>{state.message}</p>}
      <button className="primary-link auth-submit" type="submit" disabled={pending || !captchaReady}>
        {pending ? "Sending instructions…" : "Send reset link"}
      </button>
      <p className="auth-switch"><Link href="/sign-in">Return to sign in</Link></p>
    </form>
  );
}
