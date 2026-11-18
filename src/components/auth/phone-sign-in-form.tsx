"use client";

import { useActionState, useEffect, useState } from "react";
import { requestVoterPhoneCodeAction, verifyVoterPhoneCodeAction } from "@/lib/auth/actions";
import type { AuthFormState } from "@/lib/auth/form-state";
import { AuthCaptcha } from "@/components/auth/auth-captcha";

function PhoneCodeForm({ phone, nextPath, resendAt }: { phone: string; nextPath: string; resendAt: number }) {
  const [verifyState, verifyCode, verifying] = useActionState<AuthFormState, FormData>(verifyVoterPhoneCodeAction, null);
  const [resendState, resendCode, resending] = useActionState<AuthFormState, FormData>(requestVoterPhoneCodeAction, null);
  const [now, setNow] = useState(() => Date.now());
  const [resendCaptchaVisible, setResendCaptchaVisible] = useState(false);
  const [resendCaptchaReady, setResendCaptchaReady] = useState(!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);
  const remaining = Math.max(0, Math.ceil(((resendState?.resendAt ?? resendAt) - now) / 1000));

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <>
      <form action={verifyCode} className="mt-6 space-y-4">
        <input type="hidden" name="phone" value={phone} />
        <input type="hidden" name="next" value={nextPath} />
        <div>
          <label htmlFor="phone-code" className="block text-xs font-semibold text-stone-700 dark:text-stone-300">Verification code</label>
          <input
            id="phone-code"
            name="token"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6,8}"
            minLength={6}
            maxLength={8}
            required
            autoFocus
            className="mt-1 block w-full rounded-xl border border-stone-300 bg-stone-50 px-3.5 py-2.5 text-center text-lg tracking-widest font-mono text-stone-900 transition focus:border-emerald-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600/20 dark:border-stone-700 dark:bg-[#141d18] dark:text-stone-100 dark:focus:border-emerald-500"
          />
          <p className="mt-1.5 text-xs text-stone-500 dark:text-stone-400">Enter the code sent to {phone}. Use the most recent code.</p>
        </div>
        {verifyState?.message && <p className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-300" role="alert">{verifyState.message}</p>}
        <button className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-emerald-900 px-6 py-3 text-sm font-semibold text-white shadow-xs transition hover:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer dark:bg-emerald-600 dark:hover:bg-emerald-500" type="submit" disabled={verifying || resending}>
          {verifying ? "Verifying…" : "Verify and continue"}
        </button>
      </form>
      <form action={resendCode} className="mt-4 space-y-3">
        <input type="hidden" name="phone" value={phone} />
        <input type="hidden" name="next" value={nextPath} />
        {remaining === 0 && resendCaptchaVisible && (
          <AuthCaptcha state={resendState} onVerified={setResendCaptchaReady} />
        )}
        {resendState?.message && <p className="rounded-xl border border-stone-200 bg-stone-50 p-3 text-xs text-stone-700 dark:border-stone-800 dark:bg-stone-900 dark:text-stone-300" role="status">{resendState.message}</p>}
        {remaining > 0 ? (
          <p className="text-xs text-stone-500 dark:text-stone-400">You can request another code in {remaining}s.</p>
        ) : !resendCaptchaVisible ? (
          <button className="text-xs font-semibold text-emerald-800 hover:underline dark:text-emerald-400 cursor-pointer" type="button" onClick={() => setResendCaptchaVisible(true)}>Request a new code</button>
        ) : (
          <button className="text-xs font-semibold text-emerald-800 hover:underline dark:text-emerald-400 cursor-pointer" type="submit" disabled={resending || verifying || !resendCaptchaReady}>
            {resending ? "Requesting code…" : "Send new code"}
          </button>
        )}
        <div>
          <button className="text-xs text-stone-500 hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-200 cursor-pointer" type="button" onClick={() => window.location.reload()}>Use another number</button>
        </div>
      </form>
    </>
  );
}

export function PhoneSignInForm({ nextPath }: { nextPath: string }) {
  const [state, requestCode, requesting] = useActionState<AuthFormState, FormData>(requestVoterPhoneCodeAction, null);
  const [captchaReady, setCaptchaReady] = useState(!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);

  if (state?.codeSent && state.phone && state.resendAt) {
    return <PhoneCodeForm phone={state.phone} nextPath={nextPath} resendAt={state.resendAt} />;
  }

  return (
    <form action={requestCode} className="mt-6 space-y-4">
      <input type="hidden" name="next" value={nextPath} />
      <div>
        <label htmlFor="phone" className="block text-xs font-semibold text-stone-700 dark:text-stone-300">Ghana phone number</label>
        <input id="phone" name="phone" type="tel" autoComplete="tel" inputMode="tel" placeholder="0241234567" maxLength={32} required className="mt-1 block w-full rounded-xl border border-stone-300 bg-stone-50 px-3.5 py-2.5 text-sm text-stone-900 transition focus:border-emerald-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600/20 dark:border-stone-700 dark:bg-[#141d18] dark:text-stone-100 dark:focus:border-emerald-500" />
      </div>
      <AuthCaptcha state={state} onVerified={setCaptchaReady} />
      {state?.message && <p className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-300" role="alert">{state.message}</p>}
      <button className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-emerald-900 px-6 py-3 text-sm font-semibold text-white shadow-xs transition hover:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer dark:bg-emerald-600 dark:hover:bg-emerald-500" type="submit" disabled={requesting || !captchaReady}>
        {requesting ? "Sending code…" : "Send verification code"}
      </button>
    </form>
  );
}
