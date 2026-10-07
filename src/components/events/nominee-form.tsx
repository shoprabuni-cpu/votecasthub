"use client";

import { useActionState, useRef } from "react";
import { addCategoryNomineeAction } from "@/lib/auth/actions";
import type { AuthFormState } from "@/lib/auth/form-state";
import { Icon } from "@/components/icon";

export function NomineeForm({ categoryId, backTo }: { categoryId: string; backTo: string }) {
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(addCategoryNomineeAction, null);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form
      key={state?.success ? "submitted" : "ready"}
      ref={formRef}
      action={formAction}
      className="rounded-xl border border-stone-200/90 bg-stone-50/50 p-4 space-y-3"
    >
      <input type="hidden" name="categoryId" value={categoryId} />
      <input type="hidden" name="backTo" value={backTo} />

      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-stone-700 uppercase tracking-wider">
        <Icon name="users" size={13} />
        <span>Add Nominee / Candidate</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="sm:col-span-2">
          <label htmlFor={`nominee-name-${categoryId}`} className="block text-xs font-semibold text-stone-800 mb-1">
            Full Name or Entry Title <span className="text-emerald-700">*</span>
          </label>
          <input
            id={`nominee-name-${categoryId}`}
            name="name"
            minLength={1}
            maxLength={160}
            required
            placeholder="e.g. Ama Mensah or Project Alpha"
            className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-xs font-medium text-stone-900 placeholder:text-stone-400 focus:border-emerald-600 focus:outline-none focus:ring-3 focus:ring-emerald-600/15 transition-all"
          />
        </div>

        <div>
          <label htmlFor={`nominee-code-${categoryId}`} className="block text-xs font-semibold text-stone-800 mb-1">
            Short Code <span className="text-stone-400 font-normal">· optional</span>
          </label>
          <input
            id={`nominee-code-${categoryId}`}
            name="publicCode"
            maxLength={32}
            pattern="[A-Za-z0-9-]*"
            placeholder="e.g. BNA-01"
            className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-xs font-mono font-medium text-stone-900 placeholder:text-stone-400 focus:border-emerald-600 focus:outline-none focus:ring-3 focus:ring-emerald-600/15 transition-all uppercase"
          />
        </div>
      </div>

      <div>
        <label htmlFor={`nominee-bio-${categoryId}`} className="block text-xs font-semibold text-stone-800 mb-1">
          Brief Biography / Accolades <span className="text-stone-400 font-normal">· optional</span>
        </label>
        <textarea
          id={`nominee-bio-${categoryId}`}
          name="biography"
          maxLength={3000}
          rows={2}
          placeholder="A short profile shown to voters on the ballot..."
          className="w-full rounded-xl border border-stone-300 bg-white p-2.5 text-xs text-stone-900 placeholder:text-stone-400 focus:border-emerald-600 focus:outline-none focus:ring-3 focus:ring-emerald-600/15 transition-all resize-none"
        />
      </div>

      {state?.message && (
        <div
          className={`rounded-xl p-2.5 text-xs font-semibold flex items-center gap-1.5 ${
            state.success ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-red-50 text-red-800 border border-red-200"
          }`}
          role={state.success ? "status" : "alert"}
        >
          <Icon name={state.success ? "check" : "alert"} size={14} />
          <span>{state.message}</span>
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center gap-1.5 rounded-xl border border-stone-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-stone-800 shadow-2xs hover:bg-stone-50 hover:border-emerald-600 transition-all active:scale-95 cursor-pointer"
      >
        {pending ? (
          <>
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-emerald-800 border-t-transparent" />
            <span>Adding Nominee...</span>
          </>
        ) : (
          <>
            <Icon name="check" size={13} />
            <span>Add Nominee</span>
          </>
        )}
      </button>
    </form>
  );
}
