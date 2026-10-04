"use client";
import { useActionState, useRef, useState } from "react";
import { reopenEventAction, requestEventCorrectionAction } from "@/lib/events/actions";
import { AppModal } from "@/components/ui/app-modal";
export function CorrectionRequestForm({eventId}:{eventId:string}) {
  const [state,action,pending]=useActionState(requestEventCorrectionAction,null);
  return <section className="event-editor-panel"><h2>Request a correction or clarification</h2><p>Fix spelling or clarify the existing rules. You cannot replace the competition, change voter eligibility, or change how winners are chosen. Platform review is required before changes appear.</p><form action={action} className="event-form">
    <input type="hidden" name="eventId" value={eventId}/>
    <fieldset disabled={pending} className="event-edit-fields"><div className="form-grid">
      <label className="field">What needs correcting?<select name="kind"><option value="name">Event name spelling</option><option value="description">Description correction</option><option value="instructions">Instruction correction</option><option value="clarification">Public clarification</option></select></label>
      <label className="field field-wide">Proposed wording<textarea name="value" required maxLength={5000} rows={4}/></label>
      <label className="field field-wide">Why is this correction needed?<textarea name="reason" required minLength={20} maxLength={1000} rows={3}/></label>
    </div></fieldset>
    {state?.message&&<p className="form-message" role="status">{state.message}</p>}<button className="secondary-button" disabled={pending}>{pending?"Submitting…":"Submit for review"}</button>
  </form></section>;
}
export function ReopenEventForm({eventId}:{eventId:string}) {
  const [state,action,pending]=useActionState(reopenEventAction,null);
  const [ends,setEnds]=useState("");const [open,setOpen]=useState(false);
  const form=useRef<HTMLFormElement>(null);const approved=useRef(false);
  return <section className="event-editor-panel"><h2>Reopen expired voting</h2><p>This explicitly reopens voting, including a paused event. Your reason and both deadlines will be public. Existing votes, vote limits and previously released results stay intact.</p>
    <form ref={form} action={action} className="event-form" onSubmit={e=>{if(!approved.current){e.preventDefault();setOpen(true);}else approved.current=false;}}>
      <input type="hidden" name="eventId" value={eventId}/><input type="hidden" name="endsAt" value={ends?new Date(ends+":00Z").toISOString():""}/>
      <fieldset disabled={pending} className="event-edit-fields"><div className="form-grid">
        <label className="field">New deadline (Ghana time)<input type="datetime-local" required value={ends} onChange={e=>setEnds(e.target.value)}/></label>
        <label className="field field-wide">Public reason for reopening<textarea name="reason" required minLength={20} maxLength={1000} rows={3}/></label>
        <label className="field-wide"><input type="checkbox" name="acknowledged" value="yes" required/> I confirm that previous votes and voter limits remain unchanged.</label>
      </div></fieldset>
      {state?.message&&<p className="form-message" role="status">{state.message}</p>}
      <button className="primary-link" disabled={pending}>{pending?"Reopening…":"Reopen voting"}</button>
    </form><AppModal open={open} title="Reopen voting publicly?" message="Voting will resume immediately. The reopening reason and deadline change will be visible to voters. Previous votes and results are preserved." confirmLabel="Confirm reopening" onCancel={()=>setOpen(false)} onConfirm={()=>{approved.current=true;setOpen(false);form.current?.requestSubmit();}}/>
  </section>;
}
