"use client";

import { useActionState } from "react";
import { useState } from "react";
import { createEventAction, updateEventDraftAction } from "@/lib/auth/actions";
import type { AuthFormState } from "@/lib/auth/form-state";

type EventValues = { name: string; description: string | null; price: number; startsAt: string; endsAt: string; resultsVisibility: string; votingMode?: "free" | "paid"; freeVoteLimit?: number | null; votingRules?: string | null };

function asLocalInput(value?: string) {
  return value ? new Date(value).toISOString().slice(0, 16) : "";
}

export function EventDetailsForm({ organizationId, eventId, initial }: { organizationId: string; eventId?: string; initial?: EventValues }) {
  const action = eventId ? updateEventDraftAction : createEventAction;
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(action, null);
  const [votingMode, setVotingMode] = useState<"free" | "paid">(initial?.votingMode ?? "paid");
  return <form action={formAction} className="event-form">
    <input type="hidden" name="organizationId" value={organizationId} />
    {eventId && <input type="hidden" name="eventId" value={eventId} />}
    <div className="form-grid">
      <div className="field field-wide"><label htmlFor="event-name">Event name</label><input id="event-name" name="name" minLength={2} maxLength={160} required defaultValue={initial?.name} placeholder="e.g. AAMUSTED Student Awards" /></div>
      <div className="field field-wide"><label htmlFor="event-description">Event description <span>optional</span></label><textarea id="event-description" name="description" maxLength={5000} rows={3} defaultValue={initial?.description ?? ""} placeholder="Tell voters what this event celebrates." /></div>
      <fieldset className="field field-wide voting-mode-field"><legend>How will voting work?</legend><div className="voting-mode-options">
        <label className={`voting-mode-card ${votingMode === "free" ? "is-selected" : ""}`}><input type="radio" name="votingMode" value="free" checked={votingMode === "free"} onChange={() => setVotingMode("free")} /><span className="mode-card-icon" aria-hidden="true">✳</span><span><strong>Free voting</strong><small>Voters won’t pay to cast a vote.</small></span></label>
        <label className={`voting-mode-card ${votingMode === "paid" ? "is-selected" : ""}`}><input type="radio" name="votingMode" value="paid" checked={votingMode === "paid"} onChange={() => setVotingMode("paid")} /><span className="mode-card-icon" aria-hidden="true">₵</span><span><strong>Paid voting</strong><small>Set a price per vote in Ghana cedis.</small></span></label>
      </div></fieldset>
      {votingMode === "paid" ? <div className="field field-wide mode-detail-panel" key="paid"><label htmlFor="event-price">Price per vote (GHS)</label><div className="price-input-wrap"><span aria-hidden="true">₵</span><input id="event-price" name="priceGhs" type="number" inputMode="decimal" min="0.01" max="10000000000" step="0.01" required defaultValue={initial?.votingMode === "paid" ? (initial.price / 100).toFixed(2) : "1.00"} /></div><small>Checkout totals will be calculated on the server.</small></div> : <div className="field field-wide mode-detail-panel" key="free"><label htmlFor="free-vote-limit">Free votes per verified phone, per category</label><div className="free-limit-row"><input id="free-vote-limit" name="freeVoteLimit" type="number" min="1" max="100" step="1" required defaultValue={initial?.votingMode === "free" ? initial.freeVoteLimit ?? 1 : 1} /><span>votes</span><small>Voter phone verification must be configured before accepting free votes.</small></div></div>}
      <div className="field field-wide"><label htmlFor="voting-rules">Voting rules and eligibility <span>optional</span></label><textarea id="voting-rules" name="votingRules" maxLength={3000} rows={4} defaultValue={initial?.votingRules ?? ""} placeholder="Explain who can vote, vote limits, eligibility, and how the winner is decided." /><small>These rules will appear on the public event page. You can edit them while the event is a draft.</small></div>
      <div className="field"><label htmlFor="results-visibility">Results visibility</label><select id="results-visibility" name="resultsVisibility" defaultValue={initial?.resultsVisibility ?? "organizer_only"}><option value="organizer_only">Organizer only</option><option value="live">Live during voting</option><option value="after_close">After voting closes</option><option value="hidden">Keep results hidden</option></select></div>
      <div className="field"><label htmlFor="starts-at">Voting opens (Ghana time)</label><input id="starts-at" name="startsAt" type="datetime-local" required defaultValue={asLocalInput(initial?.startsAt)} /></div>
      <div className="field"><label htmlFor="ends-at">Voting closes (Ghana time)</label><input id="ends-at" name="endsAt" type="datetime-local" required defaultValue={asLocalInput(initial?.endsAt)} /></div>
    </div>
    {state?.message && <p className={state.success ? "form-message form-success" : "form-message"} role={state.success ? "status" : "alert"}>{state.message}</p>}
    <button className="primary-link" type="submit" disabled={pending}>{pending ? "Saving…" : eventId ? "Save draft details" : "Create draft event"}</button>
  </form>;
}
