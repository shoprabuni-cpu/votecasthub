import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { paymentAdmin } from "@/lib/payments/admin";
import { allow } from "@/lib/payments/gateway";

const env=z.object({ARKESEL_USSD_API_KEY:z.string().min(1),ARKESEL_USSD_SHARED_SECRET:z.string().min(16),ARKESEL_USSD_SERVICE_CODE:z.string().min(1),ARKESEL_USSD_PAYMENT_URL:z.url().optional()});
const input=z.object({sessionId:z.string().min(1).max(128),serviceCode:z.string().max(64),phoneNumber:z.string().regex(/^\+?233\d{9}$/),text:z.string().max(1000).default("")});
type Session={session_id:string;phone_hash:string;event_id:string|null;category_id:string|null;nominee_id:string|null;quantity:number|null;mode:string;reference:string|null};
const phoneHash=(phone:string,secret:string)=>createHmac("sha256",secret).update(`ussd:${phone.replace(/^\+/g,"")}`).digest("hex");
function response(text:string,end=false){return `${end?"END":"CON"} ${text}`;}
async function requestUssdPayment(url:string,apiKey:string,payload:object){const r=await fetch(url,{method:"POST",headers:{"api-key":apiKey,"Content-Type":"application/json"},body:JSON.stringify(payload),cache:"no-store",signal:AbortSignal.timeout(1500)});const d=await r.json().catch(()=>null);if(!r.ok||d?.status===false)throw new Error("Payment request failed");return d;}
export async function handleArkeselUssd(request:Request){
 const config=env.safeParse(process.env);if(!config.success)return new Response("END Service unavailable",{status:503});
 const form=await request.formData().catch(()=>null);const parsed=input.safeParse(Object.fromEntries(form??[]));if(!parsed.success)return new Response("END Invalid request",{status:400});
 const p=parsed.data;const rawPath=p.text.split("*").filter(Boolean);const secret=config.data.ARKESEL_USSD_SHARED_SECRET;
 const signature=request.headers.get("x-arkesel-ussd-signature");if(signature){const expected=createHmac("sha256",secret).update(`${p.sessionId}.${p.text}`).digest("hex");if(signature.length!==expected.length||!timingSafeEqual(Buffer.from(signature),Buffer.from(expected)))return new Response("END Unauthorized",{status:401});}
 if(p.serviceCode!==config.data.ARKESEL_USSD_SERVICE_CODE)return new Response("END Invalid service code",{status:403});
 const db=paymentAdmin();const hash=phoneHash(p.phoneNumber,secret);if(!await allow(`ussd:${hash}`,30,600))return new Response("END Too many requests. Try again later.", {status:429});
 const existing=await db.from("ussd_sessions").select("*").eq("session_id",p.sessionId).gt("expires_at",new Date().toISOString()).maybeSingle();let s=existing.data as Session|null;
 if(!s){const created=await db.from("ussd_sessions").insert({session_id:p.sessionId,phone_hash:hash}).select("*").single();if(created.error)return new Response("END Service temporarily unavailable",{status:503});s=created.data as Session;}
 if(rawPath.length===0)return new Response(response("VotecastHub\n1. Vote\n2. Exit"));
 if(rawPath[0]==="2")return new Response(response("Thank you for using VotecastHub.",true));
 if(rawPath[0]!=="1")return new Response(response("Choose 1 to vote or 2 to exit."));
 if(rawPath.length===1)return new Response(response("Enter the event slug:"));
 const slug=rawPath[1];const {data:event}=await db.from("events").select("id,organization_id,name,voting_mode,unit_price_minor,status,starts_at,ends_at").eq("slug",slug).eq("status","published").maybeSingle();if(!event||Date.now()<Date.parse(event.starts_at)||Date.now()>=Date.parse(event.ends_at))return new Response(response("That event is not open." ,true));
 if(rawPath.length===2){const {data:categories}=await db.from("categories").select("id,name").eq("event_id",event.id).eq("is_active",true).order("display_order");if(!categories?.length)return new Response(response("No categories available.",true));await db.from("ussd_sessions").update({event_id:event.id,mode:"category"}).eq("session_id",p.sessionId);return new Response(response(`Choose a category:\n${categories.map((c,i)=>`${i+1}. ${c.name}`).join("\n")}`));}
 const {data:categories}=await db.from("categories").select("id,name").eq("event_id",event.id).eq("is_active",true).order("display_order");const category=categories?.[Number(rawPath[2])-1];if(!category)return new Response(response("Invalid category."));
 if(rawPath.length===3){const {data:nominees}=await db.from("nominees").select("id,name").eq("category_id",category.id).eq("is_active",true).order("display_order");if(!nominees?.length)return new Response(response("No nominees available.",true));await db.from("ussd_sessions").update({category_id:category.id,mode:"nominee"}).eq("session_id",p.sessionId);return new Response(response(`Choose a nominee:\n${nominees.map((n,i)=>`${i+1}. ${n.name}`).join("\n")}`));}
 const {data:nominees}=await db.from("nominees").select("id,name").eq("category_id",category.id).eq("is_active",true).order("display_order");const nominee=nominees?.[Number(rawPath[3])-1];if(!nominee)return new Response(response("Invalid nominee."));
 if(rawPath.length===4)return new Response(response(event.voting_mode==="free"?"Enter number of votes (1-10,000):":"Paid USSD checkout is being connected. Use web checkout for this event.",event.voting_mode!=="free"));
 const quantity=Number(rawPath[4]);if(!Number.isInteger(quantity)||quantity<1||quantity>10000)return new Response(response("Enter a valid quantity."));
 if(event.voting_mode!=="free"){
  if(!config.data.ARKESEL_USSD_PAYMENT_URL)return new Response(response("Paid checkout is unavailable. Please use the website.",true));
  const reference=`VCH-USSD-${p.sessionId.replace(/[^A-Za-z0-9]/g,"").slice(0,70)}`;const total=Number(event.unit_price_minor)*quantity;
  try{const {error:insert}=await db.from("payment_attempts").insert({idempotency_key:`ussd-${p.sessionId}`,event_id:event.id,organization_id:event.organization_id,category_id:category.id,nominee_id:nominee.id,quantity,unit_price_minor:event.unit_price_minor,total_amount_minor:total,currency:"GHS",provider:"arkesel_ussd",provider_reference:reference,status:"pending"});if(insert)throw insert;await requestUssdPayment(config.data.ARKESEL_USSD_PAYMENT_URL,config.data.ARKESEL_USSD_API_KEY,{sessionId:p.sessionId,phoneNumber:p.phoneNumber,eventSlug:slug,nomineeId:nominee.id,quantity,amount:total,currency:"GHS",reference});await db.from("ussd_sessions").update({event_id:event.id,category_id:category.id,nominee_id:nominee.id,quantity,mode:"payment_pending",reference}).eq("session_id",p.sessionId);return new Response(response("Payment prompt sent to your phone. Approve it to record your votes.",true));}catch{return new Response(response("We could not start the payment. Please try again.",true));}
 }
 const {error}=await db.rpc("cast_ussd_free_vote",{p_phone_hash:hash,p_event_slug:slug,p_nominee_id:nominee.id,p_quantity:quantity});if(error)return new Response(response(error.message.includes("open")?"Voting is closed.":"Could not record this vote.",true));await db.from("ussd_sessions").update({nominee_id:nominee.id,quantity,mode:"complete"}).eq("session_id",p.sessionId);return new Response(response(`${quantity} vote${quantity===1?"":"s"} recorded for ${nominee.name}.`,true));
}
