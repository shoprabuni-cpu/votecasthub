"use client";

import { useActionState, useState } from "react";
import { requestEventCorrectionAction } from "@/lib/events/actions";
import { EventDialog } from "./event-dialog";

type Kind = "name" | "description" | "instructions" | "clarification";
const field = "mt-1 w-full rounded-xl border border-stone-300 bg-white p-3 text-base text-stone-900 focus:ring-2 focus:ring-emerald-700/20 dark:border-[#223028] dark:bg-[#141d18] dark:text-stone-100";
export function EventCorrection({ eventId, kind, currentValue = "" }: { eventId: string; kind: Kind; currentValue?: string }) {
  const [open, setOpen] = useState(false);
  return <><button type="button" onClick={() => setOpen(true)} className="min-h-10 rounded-lg px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-50 border border-stone-300 bg-white shadow-2xs cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#223028] dark:bg-[#0c120e] dark:text-emerald-400 dark:hover:bg-[#141d18]">{kind === "clarification" ? "Add a clarification" : "Request a correction"}</button>{open && <CorrectionDialog eventId={eventId} kind={kind} currentValue={currentValue} onClose={() => setOpen(false)} />}</>;
}
function CorrectionDialog({ eventId, kind, currentValue, onClose }: { eventId: string; kind: Kind; currentValue: string; onClose: () => void }) {
  const [state, action, pending] = useActionState(requestEventCorrectionAction, null);
  const labels = { name: "event name", description: "description", instructions: "voter instructions", clarification: "public clarification" };
  return <EventDialog open title={`Review ${labels[kind]}`} onClose={onClose} busy={pending}>
    <p className="mb-4 text-sm text-stone-600 dark:text-stone-300">The current wording stays public until approval. Recorded votes and voting rules stay unchanged.</p>
    <form action={action} className="space-y-4"><input type="hidden" name="eventId" value={eventId} /><input type="hidden" name="kind" value={kind} />
      <fieldset disabled={pending || state?.success} className="space-y-4">
        {currentValue && <div className="rounded-xl bg-stone-50 p-3 text-sm dark:bg-[#141d18] dark:border dark:border-[#223028]"><p className="font-semibold text-stone-900 dark:text-stone-100">Current wording</p><p className="mt-1 whitespace-pre-wrap break-words text-stone-600 dark:text-stone-300">{currentValue}</p></div>}
        <label className="block text-sm font-medium text-stone-800 dark:text-stone-200">Proposed wording<textarea name="value" defaultValue={currentValue} required maxLength={kind === "name" ? 160 : kind === "description" ? 5000 : 3000} rows={4} className={field} /></label>
        <label className="block text-sm font-medium text-stone-800 dark:text-stone-200">Why is this needed?<textarea name="reason" required minLength={20} maxLength={1000} rows={3} className={field} /><span className="mt-1 block text-xs text-stone-500 dark:text-stone-400">Use at least 20 characters.</span></label>
      </fieldset>
      {state?.message && <p role={state.success ? "status" : "alert"} className={`text-sm ${state.success ? "text-emerald-800 dark:text-emerald-400" : "text-red-800 dark:text-red-400"}`}>{state.message}</p>}
      <button disabled={pending || state?.success} className="min-h-11 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-50 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed dark:bg-emerald-600 dark:hover:bg-emerald-500">{pending ? "Sending…" : state?.success ? "Request sent" : "Send for review"}</button>
    </form>
  </EventDialog>;
}
