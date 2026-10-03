import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { paymentAdmin } from "@/lib/payments/admin";
import { processPaymentJob } from "@/lib/payments/reconcile";
export const runtime="nodejs";
export const maxDuration=60;
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
  try{event=z.object({event:z.string(),data:z.object({id:z.number().int().positive().safe().optional(),reference:z.string().max(100).optional()})}).parse(JSON.parse(raw));}catch{return new Response("Invalid event",{status:400});}
  if(!["charge.success","refund.processed","charge.dispute.resolve"].includes(event.event))return Response.json({received:true});
  const resource=event.event==="charge.success"?event.data.reference:event.data.id?.toString();
  if(!resource)return new Response("Missing event identity",{status:400});
  const id=`${event.event}:${resource}`;
  try{
    const db=paymentAdmin();
    const {error}=await db.from("payment_jobs").upsert({id,kind:event.event,resource},{onConflict:"id",ignoreDuplicates:true});if(error)throw error;
    const {data:job,error:read}=await db.from("payment_jobs").select("processed_at").eq("id",id).single();if(read)throw read;
    if(!job.processed_at){if(!await processPaymentJob(event.event,resource))throw new Error("Provider confirmation pending");const {error:e}=await db.from("payment_jobs").update({processed_at:new Date().toISOString()}).eq("id",id);if(e)throw e;}
    return Response.json({received:true});
  }catch{console.error("payment_webhook_processing_failed",{event:event.event});return new Response("Retry processing",{status:503});}
}

