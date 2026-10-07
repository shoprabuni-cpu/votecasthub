"use client";

import { useActionState } from "react";
import { createOrganizationAction } from "@/lib/auth/actions";
import type { AuthFormState } from "@/lib/auth/form-state";

export function CreateOrganizationForm() {
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(createOrganizationAction, null);

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label htmlFor="organization-name" className="block text-xs font-medium text-stone-300">
          Organization name
        </label>
        <div className="mt-2 flex flex-col gap-2.5 sm:flex-row">
          <input
            id="organization-name"
            name="name"
            type="text"
            minLength={2}
            maxLength={120}
            required
            placeholder="e.g. Accra Music Awards, UG SRC"
            className="flex-1 rounded-xl border border-stone-800 bg-stone-950 px-3.5 py-2.5 text-sm text-stone-100 placeholder:text-stone-600 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all"
          />
          <button
            type="submit"
            disabled={pending}
            className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-emerald-500 active:scale-95 disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap"
          >
            {pending ? "Creating…" : "Create"}
          </button>
        </div>
      </div>
      {state?.message && (
        <p className="rounded-lg border border-red-500/20 bg-red-950/30 p-2.5 text-xs text-red-400" role="alert">
          {state.message}
        </p>
      )}
    </form>
  );
}
