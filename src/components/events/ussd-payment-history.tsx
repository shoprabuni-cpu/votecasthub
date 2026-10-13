import { createClient } from "@/lib/supabase/server";
export async function UssdPaymentHistory({eventId}:{eventId:string}) {
 const db=await createClient();const {data,error}=await db.from("ussd_access_payments").select("reference,amount_minor,status,refunded_amount_minor,created_at").eq("event_id",eventId).order("created_at",{ascending:false}).limit(10);
 if(error)return <p role="alert" className="mt-3 text-sm text-red-800">USSD payment history could not load. Refresh to try again.</p>;
 if(!data?.length)return null;
 return <section className="mt-4 rounded-2xl border border-stone-200 bg-white p-5"><h3 className="text-sm font-semibold">USSD access payments</h3><ul className="mt-3 space-y-3">{data.map(row=><li key={row.reference} className="rounded-xl bg-stone-50 p-3 text-sm"><div className="flex flex-wrap justify-between gap-2"><strong>GH₵{(row.amount_minor/100).toFixed(2)}</strong><span className="capitalize">{row.status}</span></div><p className="mt-1 break-all font-mono text-xs text-stone-500">{row.reference}</p><p className="mt-1 text-xs text-stone-500">{new Date(row.created_at).toLocaleDateString("en-GH",{timeZone:"Africa/Accra"})}{row.refunded_amount_minor>0?` · Refunded GH₵${(row.refunded_amount_minor/100).toFixed(2)}`:""}</p></li>)}</ul><p className="mt-3 text-xs text-stone-500">These access charges are separate from voter payments and SMS credits.</p></section>;
}
