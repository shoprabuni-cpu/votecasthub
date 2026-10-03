"use client";
import { useRef, useState } from "react";

export function PaidVoteForm({ eventId, categoryId, nomineeId, nomineeName, unitPriceMinor, defaultEmail }: { eventId:string; categoryId:string; nomineeId:string; nomineeName:string; unitPriceMinor:number; defaultEmail?:string|null }) {
  const attempt=useRef<{details:string;key:string}|null>(null);
  const [quantity,setQuantity]=useState(1); const [email,setEmail]=useState(defaultEmail ?? ""); const [busy,setBusy]=useState(false); const [error,setError]=useState("");
  async function submit(e: React.FormEvent) { e.preventDefault(); setBusy(true); setError(""); try { const details=JSON.stringify({eventId,categoryId,nomineeId,quantity,email}); if(attempt.current?.details!==details)attempt.current={details,key:crypto.randomUUID()}; const r=await fetch("/api/payments/paystack/vote",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({eventId,categoryId,nomineeId,quantity,email,requestKey:attempt.current.key})}); const d=await r.json(); if(!r.ok) throw new Error(d.error||"Unable to start payment"); window.location.assign(d.authorization_url); } catch (err) { setError(err instanceof Error?err.message:"Unable to start payment"); setBusy(false); } }
  return <form className="paid-vote-form" onSubmit={submit}><label>Votes<input type="number" min={1} max={10000} value={quantity} onChange={e=>setQuantity(Math.max(1,Math.min(10000,Number(e.target.value)||1)))} /></label><label>Email for receipt<input type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" /></label><button className="button button-primary" disabled={busy}>{busy?"Opening Paystack…":`Pay GHS ${((unitPriceMinor*quantity)/100).toFixed(2)} for ${nomineeName}`}</button>{error&&<p className="form-error" role="alert">{error}</p>}</form>;
}

