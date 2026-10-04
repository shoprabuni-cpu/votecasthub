"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
export function PaystackSubaccountForm({ organizationId, mode = "create", businessName = "", onSaved }: { organizationId:string; mode?: "create" | "update"; businessName?: string; onSaved?: () => void }) {
  const router=useRouter();
  const [type,setType]=useState("ghipss"), [bankCode,setBankCode]=useState(""), [number,setNumber]=useState("");
  const [providers,setProviders]=useState<Array<{name:string;code:string}>>([]);
  const [verified,setVerified]=useState<{key:string;name:string}|null>(null);
  const [lookup,setLookup]=useState(""), [message,setMessage]=useState("");
  const [busy,setBusy]=useState(false), [confirmed,setConfirmed]=useState(false);
  const key=JSON.stringify([organizationId,type,bankCode,number]);
  const name=verified?.key===key?verified.name:"";
  useEffect(()=>{
    const controller=new AbortController();
    fetch("/api/payments/paystack/account-lookup",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({organizationId,type}),signal:controller.signal})
      .then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.error);return d;})
      .then(d=>{if(!controller.signal.aborted)setProviders(d.providers);}).catch(e=>{if(!controller.signal.aborted)setMessage(e.message||"Could not load providers.");});
    return ()=>controller.abort();
  },[organizationId,type]);
  useEffect(()=>{
    const controller=new AbortController();
    const normalized=number.replace(/[\s()-]/g,"").replace(/^\+?233/,"0");
    if(!bankCode||!(type==="mobile_money"?/^0\d{9}$/.test(normalized):/^\d{6,20}$/.test(number)))return;
    const timer=setTimeout(async()=>{setLookup("Checking account name…");try{
      const r=await fetch("/api/payments/paystack/account-lookup",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({organizationId,type,bankCode,accountNumber:number}),signal:controller.signal});
      const d=await r.json();if(!r.ok)throw new Error(d.error);
      if(!controller.signal.aborted){setVerified({key,name:d.accountName});setLookup("");}
    }catch(e){if(!controller.signal.aborted)setLookup(e instanceof Error?e.message:"Lookup unavailable.");}},700);
    return ()=>{clearTimeout(timer);controller.abort();};
  },[organizationId,type,bankCode,number,key]);
  async function submit(e:React.FormEvent<HTMLFormElement>){
    e.preventDefault();if(!name||!confirmed||busy)return;
    setBusy(true);setMessage("");const form=new FormData(e.currentTarget);
    try{const r=await fetch("/api/payments/paystack/subaccount",{method:mode==="update"?"PUT":"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({organizationId,type,bankCode,accountNumber:number,confirmedAccountName:name,businessName:form.get("businessName"),contactName:form.get("contactName"),contactPhone:form.get("contactPhone")})});const d=await r.json();if(!r.ok)throw new Error(d.error);setMessage(d.status==="active"?"Payment account active.":"Account submitted. Paystack approval is pending.");onSaved?.();router.refresh();}catch(e){setMessage(e instanceof Error?e.message:"Unable to save payment account.");}finally{setBusy(false);}
  }
  return <form className="payment-account-form" onSubmit={submit}>
    <fieldset disabled={busy} className="settlement-fields"><legend>Where should your earnings go?</legend>
      <label className="field">Currency<select value="GHS" disabled><option value="GHS">GHS — Ghana cedi</option></select></label>
      <div className="settlement-options">{[{value:"ghipss",label:"Bank account"},{value:"mobile_money",label:"Mobile money"}].map(option=><label key={option.value} className={type===option.value?"is-selected":""}><input type="radio" name="settlementType" value={option.value} checked={type===option.value} onChange={()=>{setType(option.value);setProviders([]);setMessage("");setLookup("");setBankCode("");setNumber("");setVerified(null);setConfirmed(false);}}/>{option.label}</label>)}</div>
      <div className="form-grid">
        <label className="field field-wide">Name of subaccount<input name="businessName" defaultValue={businessName} required minLength={2} maxLength={160} placeholder="Business or organizer name"/></label>
        <label className="field">{type==="mobile_money"?"Mobile money network":"Bank name (for payouts)"}<select required value={bankCode} onChange={e=>{setBankCode(e.target.value);setLookup("");setVerified(null);setConfirmed(false);}}><option value="">{providers.length?"Choose a provider":"Loading providers…"}</option>{providers.map(p=><option key={p.code} value={p.code}>{p.name}</option>)}</select></label>
        <label className="field">{type==="mobile_money"?"Mobile money number":"Account number"}<input value={number} onChange={e=>{setNumber(e.target.value);setLookup("");setVerified(null);setConfirmed(false);}} required inputMode="numeric" maxLength={24} placeholder={type==="mobile_money"?"0241234567":"Enter account number"} aria-describedby="account-lookup-status"/></label>
        <div className="field-wide account-name-result" id="account-lookup-status" role="status" aria-live="polite">{name?<><small>REGISTERED ACCOUNT NAME</small><strong>{name}</strong><span>Name returned by Paystack. Confirm this is your intended settlement account.</span></>:lookup||"Select a provider and enter the number to check the registered name."}</div>
        {name&&<label className="field-wide account-name-confirm"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/> I confirm this is the account that should receive my earnings.</label>}
        <label className="field">Contact name<input name="contactName" required minLength={2} maxLength={120}/></label>
        <label className="field">Contact phone<input name="contactPhone" required type="tel" minLength={7} maxLength={24}/></label>
      </div>
    </fieldset>
    <div className="payment-account-note"><strong>Transaction split</strong><p>VotecastHub: 10% including Paystack fees · Your subaccount: 90%.</p><p>Account-name lookup is separate from Paystack’s settlement approval.</p></div>
    {message&&<p className="form-message" role="status">{message}</p>}
    <button className="primary-link" disabled={busy||!name||!confirmed}>{busy?"Saving…":mode==="update"?"Save payment account":"Create payment account"}</button>
  </form>;
}

