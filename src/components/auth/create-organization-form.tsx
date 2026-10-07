"use client";

import { useActionState } from "react";
import { createOrganizationAction } from "@/lib/auth/actions";
import type { AuthFormState } from "@/lib/auth/form-state";

export function CreateOrganizationForm() {
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(createOrganizationAction, null);

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label htmlFor="organization-name" className="block text-xs font-semibold text-stone-700">
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
            className="flex-1 rounded-xl border border-stone-200 bg-stone-50/50 px-3.5 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:border-emerald-600 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-600 transition-all shadow-2xs"
          />
          <button
            type="submit"
            disabled={pending}
            className="inline-flex items-center justify-center rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition-all hover:bg-emerald-800 active:scale-95 disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap"
          >
            {pending ? "Creating…" : "Create"}
          </button>
        </div>
      </div>
      {state?.message && (
        <p className="rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs text-red-700" role="alert">
          {state.message}
        </p>
      )}
    </form>
  );
}
