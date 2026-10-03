"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
export function RefreshAccount({organizationId}:{organizationId:string}) {
  const router=useRouter();const [busy,setBusy]=useState(false);const [message,setMessage]=useState("");
  async function refresh(){setBusy(true);setMessage("");try{const r=await fetch("/api/payments/paystack/subaccount",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({organizationId})});const d=await r.json();if(!r.ok)throw new Error(d.error);setMessage(`Account status: ${d.status}`);router.refresh();}catch(e){setMessage(e instanceof Error?e.message:"Refresh failed.");}finally{setBusy(false);}}
  return <div><button className="earnings-account-link" type="button" disabled={busy} onClick={refresh}>{busy?"Checking Paystack…":"Refresh verification"}</button>{message&&<p role="status">{message}</p>}</div>;
}
