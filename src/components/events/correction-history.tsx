import { createClient } from "@/lib/supabase/server";
import { ghanaDate } from "@/lib/events/presentation";
export async function CorrectionRequestHistory({eventId}:{eventId:string}) {
  const db=await createClient();const {data,error}=await db.from("event_correction_requests").select("id,kind,status,reason,review_note,created_at").eq("event_id",eventId).order("created_at",{ascending:false}).limit(50);
  if(error)return <p role="status">Correction history is temporarily unavailable.</p>;
  if(!data?.length)return null;
  return <section className="event-editor-panel"><h2>Correction requests</h2>{data.map(r=><article className="correction-history-item" key={r.id}><strong>{r.kind} · {r.status}</strong><p>{r.reason}</p>{r.review_note&&<p>Review: {r.review_note}</p>}<small>{ghanaDate(r.created_at)}</small></article>)}</section>;
}
