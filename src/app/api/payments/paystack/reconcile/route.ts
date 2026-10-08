import { timingSafeEqual } from "node:crypto";
import { paymentAdmin } from "@/lib/payments/admin";
import { paystack } from "@/lib/payments/gateway";
import { processPaymentJob } from "@/lib/payments/reconcile";
import { cleanupEventImages } from "@/lib/events/image-cleanup";
import { processAdminDeletions } from "@/lib/admin/process-deletions";
export const runtime="nodejs";
export const maxDuration=60;
export async function GET(request:Request){
  const secret=process.env.CRON_SECRET;const provided=Buffer.from(request.headers.get("authorization")||"");const expected=Buffer.from(`Bearer ${secret}`);
  if(!secret||provided.length!==expected.length||!timingSafeEqual(provided,expected))return new Response("Unauthorized",{status:401});
  const started=Date.now();const db=paymentAdmin();let completed=0,failed=0;
  let deletionCompleted=0,deletionFailed=0;
  try{
    try { const purges=await processAdminDeletions();deletionCompleted=purges.completed;deletionFailed=purges.failed; }
    catch { deletionFailed++;console.error("admin_deletion_processing_failed"); }
    await cleanupEventImages().catch(() => { deletionFailed++;console.error("event_image_cleanup_pending"); });
    // A persisted pagination cursor eventually scans every refund, including updates to older refunds.
    const {data:cursor}=await db.from("payment_operations").select("cursor_page").eq("name","refund-scan").maybeSingle();
    const page=cursor?.cursor_page||1;
    const refunds=await paystack<Array<{id:number;status:string}>>(`/refund?perPage=50&page=${page}`);
    const jobs=refunds.filter(r=>r.status==="processed").map(r=>({id:`refund.processed:${r.id}`,kind:"refund.processed",resource:String(r.id)}));
    if(jobs.length){const {error}=await db.from("payment_jobs").upsert(jobs,{onConflict:"id",ignoreDuplicates:true});if(error)throw error;}
    const {error:cursorError}=await db.from("payment_operations").upsert({name:"refund-scan",cursor_page:refunds.length<50?1:page+1,last_success_at:new Date().toISOString()});if(cursorError)throw cursorError;
    const {data:pending,error}=await db.from("payment_jobs").select("id,kind,resource,attempts").is("processed_at",null).order("last_attempt_at",{ascending:true,nullsFirst:true}).limit(20);if(error)throw error;
    for(const job of pending||[]){
      if(Date.now()-started>35000)break;
      await db.from("payment_jobs").update({attempts:job.attempts+1,last_attempt_at:new Date().toISOString()}).eq("id",job.id);
      try{if(!await processPaymentJob(job.kind,job.resource))continue;const {error:e}=await db.from("payment_jobs").update({processed_at:new Date().toISOString()}).eq("id",job.id);if(e)throw e;completed++;}catch{failed++;}
    }
    const {error:queued}=await db.rpc("enqueue_pending_payments");if(queued)throw queued;
    await db.from("payment_rate_limits").delete().lt("expires_at",new Date(Date.now()-86400000).toISOString());
    if(failed)console.error("payment_reconciliation_jobs_failed",{failed});
    const {error:e}=await db.from("payment_operations").upsert({name:"reconciliation",last_success_at:new Date().toISOString()});if(e)throw e;
    return Response.json({completed,failed,deletionCompleted,deletionFailed},{status:failed||deletionFailed?503:200});
  }catch{console.error("payment_reconciliation_failed");return Response.json({error:"Reconciliation failed"},{status:503});}
}


