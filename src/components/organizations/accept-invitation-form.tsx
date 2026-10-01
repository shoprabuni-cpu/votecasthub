"use client";

import { useActionState } from "react";
import { acceptOrganizationInvitationAction } from "@/lib/auth/actions";
import type { AuthFormState } from "@/lib/auth/form-state";

export function AcceptInvitationForm({ token, email }: { token: string; email: string }) {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(acceptOrganizationInvitationAction, null);
  return <form action={action} className="auth-form"><input type="hidden" name="token" value={token} /><p className="auth-hint">Signed in as <strong>{email}</strong>. The invitation must match this confirmed email.</p>{state?.message && <p className="form-message" role="alert">{state.message}</p>}<button className="primary-link auth-submit" type="submit" disabled={pending}>{pending ? "Joining…" : "Accept invitation"}</button></form>;
}
