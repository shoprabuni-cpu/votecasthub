"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signUpAction } from "@/lib/auth/actions";
import type { AuthFormState } from "@/lib/auth/form-state";

export function SignUpForm({ nextPath }: { nextPath: string }) {
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(signUpAction, null);

  return (
    <form action={formAction} className="auth-form">
      <input type="hidden" name="next" value={nextPath} />
      <label htmlFor="displayName">Your name</label>
      <input id="displayName" name="displayName" type="text" autoComplete="name" minLength={2} maxLength={80} required />
      <label htmlFor="email">Email address</label>
      <input id="email" name="email" type="email" autoComplete="email" maxLength={254} required />
      <label htmlFor="password">Password</label>
      <input id="password" name="password" type="password" autoComplete="new-password" minLength={12} maxLength={256} required aria-describedby="password-hint" />
      <p id="password-hint" className="input-hint">Use at least 12 characters. A confirmation email is required.</p>
      {state?.message && <p className={state.success ? "form-message form-success" : "form-message"} role={state.success ? "status" : "alert"}>{state.message}</p>}
      <button className="primary-link auth-submit" type="submit" disabled={pending}>{pending ? "Creating account…" : "Create account"}</button>
      <p className="auth-switch">Already registered? <Link href="/sign-in">Sign in</Link></p>
    </form>
  );
}
