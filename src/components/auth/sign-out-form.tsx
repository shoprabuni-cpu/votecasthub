"use client";

import { useActionState } from "react";
import { signOutAction } from "@/lib/auth/actions";
import type { AuthFormState } from "@/lib/auth/form-state";

export function SignOutForm({ compact = false }: { compact?: boolean }) {
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(signOutAction, null);
  return <form action={formAction} className={compact ? "w-full" : "signout-form"}>
    {state?.message && <span className="form-message" role="alert">{state.message}</span>}
    <button type="submit" disabled={pending} className={compact ? "flex min-h-11 w-full items-center rounded-xl px-3 text-sm font-semibold text-stone-700 hover:bg-stone-100 focus-visible:outline-2 focus-visible:outline-emerald-700 disabled:opacity-50" : undefined}>{pending ? "Signing out…" : "Sign out"}</button>
  </form>;
}
