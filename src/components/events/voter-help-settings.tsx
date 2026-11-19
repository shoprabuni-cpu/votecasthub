"use client";

import { useActionState } from "react";
import { setEventVoterHelpAction } from "@/lib/events/actions";
import type { AuthFormState } from "@/lib/auth/form-state";
import { Icon } from "@/components/icon";

export function VoterHelpSettings({
  eventId,
  email,
}: {
  eventId: string;
  email: string | null;
}) {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(
    setEventVoterHelpAction,
    null
  );

  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-5 sm:p-6 shadow-xs dark:border-[#1c2721] dark:bg-[#0c120e]">
      <div className="flex items-start gap-3 mb-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-900 border border-emerald-200 dark:border-emerald-800/60 dark:bg-emerald-950/60 dark:text-emerald-300">
          <Icon name="phone" size={18} />
        </span>
        <div>
          <h2 className="text-base font-serif font-bold text-stone-900 dark:text-white">
            Public Voter Support Email
          </h2>
          <p className="mt-0.5 text-xs text-stone-500 dark:text-stone-400 leading-relaxed max-w-xl">
            Voters can contact this address regarding missing voter roll entries, private codes, or allowances. Leave empty to direct voters to platform support.
          </p>
        </div>
      </div>

      <form action={action} className="space-y-4">
        <input type="hidden" name="eventId" value={eventId} />
        <div>
          <label htmlFor="voter-help-email" className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1.5">
            Support Email Address
          </label>
          <input
            id="voter-help-email"
            name="email"
            type="email"
            maxLength={254}
            defaultValue={email ?? ""}
            placeholder="support@yourorganization.org"
            className="w-full rounded-xl border border-stone-300 bg-stone-50/50 px-3.5 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:border-emerald-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600/15 transition-all dark:border-[#1c2721] dark:bg-[#141d18] dark:text-white dark:placeholder:text-stone-600 dark:focus:border-emerald-500"
          />
        </div>

        <button
          type="submit"
          disabled={pending}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-emerald-900 px-5 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-800 disabled:opacity-50 transition-all cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 dark:bg-emerald-700 dark:hover:bg-emerald-600"
        >
          {pending ? "Saving Support Email…" : "Save Support Contact"}
        </button>

        {state?.message && (
          <p
            role="status"
            className={`rounded-xl border p-3 text-xs font-medium ${
              state.success
                ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300"
                : "border-red-200 bg-red-50 text-red-900 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300"
            }`}
          >
            {state.message}
          </p>
        )}
      </form>
    </section>
  );
}
