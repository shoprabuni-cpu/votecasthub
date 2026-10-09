"use client";

import { useActionState, useEffect, useState } from "react";
import { AuthCaptcha } from "@/components/auth/auth-captcha";
import { verifyEventVoterAction } from "@/lib/auth/voter-verification";
import type { AuthFormState } from "@/lib/auth/form-state";

type InputType = "phone" | "email" | "identifier" | "invite_code";
const labels: Record<InputType, string> = { phone: "Phone number", email: "Email address", identifier: "Index number / voter ID", invite_code: "Private voting code" };
const inputClass = "w-full rounded-xl border border-stone-300 bg-white px-3 py-3 text-base text-stone-900 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20";

export function EventVoterVerification({ eventId, method, isVerified, hasRedeemed = false, available, inputTypes = [] }: {
  eventId: string; method: "phone" | "email" | "invite_code" | "voter_list";
  isVerified: boolean; hasRedeemed?: boolean; available: boolean; inputTypes?: InputType[];
}) {
  const types: InputType[] = method === "voter_list" ? inputTypes.filter(type => type !== "invite_code") : [method];
  const [selected, setSelected] = useState<InputType | null>(null);
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const type = selected && types.includes(selected) ? selected : types[0];
  if (isVerified || hasRedeemed) return <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">{isVerified ? "You’re verified. Select your nominees and vote below." : "Your approved voter allowance has been used. No votes remain."}</p>;
  if (!available) return <p className="rounded-xl bg-stone-100 p-4 text-sm text-stone-600">Verification will be available while voting is open.</p>;
  if (!type) return <p role="status" className="text-sm text-stone-600">Voter-list verification is temporarily unavailable. Please contact the organizer.</p>;
  return <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4 sm:p-5">
    {types.length > 1 && <div className="mb-4 space-y-2"><label htmlFor={`voter-type-${eventId}`} className="block text-sm font-semibold">Which details did your organizer ask you to use?</label><select id={`voter-type-${eventId}`} value={type} disabled={busy} onChange={event => setSelected(event.target.value as InputType)} className={inputClass}>{types.map(value => <option key={value} value={value}>{labels[value]}</option>)}</select></div>}
    <VerificationForm key={`${type}:${revision}`} eventId={eventId} type={type} restricted={method === "voter_list"} onBusy={setBusy} onChangeDetails={() => setRevision(value => value + 1)} />
  </div>;
}

function VerificationForm({ eventId, type, restricted, onBusy, onChangeDetails }: { eventId: string; type: InputType; restricted: boolean; onBusy: (value: boolean) => void; onChangeDetails: () => void }) {
  const [sent, setSent] = useState(false);
  const [identifier, setIdentifier] = useState("");
  const [captchaReady, setCaptchaReady] = useState(!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);
  const [now, setNow] = useState(0);
  const [resendAt, setResendAt] = useState(0);
  const [state, action, pending] = useActionState<AuthFormState, FormData>(async (previous, form) => {
    const result = await verifyEventVoterAction(previous, form);
    if (result?.codeSent) {
      setSent(true);
      setIdentifier(result.phone ?? result.email ?? "");
      setResendAt(result.resendAt ?? 0);
      setNow(Date.now());
    }
    return result;
  }, null);
  const contact = type === "phone" || type === "email";
  const verified = state?.success === true && !state.codeSent;
  useEffect(() => { onBusy(pending); }, [pending, onBusy]);
  useEffect(() => {
    if (!sent) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [sent]);
  const wait = Math.max(0, Math.ceil((resendAt - now) / 1000));
  return <form action={action} aria-busy={pending} className="space-y-3">
    <input type="hidden" name="eventId" value={eventId} /><input type="hidden" name="type" value={type} />
    <label htmlFor={`voter-input-${eventId}`} className="block text-sm font-semibold">{labels[type]}</label>
    <input id={`voter-input-${eventId}`} name="identifier" value={identifier} onChange={event => setIdentifier(event.target.value)} readOnly={sent || verified || pending} required maxLength={320} type={type === "email" ? "email" : type === "phone" ? "tel" : "text"} autoComplete={type === "phone" ? "tel" : type === "email" ? "email" : "off"} placeholder={type === "phone" ? "0241234567" : type === "email" ? "you@example.com" : type === "identifier" ? "Enter the ID given to your organizer" : "Code provided by your organizer"} className={inputClass} />
    {type === "identifier" && <><label htmlFor={`voter-secret-${eventId}`} className="block text-sm font-semibold">Private code from your organizer</label><input id={`voter-secret-${eventId}`} name="claimCode" required maxLength={32} autoComplete="off" readOnly={verified || pending} className={inputClass} /></>}
    {!sent && <p className="text-sm text-stone-600">{contact ? restricted ? "We’ll check the approved list and send a verification code to these details." : `We’ll send a verification code to your ${type === "phone" ? "phone" : "email"}.` : "Enter the private voting details provided by your organizer. No account registration is needed."}</p>}
    {sent && <><p className="text-sm text-stone-600">Enter the code sent to {identifier}.</p><label htmlFor={`voter-otp-${eventId}`} className="block text-sm font-semibold">Verification code</label><input id={`voter-otp-${eventId}`} name="otp" required pattern="[0-9]{6,8}" minLength={6} maxLength={8} inputMode="numeric" autoComplete="one-time-code" readOnly={verified || pending} className={inputClass} /><div className="flex flex-wrap gap-4"><button type="button" disabled={pending || verified} onClick={onChangeDetails} className="text-sm font-semibold text-emerald-800 disabled:text-stone-500">Change {type === "phone" ? "phone number" : "email address"}</button><button type="button" disabled={pending || verified || wait > 0} onClick={onChangeDetails} className="text-sm font-semibold text-emerald-800 disabled:text-stone-500">{wait > 0 ? `Request another code in ${wait}s` : "Request a new code"}</button></div></>}
    {!sent && !verified && <AuthCaptcha state={state} onVerified={setCaptchaReady} />}
    {!verified && <button type="submit" disabled={pending || (!sent && !captchaReady)} className="w-full rounded-xl bg-stone-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">{pending ? "Please wait…" : sent ? "Verify and continue to voting" : contact ? "Send verification code" : "Verify and continue to voting"}</button>}
    {state?.message && <p role="status" className={`text-sm ${verified ? "text-emerald-800" : "text-stone-700"}`}>{state.message}</p>}
  </form>;
}
