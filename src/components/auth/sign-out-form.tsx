"use client";

import { useActionState } from "react";
import { signOutAction } from "@/lib/auth/actions";
import type { AuthFormState } from "@/lib/auth/form-state";

export function SignOutForm() {
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(signOutAction, null);
  return <form action={formAction} className="signout-form">
    {state?.message && <span className="form-message" role="alert">{state.message}</span>}
    <button type="submit" disabled={pending}>{pending ? "Signing out…" : "Sign out"}</button>
  </form>;
}
