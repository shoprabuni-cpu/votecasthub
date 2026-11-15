"use client";

import { useState } from "react";
import { updatePublicEventAction } from "@/lib/events/actions";
import type { EventEditPermissions } from "@/lib/events/edit-permissions";
import { EventCorrection } from "./event-correction";
import { EventSaveFeedback, useEventSaveFeedback } from "./event-save-feedback";
import { Icon } from "@/components/icon";

const field =
  "w-full rounded-xl border border-stone-300 bg-white px-3.5 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15 read-only:bg-stone-50/60 disabled:bg-stone-100 disabled:text-stone-500 transition-all";

type PublicEvent = {
  id: string;
  name: string;
  description: string | null;
  starts_at: string;
  ends_at: string;
  status: string;
  results_visibility: string;
  voting_rules: string | null;
};

export function PublicEventEditor({
  event,
  permissions,
  scheduleOnly = false,
}: {
  event: PublicEvent;
  permissions: EventEditPermissions;
  scheduleOnly?: boolean;
}) {
  const { state, formAction, pending, dirty, markChanged } = useEventSaveFeedback(
    updatePublicEventAction
  );
  const [start, setStart] = useState(new Date(event.starts_at).toISOString().slice(0, 16));
  const [end, setEnd] = useState(new Date(event.ends_at).toISOString().slice(0, 16));

  const iso = (value: string, original: string) =>
    value === new Date(original).toISOString().slice(0, 16)
      ? new Date(original).toISOString()
      : value
      ? new Date(value + ":00Z").toISOString()
      : "";

  return (
    <div className="space-y-5 rounded-2xl border border-stone-200 bg-white p-5 sm:p-6 shadow-xs">
      <div>
        <div className="flex items-center gap-2 text-emerald-800 text-xs font-semibold uppercase tracking-wider">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-600" />
          Edit Active Event
        </div>
        <h2 className="mt-1 font-serif text-xl sm:text-2xl font-bold tracking-tight text-stone-900">
          {scheduleOnly ? "Adjust Voting Schedule" : "Manage Event Details"}
        </h2>
        <p className="mt-1 text-xs text-stone-500 leading-relaxed">
          {scheduleOnly
            ? "You can extend the voting deadline. Shortening it is restricted to preserve ballot integrity."
            : "Save available edits here. Protected fields (e.g., spelling alterations) require a platform correction request."}
        </p>
      </div>

      <EventSaveFeedback dirty={dirty} pending={pending} state={state} />

      <form action={formAction} onChange={markChanged} className="space-y-5">
        <input type="hidden" name="eventId" value={event.id} />
        <input type="hidden" name="startsAt" value={iso(start, event.starts_at)} />
        <input type="hidden" name="endsAt" value={iso(end, event.ends_at)} />

        {scheduleOnly && (
          <>
            <input type="hidden" name="name" value={event.name} />
            <input type="hidden" name="description" value={event.description ?? ""} />
            <input type="hidden" name="votingRules" value={event.voting_rules ?? ""} />
            <input type="hidden" name="resultsVisibility" value={event.results_visibility} />
          </>
        )}

        <fieldset disabled={pending} className="space-y-4">
          {!scheduleOnly && (
            <>
              <div>
                <label className="block text-xs font-semibold text-stone-800 mb-1">
                  Official Event Name
                </label>
                <input
                  name="name"
                  defaultValue={event.name}
                  required
                  minLength={2}
                  maxLength={160}
                  className={field}
                />
                <p className="mt-1 text-[11px] text-stone-500">
                  Spacing and casing adjustments take effect immediately. Substantive name changes require review.
                </p>
                <EventCorrection eventId={event.id} kind="name" currentValue={event.name} />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-800 mb-1">
                  Story &amp; Description
                </label>
                <textarea
                  name="description"
                  defaultValue={event.description ?? ""}
                  readOnly={!permissions.editDescription}
                  maxLength={5000}
                  rows={4}
                  className={`${field} resize-none`}
                />
                {!permissions.editDescription && (
                  <>
                    <p className="mt-1 text-[11px] text-stone-500">
                      This event is permanently closed. Description modifications require administrative review.
                    </p>
                    <EventCorrection eventId={event.id} kind="description" currentValue={event.description ?? ""} />
                  </>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-800 mb-1">
                  Instructions for Voters
                </label>
                <textarea
                  name="votingRules"
                  defaultValue={event.voting_rules ?? ""}
                  readOnly={!permissions.editRules}
                  maxLength={3000}
                  rows={3}
                  className={`${field} resize-none`}
                />
                {!permissions.editRules && (
                  <>
                    <p className="mt-1 text-[11px] text-stone-500">
                      Voting guidelines are protected once an event is live to protect fair contest outcomes.
                    </p>
                    <EventCorrection eventId={event.id} kind="instructions" currentValue={event.voting_rules ?? ""} />
                  </>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-800 mb-1">
                  Live Results Visibility
                </label>
                {!permissions.editRules && (
                  <input type="hidden" name="resultsVisibility" value={event.results_visibility} />
                )}
                <select
                  name="resultsVisibility"
                  disabled={!permissions.editRules}
                  defaultValue={event.results_visibility}
                  className={field}
                >
                  <option value="live">Live during voting</option>
                  <option value="after_close">After voting closes</option>
                  <option value="organizer_only">Organizer only</option>
                  <option value="hidden">Keep results hidden</option>
                </select>
                {!permissions.editRules && (
                  <span className="mt-1 block text-[11px] text-stone-500">
                    Results visibility is locked while active.
                  </span>
                )}
              </div>
            </>
          )}

          {/* Voting Window */}
          <div className="rounded-xl border border-stone-200 bg-stone-50/50 p-4 space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-stone-800">
              <Icon name="clock" size={13} />
              <span>Voting Schedule (Ghana Time / GMT)</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Voting Opens
                </label>
                <input
                  type="datetime-local"
                  value={start}
                  required
                  disabled={!permissions.editStart}
                  onChange={(e) => setStart(e.target.value)}
                  className={field}
                />
                {!permissions.editStart && (
                  <span className="mt-1 block text-[11px] text-stone-500">Opening time is locked.</span>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Voting Closes
                </label>
                <input
                  type="datetime-local"
                  value={end}
                  required
                  disabled={!permissions.extend}
                  min={new Date(event.ends_at).toISOString().slice(0, 16)}
                  onChange={(e) => setEnd(e.target.value)}
                  className={field}
                />
                {!permissions.extend && (
                  <span className="mt-1 block text-[11px] text-stone-500">
                    {event.status === "closed" ? "Event closed permanently." : "Deadline has passed."}
                  </span>
                )}
              </div>
            </div>
          </div>

          {event.status === "paused" && permissions.extend && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              ℹ️ Extending the closing deadline keeps voting paused. Resume voting when ready from the voting controls.
            </div>
          )}
        </fieldset>

        <div className="sticky bottom-3 z-10 flex flex-col gap-3 rounded-2xl border border-stone-200 bg-white/95 p-3.5 shadow-lg shadow-stone-900/5 backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-stone-500">
            {pending
              ? "Saving changes…"
              : dirty
              ? "• Unsaved modifications detected."
              : state?.success
              ? "✓ All changes saved successfully."
              : "Review changes and click save when ready."}
          </p>
          <button
            type="submit"
            disabled={pending}
            className="min-h-11 rounded-xl bg-emerald-900 px-6 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-800 disabled:opacity-50 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 transition-all"
          >
            {pending ? "Saving…" : scheduleOnly ? "Save Schedule" : "Save Changes"}
          </button>
        </div>
      </form>

      {!scheduleOnly && <EventCorrection eventId={event.id} kind="clarification" />}
    </div>
  );
}
