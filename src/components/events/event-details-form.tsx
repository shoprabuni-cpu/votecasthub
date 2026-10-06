"use client";

import { useActionState } from "react";
import { useState } from "react";
import { createEventAction, updateEventDraftAction } from "@/lib/auth/actions";
import type { AuthFormState } from "@/lib/auth/form-state";
import { votingRuleOptions, type VotingRule } from "@/lib/voting-rules";

type EventValues = { name: string; description: string | null; price: number; startsAt: string; endsAt: string; resultsVisibility: string; votingMode?: "free" | "paid"; verificationMethod?: "phone" | "email"; votingRule?: VotingRule; freeVoteLimit?: number | null; votingRules?: string | null };

function asLocalInput(value?: string) {
  return value ? new Date(value).toISOString().slice(0, 16) : "";
}

export function EventDetailsForm({ organizationId, eventId, initial }: { organizationId: string; eventId?: string; initial?: EventValues }) {
  const action = eventId ? updateEventDraftAction : createEventAction;
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(action, null);
  const [votingMode, setVotingMode] = useState<"free" | "paid">(initial?.votingMode ?? "free");
  const [verificationMethod, setVerificationMethod] = useState<"phone" | "email" | "invite_code" | "voter_list">(initial?.verificationMethod ?? "phone");
  const [step, setStep] = useState(1);
  const [votingRule, setVotingRule] = useState<VotingRule>(initial?.votingRule ?? "category_limit");
  const [values, setValues] = useState({
    name: initial?.name ?? "",
    description: initial?.description ?? "",
    priceGhs: initial?.votingMode === "paid" ? (initial.price / 100).toFixed(2) : "1.00",
    freeVoteLimit: String(initial?.votingMode === "free" ? initial.freeVoteLimit ?? 1 : 1),
    votingRules: initial?.votingRules ?? "",
    resultsVisibility: initial?.resultsVisibility ?? "organizer_only",
    startsAt: asLocalInput(initial?.startsAt),
    endsAt: asLocalInput(initial?.endsAt),
  });
  const updateValue = (field: keyof typeof values, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
  };
  return <form action={formAction} className={`event-form is-step-${step}`}>
    <div className="event-form-stepbar"><button type="button" className={step===1?"is-active":""} onClick={()=>setStep(1)}>1. Basics</button><button type="button" className={step===2?"is-active":""} onClick={()=>setStep(2)}>2. Voting method</button><button type="button" className={step===3?"is-active":""} onClick={()=>setStep(3)}>3. Rules</button><button type="button" className={step===4?"is-active":""} onClick={()=>setStep(4)}>4. Review</button></div>
    <input type="hidden" name="organizationId" value={organizationId} />
    {eventId && <input type="hidden" name="eventId" value={eventId} />}
    <input type="hidden" name="votingRule" value={votingRule} />
    <input type="hidden" name="verificationMethod" value={verificationMethod} />
    <div className="form-grid">
      <div className="field field-wide"><label htmlFor="event-name">What is your event called?</label><input id="event-name" name="name" minLength={2} maxLength={160} required value={values.name} onChange={(event) => updateValue("name", event.target.value)} placeholder="e.g. AAMUSTED Student Awards 2026" /><small>Use the name voters will recognize.</small></div>
      <div className="field field-wide"><label htmlFor="event-description">What is this event about? <span>optional</span></label><textarea id="event-description" name="description" maxLength={5000} rows={3} value={values.description} onChange={(event) => updateValue("description", event.target.value)} placeholder="Briefly explain what the event celebrates." /></div>
      <fieldset className="field field-wide voting-mode-field"><legend>How should people vote?</legend><div className="voting-mode-options">
        <label className={`voting-mode-card ${votingMode === "free" ? "is-selected" : ""}`}><input type="radio" name="votingMode" value="free" checked={votingMode === "free"} onChange={() => setVotingMode("free")} /><span className="mode-card-icon" aria-hidden="true">✳</span><span><strong>Free voting</strong><small>Voters pay nothing. Choose how they verify before voting.</small></span></label>
        <label className={`voting-mode-card ${votingMode === "paid" ? "is-selected" : ""}`}><input type="radio" name="votingMode" value="paid" checked={votingMode === "paid"} onChange={() => setVotingMode("paid")} /><span className="mode-card-icon" aria-hidden="true">₵</span><span><strong>Paid voting · no SMS required</strong><small>Voters pay per vote through checkout. SMS credits are not used.</small></span></label>
      </div></fieldset>
      {votingMode === "paid" ? <div className="field field-wide mode-detail-panel paid-mode-notice" key="paid"><label htmlFor="event-price">Price per vote (GHS)</label><div className="price-input-wrap"><span aria-hidden="true">₵</span><input id="event-price" name="priceGhs" type="number" inputMode="decimal" min="0.01" max="10000000000" step="0.01" required value={values.priceGhs} onChange={(event) => updateValue("priceGhs", event.target.value)} /></div><small>Paid events can be saved as drafts. Publishing stays locked until a payment provider is connected and verified.</small></div> : <>
        <div className="field field-wide mode-detail-panel" key="free">
          <label htmlFor="voting-rule">Choose a voting rule</label>
          <select id="voting-rule" name="votingRuleChoice" value={votingRule} onChange={(event) => { const next = event.target.value as VotingRule; setVotingRule(next); if (next === "one_per_category") updateValue("freeVoteLimit", "1"); }}>
            {votingRuleOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <small>{votingRuleOptions.find((option) => option.value === votingRule)?.description}</small>
          <label htmlFor="verification-method">How should voters verify?</label><select id="verification-method" value={verificationMethod} onChange={event => setVerificationMethod(event.target.value as "phone" | "email" | "invite_code" | "voter_list")}><option value="phone">Phone number (SMS code)</option><option value="email">Email address (email code)</option><option value="invite_code">Private access code</option><option value="voter_list">Approved voter list</option></select><small>{verificationMethod === "phone" ? "Each voter receives a one-time SMS code. SMS credits are used." : verificationMethod === "email" ? "Each voter receives a one-time code by email." : verificationMethod === "invite_code" ? "Voters enter a code you share with your invited audience." : "Only people you add to the approved list can vote."}</small>
          {votingRule === "one_per_category" ? <input type="hidden" name="freeVoteLimit" value="1" /> : <div className="free-limit-row"><label htmlFor="free-vote-limit">Maximum votes {votingRule === "per_nominee_limit" ? "per nominee, per category" : "per category"}</label><input id="free-vote-limit" name="freeVoteLimit" type="number" min="1" max="100" step="1" required value={values.freeVoteLimit} onChange={(event) => updateValue("freeVoteLimit", event.target.value)} /><span>votes</span></div>}
          {verificationMethod === "phone" && <div className="sms-credit-callout"><span aria-hidden="true">✦</span><p><strong>SMS credits are required</strong><br />Each new voter receives one verification SMS. Add credits before publishing so your event can keep accepting voters.</p><a href={`/organizer/${organizationId}/credits`}>View SMS pricing →</a></div>}
        </div>
      </>}
      <div className="field field-wide"><label htmlFor="voting-rules">Extra instructions for voters <span>optional</span></label><textarea id="voting-rules" name="votingRules" maxLength={3000} rows={4} value={values.votingRules} onChange={(event) => updateValue("votingRules", event.target.value)} placeholder="Explain event-specific details, such as who is eligible or how a winner is decided." /><small>This note is for display only. The selected verification method and voting rule are enforced automatically.</small></div>
      <div className="field"><label htmlFor="results-visibility">When should voters see results?</label><select id="results-visibility" name="resultsVisibility" value={values.resultsVisibility} onChange={(event) => updateValue("resultsVisibility", event.target.value)}><option value="organizer_only">Only the organizer</option><option value="live">While voting is open</option><option value="after_close">After voting closes</option><option value="hidden">Keep results hidden</option></select></div>
      <div className="field"><label htmlFor="starts-at">When does voting open?</label><input id="starts-at" name="startsAt" type="datetime-local" required value={values.startsAt} onChange={(event) => updateValue("startsAt", event.target.value)} /><small>Ghana time</small></div>
      <div className="field"><label htmlFor="ends-at">When does voting close?</label><input id="ends-at" name="endsAt" type="datetime-local" required value={values.endsAt} onChange={(event) => updateValue("endsAt", event.target.value)} /><small>Ghana time</small></div>
    </div>
    {state?.message && <p className={state.success ? "form-message form-success" : "form-message"} role={state.success ? "status" : "alert"}>{state.message}</p>}
    <button className="primary-link" type="submit" disabled={pending}>{pending ? "Saving…" : eventId ? "Save draft details" : "Create draft event"}</button>
  </form>;
}
