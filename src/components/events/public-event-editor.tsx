"use client";
import { useActionState, useState } from "react";
import { updatePublicEventAction } from "@/lib/events/actions";
export function PublicEventEditor({ event, startLocked }: { startLocked: boolean; event: { id: string; name: string; description: string | null; starts_at: string; ends_at: string; status: string; results_visibility: string; voting_rules: string | null } }) {
  const [state, action, pending] = useActionState(updatePublicEventAction, null);
  const [start, setStart] = useState(new Date(event.starts_at).toISOString().slice(0,16));
  const [end, setEnd] = useState(new Date(event.ends_at).toISOString().slice(0,16));
  const closed = event.status === "closed";
  // Preserve original seconds when a datetime input is unchanged.
  const iso = (value: string, original: string) => value === new Date(original).toISOString().slice(0,16) ? new Date(original).toISOString() : value ? new Date(value + ":00Z").toISOString() : "";
  return <section className="event-editor-panel"><div className="panel-heading"><p className="eyebrow">EVENT MANAGEMENT</p><h2>Edit details and extend voting</h2><p>Changes appear on your public page. Vote prices, voting rules and existing votes stay fixed after publication.</p></div>
    <form action={action} className="event-form"><input type="hidden" name="eventId" value={event.id} /><input type="hidden" name="startsAt" value={iso(start,event.starts_at)} /><input type="hidden" name="endsAt" value={iso(end,event.ends_at)} />
      <fieldset disabled={pending} className="event-edit-fields"><div className="form-grid">
        <label className="field field-wide">Event name<input name="name" defaultValue={event.name} required minLength={2} maxLength={160} /></label>
        <label className="field field-wide">Description<textarea name="description" defaultValue={event.description ?? ""} maxLength={5000} rows={4} /></label>
        <label className="field">Voting opens (Ghana time)<input type="datetime-local" value={start} required disabled={closed || startLocked} onChange={e=>setStart(e.target.value)} /></label>
        <label className="field">Voting closes (Ghana time)<input type="datetime-local" value={end} required disabled={closed} min={new Date(event.ends_at).toISOString().slice(0,16)} onChange={e=>setEnd(e.target.value)} /></label>
        <p className="field-wide payment-account-note">{closed ? "This event was permanently closed. Its dates cannot be changed, but you can edit its description and results visibility." : event.status === "paused" ? "Extending the deadline keeps this event paused. Use Resume event when you are ready." : "Choose a later closing time to extend voting. If the original deadline has passed, saving a future deadline reopens voting. Use Pause to stop voting temporarily."}</p>
        <label className="field field-wide">Instructions for voters<textarea name="votingRules" defaultValue={event.voting_rules ?? ""} maxLength={3000} rows={3} /></label>
        <label className="field">Results visibility<select name="resultsVisibility" defaultValue={event.results_visibility}><option value="live">Live during voting</option><option value="after_close">After voting closes</option><option value="organizer_only">Organizer only</option><option value="hidden">Keep results hidden</option></select></label>
      </div></fieldset>
      {state?.message && <p className={state.success ? "form-message form-success" : "form-message"} role="status">{state.message}</p>}
      <button className="primary-link" disabled={pending}>{pending ? "Saving…" : "Save event changes"}</button>
    </form>
  </section>;
}
