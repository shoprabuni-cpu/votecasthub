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
    <form action={formAction} className="mt-6 space-y-4">
      <div>
        <label htmlFor="email" className="block text-xs font-semibold text-stone-700 dark:text-stone-300">Email address</label>
        <input id="email" name="email" type="email" autoComplete="email" maxLength={254} required className="mt-1 block w-full rounded-xl border border-stone-300 bg-stone-50 px-3.5 py-2.5 text-sm text-stone-900 transition focus:border-emerald-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600/20 dark:border-stone-700 dark:bg-[#141d18] dark:text-stone-100 dark:focus:border-emerald-500" />
      </div>
      <AuthCaptcha state={state} onVerified={setCaptchaReady} />
      {state?.message && <p className={state.success ? "rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300" : "rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-300"} role={state.success ? "status" : "alert"}>{state.message}</p>}
      <button className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-emerald-900 px-6 py-3 text-sm font-semibold text-white shadow-xs transition hover:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer dark:bg-emerald-600 dark:hover:bg-emerald-500" type="submit" disabled={pending || !captchaReady}>
        {pending ? "Sending instructions…" : "Send reset link"}
      </button>
      <p className="pt-4 border-t border-stone-200/80 text-center text-xs text-stone-600 dark:border-[#1c2721] dark:text-stone-400">
        <Link href="/sign-in" className="font-semibold text-emerald-800 hover:underline dark:text-emerald-400">Return to sign in</Link>
      </p>
    </form>
  );
}
