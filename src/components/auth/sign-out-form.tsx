"use client";

import { useActionState } from "react";
import { signOutAction } from "@/lib/auth/actions";
import type { AuthFormState } from "@/lib/auth/form-state";

export function SignOutForm({ compact = false }: { compact?: boolean }) {
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(signOutAction, null);
  return (
    <form action={formAction} className={compact ? "w-full" : "inline-flex items-center"}>
      {state?.message && <span className="my-1 rounded-xl border border-rose-200 bg-rose-50 p-2 text-xs text-rose-800 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-300" role="alert">{state.message}</span>}
      <button
        type="submit"
        disabled={pending}
        className={compact
          ? "flex min-h-11 w-full items-center rounded-xl px-3 text-sm font-semibold text-stone-700 hover:bg-stone-100 focus-visible:outline-2 focus-visible:outline-emerald-700 disabled:opacity-50 dark:text-stone-300 dark:hover:bg-stone-800 cursor-pointer"
          : "inline-flex min-h-10 items-center justify-center rounded-xl border border-stone-300 bg-white px-3.5 py-2 text-xs font-semibold text-stone-700 shadow-2xs hover:bg-stone-50 transition cursor-pointer dark:border-[#1c2721] dark:bg-[#0c120e] dark:text-stone-200 dark:hover:bg-[#141d18]"
        }
      >
        {pending ? "Signing out…" : "Sign out"}
      </button>
    </form>
  );
}
