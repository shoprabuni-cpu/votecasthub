import { createClient } from "@/lib/supabase/server";
import { ussdConfiguration, ussdPaymentReady } from "@/lib/ussd/provider";
import { Icon } from "@/components/icon";
export async function loadUssdInstructions(eventId:string) {
 if(!ussdConfiguration().success)return null;
 const db=await createClient();
 if(!ussdPaymentReady()){const {data:event}=await db.from("events").select("voting_mode").eq("id",eventId).maybeSingle();if(event?.voting_mode!=="free")return null;}
 const {data,error}=await db.rpc("get_public_ussd",{p_event_id:eventId});const info=data?.[0];
 if(error||!info)return null;
 return info as {event_code:number;dial_code:string;network_notice:string};
}
export async function UssdInstructions({eventId}:{eventId:string}) {
 const info=await loadUssdInstructions(eventId);if(!info)return null;
 return <section className="my-5 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5"><div className="flex items-center gap-2 text-emerald-900"><Icon name="phone"/><h2 className="text-lg font-semibold">Vote without internet</h2></div><p className="mt-3 text-sm text-stone-700">Dial <strong className="text-lg text-emerald-950">{info.dial_code}</strong>, choose Vote, then enter event code <strong>{info.event_code}</strong>.</p><p className="mt-2 text-sm text-stone-600">Choose your category and nominee, enter your votes, and confirm. Paid votes count after Mobile Money payment is confirmed.</p><p className="mt-3 text-sm font-medium text-stone-700">{info.network_notice}</p></section>;
}
