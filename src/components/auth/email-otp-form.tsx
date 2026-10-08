"use client";

import { useActionState, useState } from "react";
import { requestVoterEmailCodeAction, verifyVoterEmailCodeAction } from "@/lib/auth/actions";
import type { AuthFormState } from "@/lib/auth/form-state";
import { AuthCaptcha } from "@/components/auth/auth-captcha";

export function EmailOtpForm({ nextPath }: { nextPath: string }) {
  const [state, send, pending] = useActionState<AuthFormState, FormData>(requestVoterEmailCodeAction, null);
  const [verify, submit, verifying] = useActionState<AuthFormState, FormData>(verifyVoterEmailCodeAction, null);
  const [captchaReady, setCaptchaReady] = useState(false);

  // Step 2 — enter the code that was sent
  if (state?.codeSent && state.email) {
    return (
      <form action={submit} className="auth-form">
        <input type="hidden" name="email" value={state.email} />
        <input type="hidden" name="next" value={nextPath} />
        <label htmlFor="email-code">Email verification code</label>
        <input
          id="email-code"
          name="token"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6,8}"
          minLength={6}
          maxLength={8}
          required
          autoFocus
        />
        <p className="auth-hint">Enter the code sent to {state.email}.</p>
        {verify?.message && <p className="form-message" role="alert">{verify.message}</p>}
        <button className="primary-link auth-submit" disabled={verifying}>
          {verifying ? "Verifying…" : "Verify and continue"}
        </button>
      </form>
    );
  }

  // Step 1 — enter email and complete captcha to receive code
  return (
    <form action={send} className="auth-form">
      <input type="hidden" name="next" value={nextPath} />
      <label htmlFor="email">Email address</label>
      <input id="email" name="email" type="email" autoComplete="email" required />
      <AuthCaptcha state={state} onVerified={setCaptchaReady} />
      {state?.message && <p className="form-message" role="alert">{state.message}</p>}
      <button className="primary-link auth-submit" disabled={pending || !captchaReady}>
        {pending ? "Sending…" : "Send email code"}
      </button>
    </form>
  );
}
