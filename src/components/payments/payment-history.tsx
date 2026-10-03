import { createClient } from "@/lib/supabase/server";
import { paystack } from "@/lib/payments/gateway";
const money=(n:number)=>new Intl.NumberFormat("en-GH",{style:"currency",currency:"GHS"}).format(Number(n)/100);
const date=(s:string)=>new Intl.DateTimeFormat("en-GH",{dateStyle:"medium",timeZone:"Africa/Accra"}).format(new Date(s));
export async function PaymentHistory({organizationId,page}:{organizationId:string;page:number}){
 const db=await createClient();
 const {data:rows,error}=await db.rpc("get_payment_history",{p_org:organizationId,p_offset:(page-1)*25});
 return <section className="earnings-history"><h2>Vote payments</h2><p>Gross amounts and refunds are shown separately. Paystack fees are included in the platform share.</p>{error?<p role="alert">Payment history could not be loaded.</p>:rows?.length?<div className="payment-table-scroll"><table className="payment-table"><thead><tr>{["Date / reference","Status","Gross","Refunded","Platform share","Paystack cost (included)","Your earnings"].map(t=><th key={t}>{t}</th>)}</tr></thead><tbody>{rows.map((r:{reference:string;created_at:string;status:string;gross:number;refunded:number;platform:number;provider:number;net:number})=><tr key={r.reference}><td>{date(r.created_at)}<small>{r.reference}</small></td><td>{r.status}</td><td>{money(r.gross)}</td><td>{money(r.refunded)}</td><td>{money(r.platform)}</td><td>{money(r.provider)}</td><td>{money(r.net)}</td></tr>)}</tbody></table></div>:<p>No payments on this page yet.</p>}</section>;
}
export async function SettlementHistory({organizationId,page}:{organizationId:string;page:number}){
 const db=await createClient();const {data:account,error}=await db.from("organization_paystack_accounts").select("subaccount_code").eq("organization_id",organizationId).maybeSingle();
 if(error)return <section className="earnings-history"><h2>Paystack settlements</h2><p>Account details unavailable.</p></section>;
 if(!account)return <section className="earnings-history"><h2>Paystack settlements</h2><p>Connect a payment account to view settlements.</p></section>;
 try{
  const a=await paystack<{id:number;subaccount_code:string}>(`/subaccount/${encodeURIComponent(account.subaccount_code)}`);
  if(!Number.isSafeInteger(a.id)||a.subaccount_code!==account.subaccount_code)throw new Error();
  const rows=await paystack<Array<{id:number;status:string;currency:string;effective_amount:number;settlement_date:string;createdAt:string}>>(`/settlement?subaccount=${a.id}&perPage=25&page=${page}`);
  return <section className="earnings-history"><h2>Paystack settlements</h2><p>Status reported directly by Paystack for your linked account.</p>{rows.length?<div className="payment-table-scroll"><table className="payment-table"><thead><tr><th>Settlement</th><th>Date</th><th>Status</th><th>Amount</th></tr></thead><tbody>{rows.filter(r=>r.currency==="GHS").map(r=><tr key={r.id}><td>#{r.id}</td><td>{r.settlement_date||r.createdAt?date(r.settlement_date||r.createdAt):"Pending"}</td><td>{r.status}</td><td>{money(r.effective_amount)}</td></tr>)}</tbody></table></div>:<p>No settlements on this page. Confirmed payments may still be awaiting settlement.</p>}</section>;
 }catch{return <section className="earnings-history"><h2>Paystack settlements</h2><p role="status">Paystack settlement history is temporarily unavailable. This does not mean your balance is zero.</p></section>;}
}
