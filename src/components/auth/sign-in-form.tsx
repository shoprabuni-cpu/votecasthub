"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { signInAction } from "@/lib/auth/actions";
import type { AuthFormState } from "@/lib/auth/form-state";
import { AuthCaptcha } from "@/components/auth/auth-captcha";

export function SignInForm({ nextPath }: { nextPath: string }) {
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(signInAction, null);
  const [captchaReady, setCaptchaReady] = useState(!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);

  return (
    <form action={formAction} className="auth-form">
      <input type="hidden" name="next" value={nextPath} />
      <label htmlFor="email">Email address</label>
      <input id="email" name="email" type="email" autoComplete="email" maxLength={254} required />
      <label htmlFor="password">Password</label>
      <input id="password" name="password" type="password" autoComplete="current-password" maxLength={256} required />
      <p className="auth-recovery-link"><Link href="/forgot-password">Forgot your password?</Link></p>
      <p className="auth-recovery-link"><Link href="/resend-confirmation">Resend confirmation email</Link></p>
      <AuthCaptcha state={state} onVerified={setCaptchaReady} />
      {state?.message && <p className="form-message" role="alert">{state.message}</p>}
      <button className="primary-link auth-submit" type="submit" disabled={pending || !captchaReady}>
        {pending ? "Signing in…" : "Sign in"}
      </button>
      <p className="auth-switch">New to VotecastHub GH? <Link href="/sign-up">Create an organizer account</Link></p>
    </form>
  );
}
