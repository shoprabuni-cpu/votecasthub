"use client";
import { useActionState, useRef, useState } from "react";
import { reopenEventAction, requestEventCorrectionAction } from "@/lib/events/actions";
import { EventDialog } from "./event-dialog";
export function CorrectionRequestForm({eventId}:{eventId:string}) {
  const [state,action,pending]=useActionState(requestEventCorrectionAction,null);
  return <section className="space-y-4 rounded-2xl border border-stone-200 bg-white p-5 text-stone-900 sm:p-6"><h2 className="text-lg font-semibold">Request a correction or clarification</h2><p>Fix spelling or clarify the existing rules. You cannot replace the competition, change voter eligibility, or change how winners are chosen. Platform review is required before changes appear.</p><form action={action} className="space-y-4">
    <input type="hidden" name="eventId" value={eventId}/>
    <fieldset disabled={pending} className="space-y-4"><div className="grid gap-4 sm:grid-cols-2">
      <label className="block text-sm font-semibold">What needs correcting?<select className="mt-1 w-full rounded-xl border border-stone-300 p-3 text-base font-normal" name="kind"><option value="name">Event name spelling</option><option value="description">Description correction</option><option value="instructions">Instruction correction</option><option value="clarification">Public clarification</option></select></label>
      <label className="block text-sm font-semibold sm:col-span-2">Proposed wording<textarea className="mt-1 w-full rounded-xl border border-stone-300 p-3 text-base font-normal focus:ring-2 focus:ring-emerald-700/20" name="value" required maxLength={5000} rows={4}/></label>
      <label className="block text-sm font-semibold sm:col-span-2">Why is this correction needed?<textarea className="mt-1 w-full rounded-xl border border-stone-300 p-3 text-base font-normal focus:ring-2 focus:ring-emerald-700/20" name="reason" required minLength={20} maxLength={1000} rows={3}/></label>
    </div></fieldset>
    {state?.message&&<p className="text-sm text-stone-700" role="status">{state.message}</p>}<button className="min-h-11 rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm font-semibold text-stone-800 hover:bg-stone-50 disabled:opacity-50" disabled={pending}>{pending?"Submitting…":"Submit for review"}</button>
  </form></section>;
}
export function ReopenEventForm({eventId}:{eventId:string}) {
  const [state,action,pending]=useActionState(reopenEventAction,null);
  const [ends,setEnds]=useState("");const [open,setOpen]=useState(false);
  const form=useRef<HTMLFormElement>(null);const approved=useRef(false);
  return <section className="space-y-4 rounded-2xl border border-stone-200 bg-white p-5 text-stone-900 sm:p-6"><h2 className="text-lg font-semibold">Reopen voting</h2><p className="text-sm text-stone-600">This explicitly reopens voting, including a paused event. Your reason and both deadlines will be public. Existing votes, vote limits and previously released results stay intact.</p>
    <form ref={form} action={action} className="space-y-4" onSubmit={e=>{if(!approved.current){e.preventDefault();setOpen(true);}else approved.current=false;}}>
      <input type="hidden" name="eventId" value={eventId}/><input type="hidden" name="endsAt" value={ends?new Date(ends+":00Z").toISOString():""}/>
      <fieldset disabled={pending} className="space-y-4"><div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-semibold">New deadline (Ghana time)<input className="mt-1 w-full rounded-xl border border-stone-300 p-3 text-base font-normal" type="datetime-local" required value={ends} onChange={e=>setEnds(e.target.value)}/></label>
        <label className="block text-sm font-semibold sm:col-span-2">Public reason for reopening<textarea className="mt-1 w-full rounded-xl border border-stone-300 p-3 text-base font-normal focus:ring-2 focus:ring-emerald-700/20" name="reason" required minLength={20} maxLength={1000} rows={3}/></label>
        <label className="flex items-start gap-3 text-sm text-stone-700 sm:col-span-2"><input type="checkbox" name="acknowledged" value="yes" required/> I confirm that previous votes and voter limits remain unchanged.</label>
      </div></fieldset>
      {state?.message&&<p className="text-sm text-stone-700" role="status">{state.message}</p>}
      <button className="min-h-11 rounded-xl bg-emerald-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50" disabled={pending}>{pending?"Reopening…":"Reopen voting"}</button>
    </form><EventDialog open={open} title="Reopen voting now?" onClose={()=>setOpen(false)} busy={pending}><p className="text-sm text-stone-600">Voting will resume immediately, including if paused. Your explanation and both deadlines become public. Existing votes and results are preserved.</p><div className="mt-5 flex flex-wrap gap-2"><button type="button" className="min-h-11 rounded-xl bg-emerald-900 px-4 py-2.5 text-sm font-semibold text-white" onClick={()=>{approved.current=true;setOpen(false);form.current?.requestSubmit();}}>Confirm reopening</button><button type="button" className="min-h-11 rounded-xl border border-stone-300 px-4 py-2.5 text-sm font-semibold" onClick={()=>setOpen(false)}>Cancel</button></div></EventDialog>
  </section>;
}
