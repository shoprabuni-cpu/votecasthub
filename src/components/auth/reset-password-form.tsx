"use client";

import { useActionState } from "react";
import { updatePasswordAction } from "@/lib/auth/actions";
import type { AuthFormState } from "@/lib/auth/form-state";

export function ResetPasswordForm() {
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(updatePasswordAction, null);

  return (
    <form action={formAction} className="auth-form">
      <label htmlFor="password">New password</label>
      <input id="password" name="password" type="password" autoComplete="new-password" minLength={12} maxLength={256} required />
      <label htmlFor="confirmPassword">Confirm new password</label>
      <input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" minLength={12} maxLength={256} required />
      <p className="input-hint">Use at least 12 characters. Choose a password you do not use elsewhere.</p>
      {state?.message && <p className={state.success ? "form-message form-success" : "form-message"} role={state.success ? "status" : "alert"}>{state.message}</p>}
      <button className="primary-link auth-submit" type="submit" disabled={pending}>{pending ? "Updating password…" : "Update password"}</button>
    </form>
  );
}