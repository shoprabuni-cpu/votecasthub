"use client";

import { useActionState } from "react";
import { requestVoterPhoneCodeAction, verifyVoterPhoneCodeAction } from "@/lib/auth/actions";
import type { AuthFormState } from "@/lib/auth/form-state";

export function PhoneSignInForm({ nextPath }: { nextPath: string }) {
  const [state, requestCode, requesting] = useActionState<AuthFormState, FormData>(requestVoterPhoneCodeAction, null);
  const [verifyState, verifyCode, verifying] = useActionState<AuthFormState, FormData>(verifyVoterPhoneCodeAction, null);

  if (state?.codeSent) {
    return <form action={verifyCode} className="auth-form">
      <input type="hidden" name="phone" value={state.phone} />
      <input type="hidden" name="next" value={nextPath} />
      <label htmlFor="phone-code">Verification code</label>
      <input id="phone-code" name="token" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6,8}" minLength={6} maxLength={8} required autoFocus />
      <p className="auth-hint">Enter the code sent to {state.phone}.</p>
      {(verifyState?.message || state.message) && <p className={`form-message${verifyState?.success ? " success-message" : ""}`} role="status">{verifyState?.message || state.message}</p>}
      <button className="primary-link auth-submit" type="submit" disabled={verifying}>{verifying ? "Verifying…" : "Verify and continue"}</button>
      <button className="text-button" type="button" onClick={() => window.location.reload()}>Use another number</button>
    </form>;
  }

  return <form action={requestCode} className="auth-form">
    <input type="hidden" name="next" value={nextPath} />
    <label htmlFor="phone">Ghana phone number</label>
    <input id="phone" name="phone" type="tel" autoComplete="tel" inputMode="tel" placeholder="+233241234567" pattern="\+233[0-9]{9}" maxLength={13} required />
    <p className="auth-hint">We’ll send a one-time code. Your verified number helps enforce each event’s vote limit.</p>
    {state?.message && <p className="form-message" role="alert">{state.message}</p>}
    <button className="primary-link auth-submit" type="submit" disabled={requesting}>{requesting ? "Sending code…" : "Send verification code"}</button>
  </form>;
}
