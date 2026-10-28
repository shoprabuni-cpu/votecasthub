import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { paymentAdmin } from "@/lib/payments/admin";
import { processPaymentJob } from "@/lib/payments/reconcile";
export const runtime="nodejs";
export const maxDuration=60;
const rabuniWebhookUrl=process.env.RABUNI_PAYSTACK_WEBHOOK_URL||"https://rabuni.shop/api/webhooks/paystack";
export async function POST(request:Request){
  const secret=process.env.PAYSTACK_SECRET_KEY;
  const signature=request.headers.get("x-paystack-signature")||"";
  if(!secret||!/^[a-f0-9]{128}$/i.test(signature))return new Response("Unauthorized",{status:401});
  let raw:string;
  try{
    const reader=request.body?.getReader();if(!reader)throw new Error();
    const chunks:Uint8Array[]=[];let size=0;
    try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>262144){await reader.cancel();throw new Error();}chunks.push(value);}}finally{reader.releaseLock();}
    raw=Buffer.concat(chunks).toString("utf8");
  }catch{return new Response("Invalid body",{status:400});}
  if(!timingSafeEqual(Buffer.from(signature,"hex"),createHmac("sha512",secret).update(raw).digest()))return new Response("Unauthorized",{status:401});
  let event;
  try{event=z.object({event:z.string(),data:z.object({id:z.number().int().positive().safe().optional(),reference:z.string().max(100).optional(),metadata:z.object({type:z.string().optional()}).passthrough().nullish()}).passthrough()}).passthrough().parse(JSON.parse(raw));}catch{return new Response("Invalid event",{status:400});}
  if(event.event==="charge.success"&&event.data.metadata?.type==="store_order"){
    try{
      const target=new URL(rabuniWebhookUrl);
      if(target.protocol!=="https:")throw new Error("Rabuni webhook URL must use HTTPS");
      const response=await fetch(target,{method:"POST",headers:{"content-type":"application/json","x-paystack-signature":signature},body:raw,cache:"no-store",signal:AbortSignal.timeout(15000)});
      const result=await response.json().catch(()=>null) as {status?:string}|null;
      if(!response.ok||!result||!(["order_paid","already_processed"].includes(result.status||"")))throw new Error(`Rabuni webhook returned ${response.status} with ${result?.status||"an unexpected response"}`);
      return Response.json({received:true,rabuni_status:result.status});
    }catch(error){
      console.error("rabuni_order_webhook_forward_failed",{reference:event.data.reference,error:error instanceof Error?error.message:"Unknown forwarding error"});
      return new Response("Rabuni order processing failed",{status:503});
    }
  }
  if(!["charge.success","refund.processed","charge.dispute.resolve"].includes(event.event))return Response.json({received:true});
  const resource=event.event==="charge.success"?event.data.reference:event.data.id?.toString();
  if(!resource)return new Response("Missing event identity",{status:400});
  const id=`${event.event}:${resource}`;
  try{
    const db=paymentAdmin();
    const {error}=await db.from("payment_jobs").upsert({id,kind:event.event,resource},{onConflict:"id",ignoreDuplicates:true});if(error)throw error;
    const {data:job,error:read}=await db.from("payment_jobs").select("processed_at").eq("id",id).single();if(read)throw read;
    if(!job.processed_at){if(!await processPaymentJob(event.event,resource))throw new Error("Provider confirmation pending");const {error:e}=await db.from("payment_jobs").update({processed_at:new Date().toISOString()}).eq("id",id);if(e)throw e;}else if(event.event==="charge.success"){
      const {data:attempt}=await db.from("payment_attempts").select("organization_id,event_id").eq("provider_reference",resource).maybeSingle();
      if(attempt) await db.from("moderation_flags").insert({organization_id:attempt.organization_id,event_id:attempt.event_id,kind:"duplicate_webhook",severity:2,details:"Paystack delivered a duplicate charge.success webhook for the same payment reference."});
    }
    return Response.json({received:true});
  }catch{console.error("payment_webhook_processing_failed",{event:event.event});return new Response("Retry processing",{status:503});}
}

