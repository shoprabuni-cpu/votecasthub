"use client";
import { useActionState, useState } from "react";
import { updatePublicEventAction } from "@/lib/events/actions";
export function PublicEventEditor({ event, startLocked, expired }: { startLocked: boolean; expired: boolean; event: { id: string; name: string; description: string | null; starts_at: string; ends_at: string; status: string; results_visibility: string; voting_rules: string | null } }) {
  const [state, action, pending] = useActionState(updatePublicEventAction, null);
  const [open, setOpen] = useState(false);
  const [start, setStart] = useState(new Date(event.starts_at).toISOString().slice(0,16));
  const [end, setEnd] = useState(new Date(event.ends_at).toISOString().slice(0,16));
  const closed = event.status === "closed";
  // Preserve original seconds when a datetime input is unchanged.
  const iso = (value: string, original: string) => value === new Date(original).toISOString().slice(0,16) ? new Date(original).toISOString() : value ? new Date(value + ":00Z").toISOString() : "";
  if (!open) return <section className="event-editor-panel event-editor-collapsed"><div className="panel-heading"><p className="eyebrow">EVENT MANAGEMENT</p><h2>Manage event details</h2><p>Update permitted schedule and public information. Published-event safeguards remain active.</p></div><button type="button" className="primary-link" onClick={() => setOpen(true)}>Edit event details</button></section>;
  return <section className="event-editor-panel"><div className="panel-heading"><p className="eyebrow">EVENT MANAGEMENT</p><h2>Edit details and extend voting</h2><p>Changes appear on your public page. Vote prices, voting rules and existing votes stay fixed after publication. Descriptions and cover images can be updated while voting is open. Event identity, results visibility and voter instructions remain protected; submit sensitive wording changes for review below.</p></div>
    <form action={action} className="event-form"><input type="hidden" name="eventId" value={event.id} /><input type="hidden" name="startsAt" value={iso(start,event.starts_at)} /><input type="hidden" name="endsAt" value={iso(end,event.ends_at)} />
      <fieldset disabled={pending} className="event-edit-fields"><div className="form-grid">
        <label className="field field-wide">Event name (case/spacing corrections only)<input name="name" defaultValue={event.name} required minLength={2} maxLength={160} /></label>
        <label className="field field-wide">Description<textarea name="description" defaultValue={event.description ?? ""} readOnly={closed} maxLength={5000} rows={4} /></label>
        <label className="field">Voting opens (Ghana time)<input type="datetime-local" value={start} required disabled={closed || startLocked} onChange={e=>setStart(e.target.value)} /></label>
        <label className="field">Voting closes (Ghana time)<input type="datetime-local" value={end} required disabled={closed || expired} min={new Date(event.ends_at).toISOString().slice(0,16)} onChange={e=>setEnd(e.target.value)} /></label>
        <p className="field-wide payment-account-note">{closed ? "This event was permanently closed. Its dates and rules are locked. Submit corrections for review." : event.status === "paused" ? "Extending the deadline keeps this event paused. Use Resume event when you are ready." : "Choose a later closing time to extend voting. After the deadline, use Reopen voting with a public explanation. Use Pause to stop voting temporarily."}</p>
        <label className="field field-wide">Instructions for voters<textarea name="votingRules" defaultValue={event.voting_rules ?? ""} readOnly={startLocked || closed} maxLength={3000} rows={3} /></label>
        <label className="field">Results visibility<><input type="hidden" name="resultsVisibility" value={event.results_visibility} disabled={!startLocked && !closed}/><select name="resultsVisibility" disabled={startLocked || closed} defaultValue={event.results_visibility}><option value="live">Live during voting</option><option value="after_close">After voting closes</option><option value="organizer_only">Organizer only</option><option value="hidden">Keep results hidden</option></select></></label>
      </div></fieldset>
      {state?.message && <p className={state.success ? "form-message form-success" : "form-message"} role="status">{state.message}</p>}
      <div className="event-actions"><button className="primary-link" disabled={pending}>{pending ? "Saving…" : "Save event changes"}</button><button type="button" className="secondary-button" disabled={pending} onClick={() => setOpen(false)}>Cancel</button></div>
    </form>
  </section>;
}
