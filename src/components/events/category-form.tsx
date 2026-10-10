"use client";

import { useActionState, useState } from "react";
import { addEventCategoryAction } from "@/lib/auth/actions";
import type { AuthFormState } from "@/lib/auth/form-state";
import { Icon } from "@/components/icon";

export function CategoryForm({ eventId, backTo, onAdded }: { eventId: string; backTo: string; onAdded?: (id: string) => void }) {
  const [showMessage, setShowMessage] = useState(true);
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(async (previous, data) => { const result = await addEventCategoryAction(previous, data); setShowMessage(true); if (result?.success && result.createdId) onAdded?.(result.createdId); return result; }, null);

  return (
    <form onInput={() => setShowMessage(false)} action={formAction} className="space-y-3.5">
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="backTo" value={backTo} />

      <div>
        <label htmlFor="category-name" className="block text-xs font-semibold text-stone-800 mb-1">
          Category Name <span className="text-emerald-700">*</span>
        </label>
        <input
          id="category-name"
          name="name"
          minLength={1}
          maxLength={120}
          required
          placeholder="e.g. Best New Artist or Student of the Year"
          className="w-full rounded-xl border border-stone-300 bg-white px-3.5 py-2 text-base sm:text-sm font-medium text-stone-900 placeholder:text-stone-400 focus:border-emerald-600 focus:outline-none focus:ring-3 focus:ring-emerald-600/15 transition-all"
        />
      </div>

      <div>
        <label htmlFor="category-description" className="block text-xs font-semibold text-stone-800 mb-1">
          Award Description <span className="text-stone-400 font-normal">· optional</span>
        </label>
        <textarea
          id="category-description"
          name="description"
          maxLength={2000}
          rows={2}
          placeholder="Briefly state eligibility or what this award honors..."
          className="w-full rounded-xl border border-stone-300 bg-white p-3 text-xs text-stone-900 placeholder:text-stone-400 focus:border-emerald-600 focus:outline-none focus:ring-3 focus:ring-emerald-600/15 transition-all resize-none"
        />
      </div>

      {showMessage && state?.message && (
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
        className="inline-flex items-center gap-2 rounded-xl bg-emerald-900 px-4 min-h-11 py-2 text-sm font-semibold text-white shadow-xs hover:bg-emerald-800 disabled:opacity-60 transition-all active:scale-95 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? (
          <>
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
            <span>Adding Category...</span>
          </>
        ) : (
          <>
            <Icon name="sparkle" size={13} />
            <span>Add Category</span>
          </>
        )}
      </button>
    </form>
  );
}
