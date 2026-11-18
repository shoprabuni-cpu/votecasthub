"use client";

import { useActionState, useState } from "react";
import { requestVoterEmailCodeAction, verifyVoterEmailCodeAction } from "@/lib/auth/actions";
import type { AuthFormState } from "@/lib/auth/form-state";
import { AuthCaptcha } from "@/components/auth/auth-captcha";

export function EmailOtpForm({ nextPath }: { nextPath: string }) {
  const [state, send, pending] = useActionState<AuthFormState, FormData>(requestVoterEmailCodeAction, null);
  const [verify, submit, verifying] = useActionState<AuthFormState, FormData>(verifyVoterEmailCodeAction, null);
  const [captchaReady, setCaptchaReady] = useState(!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);

  // Step 2 — enter the code that was sent
  if (state?.codeSent && state.email) {
    return (
      <form action={submit} className="mt-6 space-y-4">
        <input type="hidden" name="email" value={state.email} />
        <input type="hidden" name="next" value={nextPath} />
        <div>
          <label htmlFor="email-code" className="block text-xs font-semibold text-stone-700 dark:text-stone-300">Email verification code</label>
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
            className="mt-1 block w-full rounded-xl border border-stone-300 bg-stone-50 px-3.5 py-2.5 text-center text-lg tracking-widest font-mono text-stone-900 transition focus:border-emerald-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600/20 dark:border-stone-700 dark:bg-[#141d18] dark:text-stone-100 dark:focus:border-emerald-500"
          />
          <p className="mt-1.5 text-xs text-stone-500 dark:text-stone-400">Enter the code sent to {state.email}.</p>
        </div>
        {verify?.message && <p className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-300" role="alert">{verify.message}</p>}
        <button className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-emerald-900 px-6 py-3 text-sm font-semibold text-white shadow-xs transition hover:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer dark:bg-emerald-600 dark:hover:bg-emerald-500" disabled={verifying}>
          {verifying ? "Verifying…" : "Verify and continue"}
        </button>
      </form>
    );
  }

  // Step 1 — enter email and complete captcha to receive code
  return (
    <form action={send} className="mt-6 space-y-4">
      <input type="hidden" name="next" value={nextPath} />
      <div>
        <label htmlFor="email" className="block text-xs font-semibold text-stone-700 dark:text-stone-300">Email address</label>
        <input id="email" name="email" type="email" autoComplete="email" required className="mt-1 block w-full rounded-xl border border-stone-300 bg-stone-50 px-3.5 py-2.5 text-sm text-stone-900 transition focus:border-emerald-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600/20 dark:border-stone-700 dark:bg-[#141d18] dark:text-stone-100 dark:focus:border-emerald-500" />
      </div>
      <AuthCaptcha state={state} onVerified={setCaptchaReady} />
      {state?.message && <p className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-300" role="alert">{state.message}</p>}
      <button className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-emerald-900 px-6 py-3 text-sm font-semibold text-white shadow-xs transition hover:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer dark:bg-emerald-600 dark:hover:bg-emerald-500" disabled={pending || !captchaReady}>
        {pending ? "Sending…" : "Send email code"}
      </button>
    </form>
  );
}
