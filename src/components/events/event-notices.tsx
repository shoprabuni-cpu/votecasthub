import { createClient } from "@/lib/supabase/server";
import { ghanaDate } from "@/lib/events/presentation";
export async function EventNotices({eventId}:{eventId:string}) {
  const db=await createClient();
  const {data,error}=await db.from("event_notices").select("id,kind,message,previous_deadline,new_deadline,created_at").eq("event_id",eventId).order("created_at",{ascending:false}).limit(100);
  if(error)return <p role="status" className="form-message">Event updates could not be loaded. Please refresh for the latest announcements.</p>;
  if(!data?.length)return null;
  return <section className="event-announcements"><h2>Updates from the organizer</h2>{data.map(n=><article key={n.id}><span className="eyebrow">{n.kind==="reopened"?"VOTING REOPENED":n.kind==="extension"?"DEADLINE EXTENDED":"EVENT UPDATE"}</span><p>{n.message}</p>{n.previous_deadline&&n.new_deadline&&<p><strong>Previous deadline:</strong> {ghanaDate(n.previous_deadline)}<br/><strong>New deadline:</strong> {ghanaDate(n.new_deadline)} · Ghana time</p>}<small>Published {ghanaDate(n.created_at)} · Ghana time</small></article>)}</section>;
}
