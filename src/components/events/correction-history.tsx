import { createClient } from "@/lib/supabase/server";
import { ghanaDate } from "@/lib/events/presentation";
export async function CorrectionRequestHistory({eventId}:{eventId:string}) {
  const db=await createClient();const {data,error}=await db.from("event_correction_requests").select("id,kind,status,reason,review_note,created_at").eq("event_id",eventId).order("created_at",{ascending:false}).limit(50);
  if(error)return <p role="status">Correction history is temporarily unavailable.</p>;
  if(!data?.length)return null;
  return <section className="space-y-4 rounded-2xl border border-stone-200 bg-white p-5 sm:p-6"><h2 className="text-lg font-semibold text-stone-900">Correction requests</h2>{data.map(r=><article className="space-y-2 border-t border-stone-100 pt-4 text-sm text-stone-700" key={r.id}><strong>{r.kind} · {r.status}</strong><p>{r.reason}</p>{r.review_note&&<p>Review: {r.review_note}</p>}<small>{ghanaDate(r.created_at)}</small></article>)}</section>;
}
