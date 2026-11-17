"use client";

import { useState } from "react";
import { addCategoryNomineeAction } from "@/lib/auth/actions";
import { useEventSaveFeedback } from "./event-save-feedback";
import { Icon } from "@/components/icon";

export function NomineeForm({ categoryId, backTo }: { categoryId: string; backTo: string }) {
  const [showMessage, setShowMessage] = useState(true);
  const { state, formAction, pending, dirty, markChanged } = useEventSaveFeedback(async (previous, data) => {
    const result = await addCategoryNomineeAction(previous, data);
    setShowMessage(true);
    return result;
  });

  return (
    <form
      data-setup-unsaved={dirty || pending ? true : undefined}
      onInput={() => {
        markChanged();
        setShowMessage(false);
      }}
      onFocusCapture={() => {
        if (state?.success) setShowMessage(false);
      }}
      onPointerDownCapture={() => {
        if (state?.success) setShowMessage(false);
      }}
      onSubmit={() => setShowMessage(false)}
      action={formAction}
      className="space-y-3"
    >
      <input type="hidden" name="categoryId" value={categoryId} />
      <input type="hidden" name="backTo" value={backTo} />

      <div className="flex items-center gap-1.5 text-xs font-bold text-stone-800 dark:text-stone-200 uppercase tracking-wider">
        <Icon name="users" size={13} />
        <span>Add Nominee / Candidate</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="sm:col-span-2 min-w-0">
          <label htmlFor={`nominee-name-${categoryId}`} className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
            Full Name or Entry Title <span className="text-emerald-700 dark:text-emerald-400">*</span>
          </label>
          <input
            id={`nominee-name-${categoryId}`}
            name="name"
            minLength={1}
            maxLength={160}
            required
            placeholder="e.g. Ama Mensah or Project Alpha"
            className="w-full rounded-xl border border-stone-300 bg-white px-3.5 py-2.5 text-sm font-medium text-stone-900 placeholder:text-stone-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15 transition-all dark:border-[#223028] dark:bg-[#080b09] dark:text-stone-100 dark:placeholder:text-stone-600"
          />
        </div>

        <div>
          <label htmlFor={`nominee-code-${categoryId}`} className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
            Voting Code <span className="text-stone-400 font-normal">· optional</span>
          </label>
          <input
            id={`nominee-code-${categoryId}`}
            name="publicCode"
            maxLength={32}
            pattern="[A-Za-z0-9-]*"
            placeholder="Auto (01, 02...)"
            className="w-full rounded-xl border border-stone-300 bg-white px-3.5 py-2.5 text-sm font-mono font-bold text-stone-900 placeholder:text-stone-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15 transition-all uppercase dark:border-[#223028] dark:bg-[#080b09] dark:text-stone-100 dark:placeholder:text-stone-600"
          />
        </div>
      </div>

      <details className="rounded-xl border border-stone-200/80 bg-stone-50/50 p-3 transition-colors dark:border-[#1c2721] dark:bg-[#141b16]/40">
        <summary className="inline-flex cursor-pointer items-center text-xs font-semibold text-stone-600 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-200">
          + Add brief biography / accolades (optional)
        </summary>
        <div className="mt-3">
          <textarea
            id={`nominee-bio-${categoryId}`}
            name="biography"
            maxLength={3000}
            rows={2}
            placeholder="A short profile shown to voters on the ballot..."
            className="w-full rounded-xl border border-stone-300 bg-white p-2.5 text-xs sm:text-sm text-stone-900 placeholder:text-stone-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15 transition-all resize-none dark:border-[#223028] dark:bg-[#080b09] dark:text-stone-100 dark:placeholder:text-stone-600 leading-relaxed"
          />
        </div>
      </details>

      {showMessage && state?.message && (
        <div
          className={`rounded-xl p-2.5 text-xs font-semibold flex items-center gap-1.5 ${
            state.success
              ? "bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-900/50"
              : "bg-red-50 text-red-800 border border-red-200 dark:bg-red-950/60 dark:text-red-300 dark:border-red-900/50"
          }`}
          role={state.success ? "status" : "alert"}
        >
          <Icon name={state.success ? "check" : "alert"} size={14} />
          <span>{state.message}</span>
        </div>
      )}

      <div>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-900 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-800 transition-all active:scale-95 cursor-pointer min-h-10 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-emerald-800 dark:hover:bg-emerald-700"
        >
          {pending ? (
            <>
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
              <span>Adding Nominee...</span>
            </>
          ) : (
            <>
              <Icon name="check" size={13} />
              <span>Add Nominee</span>
            </>
          )}
        </button>
      </div>
    </form>
  );
}
