"use client";

import { useState } from "react";
import { updatePublicEventAction } from "@/lib/events/actions";
import type { EventEditPermissions } from "@/lib/events/edit-permissions";
import { EventCorrection } from "./event-correction";
import { EventSaveFeedback, useEventSaveFeedback } from "./event-save-feedback";

const field = "mt-1 w-full rounded-xl border border-stone-300 bg-white p-3 text-base text-stone-900 read-only:bg-stone-50 disabled:bg-stone-100 disabled:text-stone-600 focus:ring-2 focus:ring-emerald-700/20";
type PublicEvent = { id: string; name: string; description: string | null; starts_at: string; ends_at: string; status: string; results_visibility: string; voting_rules: string | null };
export function PublicEventEditor({ event, permissions, scheduleOnly = false }: { event: PublicEvent; permissions: EventEditPermissions; scheduleOnly?: boolean }) {
  const { state, formAction, pending, dirty, markChanged } = useEventSaveFeedback(updatePublicEventAction);
  const [start, setStart] = useState(new Date(event.starts_at).toISOString().slice(0, 16));
  const [end, setEnd] = useState(new Date(event.ends_at).toISOString().slice(0, 16));
  const iso = (value: string, original: string) => value === new Date(original).toISOString().slice(0, 16) ? new Date(original).toISOString() : value ? new Date(value + ":00Z").toISOString() : "";
  return <div className="space-y-4 rounded-2xl border border-stone-200 bg-white p-5 sm:p-6">
    <p className="text-sm text-stone-600">{scheduleOnly ? "You can extend the deadline. Shortening it is unavailable." : "Save available changes here. Request a correction beside protected wording."}</p>
    <EventSaveFeedback dirty={dirty} pending={pending} state={state} />
    <form action={formAction} onChange={markChanged} className="space-y-5">
      <input type="hidden" name="eventId" value={event.id} /><input type="hidden" name="startsAt" value={iso(start, event.starts_at)} /><input type="hidden" name="endsAt" value={iso(end, event.ends_at)} />
      {scheduleOnly && <><input type="hidden" name="name" value={event.name} /><input type="hidden" name="description" value={event.description ?? ""} /><input type="hidden" name="votingRules" value={event.voting_rules ?? ""} /><input type="hidden" name="resultsVisibility" value={event.results_visibility} /></>}
      <fieldset disabled={pending} className="space-y-5">
        {!scheduleOnly && <>
          <div><label className="block text-sm font-semibold">Event name<input name="name" defaultValue={event.name} required minLength={2} maxLength={160} className={field} /></label><p className="mt-1 text-xs text-stone-500">You can adjust capital letters and spacing. Spelling changes need a correction request.</p><EventCorrection eventId={event.id} kind="name" currentValue={event.name} /></div>
          <div><label className="block text-sm font-semibold">Description<textarea name="description" defaultValue={event.description ?? ""} readOnly={!permissions.editDescription} maxLength={5000} rows={4} className={field} /></label>{!permissions.editDescription && <><p className="mt-1 text-xs text-stone-500">This event is permanently closed. Changes need review.</p><EventCorrection eventId={event.id} kind="description" currentValue={event.description ?? ""} /></>}</div>
          <div><label className="block text-sm font-semibold">Instructions for voters<textarea name="votingRules" defaultValue={event.voting_rules ?? ""} readOnly={!permissions.editRules} maxLength={3000} rows={3} className={field} /></label>{!permissions.editRules && <><p className="mt-1 text-xs text-stone-500">These instructions stay protected to keep voting fair. Request a correction to fix the wording.</p><EventCorrection eventId={event.id} kind="instructions" currentValue={event.voting_rules ?? ""} /></>}</div>
          <label className="block text-sm font-semibold">Results visibility{!permissions.editRules && <input type="hidden" name="resultsVisibility" value={event.results_visibility} />}<select name="resultsVisibility" disabled={!permissions.editRules} defaultValue={event.results_visibility} className={field}><option value="live">Live during voting</option><option value="after_close">After voting closes</option><option value="organizer_only">Organizer only</option><option value="hidden">Keep results hidden</option></select>{!permissions.editRules && <span className="mt-1 block text-xs text-stone-500">Results visibility is locked for this event.</span>}</label>
        </>}
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-semibold">Voting opens (Ghana time)<input type="datetime-local" value={start} required disabled={!permissions.editStart} onChange={event => setStart(event.target.value)} className={field} />{!permissions.editStart && <span className="mt-1 block text-xs text-stone-500">The opening time is locked.</span>}</label>
          <label className="block text-sm font-semibold">Voting closes (Ghana time)<input type="datetime-local" value={end} required disabled={!permissions.extend} min={new Date(event.ends_at).toISOString().slice(0, 16)} onChange={event => setEnd(event.target.value)} className={field} />{!permissions.extend && <span className="mt-1 block text-xs text-stone-500">{event.status === "closed" ? "This event cannot reopen." : "The deadline passed. Use Reopen voting."}</span>}</label>
        </div>
        {event.status === "paused" && permissions.extend && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Extending the deadline keeps voting paused. Resume voting when ready.</p>}
      </fieldset>
      <div className="sticky bottom-3 z-10 flex flex-col gap-3 rounded-2xl border border-stone-200 bg-white/95 p-3 shadow-lg shadow-stone-900/5 backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between"><p className="text-xs text-stone-500">{pending ? "Saving…" : dirty ? "Your changes aren’t saved yet." : state?.success ? "All changes saved." : "Save when you’re ready."}</p><button disabled={pending} className="min-h-11 rounded-xl bg-emerald-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50">{pending ? "Saving…" : scheduleOnly ? "Save schedule" : "Save changes"}</button></div>
    </form>
    {!scheduleOnly && <EventCorrection eventId={event.id} kind="clarification" />}
  </div>;
}
