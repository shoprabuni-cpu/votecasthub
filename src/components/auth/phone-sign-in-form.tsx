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

  return <>
    <form action={verifyCode} className="auth-form">
      <input type="hidden" name="phone" value={phone} />
      <input type="hidden" name="next" value={nextPath} />
      <label htmlFor="phone-code">Verification code</label>
      <input id="phone-code" name="token" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6,8}" minLength={6} maxLength={8} required autoFocus />
      <p className="auth-hint">Enter the code sent to {phone}. Use the most recent code.</p>
      {verifyState?.message && <p className="form-message" role="alert">{verifyState.message}</p>}
      <button className="primary-link auth-submit" type="submit" disabled={verifying || resending}>{verifying ? "Verifying…" : "Verify and continue"}</button>
    </form>
    <form action={resendCode} className="auth-form">
      <input type="hidden" name="phone" value={phone} />
      <input type="hidden" name="next" value={nextPath} />
      {remaining === 0 && resendCaptchaVisible && (
        <AuthCaptcha state={resendState} onVerified={setResendCaptchaReady} />
      )}
      {resendState?.message && <p className="form-message" role="status">{resendState.message}</p>}
      {remaining > 0
        ? <p className="auth-hint">You can request another code in {remaining}s.</p>
        : !resendCaptchaVisible
          ? <button className="text-button" type="button" onClick={() => setResendCaptchaVisible(true)}>Request a new code</button>
          : <button className="text-button" type="submit" disabled={resending || verifying || !resendCaptchaReady}>{resending ? "Requesting code…" : "Send new code"}</button>
      }
      <button className="text-button" type="button" onClick={() => window.location.reload()}>Use another number</button>
    </form>
  </>;
}

export function PhoneSignInForm({ nextPath }: { nextPath: string }) {
  const [state, requestCode, requesting] = useActionState<AuthFormState, FormData>(requestVoterPhoneCodeAction, null);
  const [captchaReady, setCaptchaReady] = useState(!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);

  if (state?.codeSent && state.phone && state.resendAt) {
    return <PhoneCodeForm phone={state.phone} nextPath={nextPath} resendAt={state.resendAt} />;
  }

  return <form action={requestCode} className="auth-form">
    <input type="hidden" name="next" value={nextPath} />
    <label htmlFor="phone">Ghana phone number</label>
    <input id="phone" name="phone" type="tel" autoComplete="tel" inputMode="tel" placeholder="0241234567" maxLength={32} required />
    <p className="auth-hint">Use 0241234567 or +233241234567. We&apos;ll send a one-time code to verify your number. Your number is used only for verification, voting limits, and fraud prevention. <a href="/privacy">Privacy details</a>.</p>
    <AuthCaptcha state={state} onVerified={setCaptchaReady} />
    {state?.message && <p className="form-message" role="alert">{state.message}</p>}
    <button className="primary-link auth-submit" type="submit" disabled={requesting || !captchaReady}>
      {requesting ? "Requesting code…" : "Send verification code"}
    </button>
  </form>;
}
