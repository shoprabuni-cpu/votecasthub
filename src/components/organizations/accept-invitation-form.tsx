"use client";

import { useActionState } from "react";
import { acceptOrganizationInvitationAction } from "@/lib/auth/actions";
import type { AuthFormState } from "@/lib/auth/form-state";

export function AcceptInvitationForm({ token, email }: { token: string; email: string }) {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(acceptOrganizationInvitationAction, null);
  return (
    <form action={action} className="mt-6 space-y-4">
      <input type="hidden" name="token" value={token} />
      <p className="text-xs text-stone-500 dark:text-stone-400">Signed in as <strong>{email}</strong>. The invitation must match this confirmed email.</p>
      {state?.message && <p className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-300" role="alert">{state.message}</p>}
      <button className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-emerald-900 px-6 py-3 text-sm font-semibold text-white shadow-xs transition hover:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer dark:bg-emerald-600 dark:hover:bg-emerald-500" type="submit" disabled={pending}>
        {pending ? "Joining…" : "Accept invitation"}
      </button>
    </form>
  );
}
