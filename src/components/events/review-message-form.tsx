"use client";
import { useActionState } from "react";
import { sendEventReviewMessageAction } from "@/lib/events/actions";

export function ReviewMessageForm({ eventId }: { eventId: string }) {
  const [state, action, pending] = useActionState(sendEventReviewMessageAction, null);
  return (
    <form action={action} className="mt-4 space-y-3">
      <input type="hidden" name="eventId" value={eventId} />
      <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300">
        Message
        <textarea
          name="message"
          required
          minLength={5}
          maxLength={2000}
          rows={3}
          placeholder="Ask a question or explain the changes needed…"
          className="mt-2 w-full rounded-xl border border-stone-300 bg-white p-3 text-xs sm:text-sm font-normal text-stone-900 focus-visible:outline-2 focus-visible:outline-emerald-700 dark:border-[#223028] dark:bg-[#080b09] dark:text-stone-100"
        />
      </label>
      {state?.message && <p role={state.success ? "status" : "alert"} className={`text-xs sm:text-sm font-semibold ${state.success ? "text-emerald-800 dark:text-emerald-400" : "text-red-800 dark:text-red-400"}`}>{state.message}</p>}
      <button
        disabled={pending}
        className="min-h-10 rounded-xl bg-emerald-900 px-5 text-xs font-bold text-white shadow-xs hover:bg-emerald-800 transition-all active:scale-95 disabled:opacity-50 py-2 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed dark:bg-emerald-800 dark:hover:bg-emerald-700"
      >
        {pending ? "Sending…" : "Send private message"}
      </button>
    </form>
  );
}
