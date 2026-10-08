"use client";
import { useActionState } from "react";
import { sendEventReviewMessageAction } from "@/lib/events/actions";

export function ReviewMessageForm({ eventId }: { eventId: string }) {
  const [state, action, pending] = useActionState(sendEventReviewMessageAction, null);
  return <form action={action} className="mt-4 space-y-3">
    <input type="hidden" name="eventId" value={eventId} />
    <label className="block text-sm font-semibold text-stone-700">Message<textarea name="message" required minLength={5} maxLength={2000} rows={3} placeholder="Ask a question or explain the changes needed…" className="mt-2 w-full rounded-xl border border-stone-300 bg-white p-3 text-sm font-normal focus-visible:outline-2 focus-visible:outline-emerald-700" /></label>
    {state?.message && <p role="status" className={state.success ? "text-sm text-emerald-800" : "text-sm text-red-800"}>{state.message}</p>}
    <button disabled={pending} className="min-h-11 rounded-xl bg-emerald-800 px-5 text-sm font-semibold text-white disabled:opacity-50">{pending ? "Sending…" : "Send private message"}</button>
  </form>;
}
