import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { paymentAdmin } from "@/lib/payments/admin";
import { handleArkeselUssd } from "./arkesel";
import { ussdConfiguration, ussdSimulatorMode } from "./provider";

const input = z.object({ sessionID: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/), userID: z.string().max(128), newSession: z.boolean(), msisdn: z.string().regex(/^\+?233\d{9}$/), userData: z.string().max(254), network: z.string().min(1).max(64) });
export async function handleNativeArkesel(request: Request) {
  const config = ussdConfiguration();
  if (!config.success || config.data.USSD_SESSION_PROTOCOL !== "arkesel-json") return Response.json({ error: "Service unavailable" }, { status: 503 });
  const supplied = new URL(request.url).searchParams.get("key") ?? "", expected = config.data.ARKESEL_USSD_CALLBACK_TOKEN!;
  if (Buffer.byteLength(supplied) !== Buffer.byteLength(expected) || !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const raw = await request.text();if(raw.length>4096)return Response.json({error:"Request too large"},{status:413});
  let body;try { body = JSON.parse(raw); } catch { return Response.json({error:"Invalid JSON"},{status:400}); }
  const parsed = input.safeParse(body);if(!parsed.success)return Response.json({error:"Invalid callback"},{status:400});
  const p = parsed.data;
  if(!ussdSimulatorMode() && p.userID!==config.data.ARKESEL_USSD_USER_ID)return Response.json({error:"Invalid subscription"},{status:403});
  const reply = (message: string, continueSession = false) => ({sessionID:p.sessionID,userID:p.userID,msisdn:p.msisdn,message,continueSession});
  if(p.newSession && p.userData!==config.data.ARKESEL_USSD_SERVICE_CODE)return Response.json(reply("Invalid dialing code."));
  const hash = createHmac("sha256",config.data.ARKESEL_USSD_SHARED_SECRET).update(`ussd:${p.msisdn.replace(/^\+/,"")}`).digest("hex");
  const db = paymentAdmin();
  try {
    const {data:existing}=await db.from("ussd_sessions").select("phone_hash,charge_status,awaiting_email").eq("session_id",p.sessionID).maybeSingle();
    const emailInput = !p.newSession && existing?.phone_hash===hash && existing.awaiting_email && p.userData!=="0" ? p.userData : undefined;
    if(emailInput&&!z.email().max(254).safeParse(emailInput).success)return Response.json(reply("Enter a valid email for the payment receipt.\n0. Exit",true));
    const chargeInput = !p.newSession && existing?.phone_hash===hash && existing.charge_status ? p.userData : undefined;
    // Payment OTPs are forwarded in memory, never appended to persisted navigation.
    const {data:state,error}=await db.rpc("begin_native_ussd",{p_session:p.sessionID,p_hash:hash,p_user:p.userID || "unlinked-simulator",p_network:p.network,p_new:p.newSession,p_input:chargeInput||emailInput?"9":p.userData});
    if(error)return Response.json(reply("Session unavailable. Please dial again."));
    if(state.reply)return Response.json(state.reply,{headers:{"cache-control":"no-store"}});
    if(state.busy)return Response.json({error:"Session busy. Retry this callback."},{status:503});
    // Translate the documented JSON callback into the internal cumulative menu protocol.
    const form = new URLSearchParams({sessionId:p.sessionID,serviceCode:config.data.ARKESEL_USSD_SERVICE_CODE,phoneNumber:p.msisdn,text:emailInput?state.path.split("*").slice(0,-1).join("*"):state.path});
    if(emailInput)form.set("email",emailInput);
    if(chargeInput)form.set("chargeInput",chargeInput);
    const timestamp=String(Math.floor(Date.now()/1000)),signed=form.toString();
    const response=await handleArkeselUssd(new Request("https://internal.invalid/ussd",{method:"POST",body:signed,headers:{"x-vch-timestamp":timestamp,"x-vch-signature":createHmac("sha256",config.data.ARKESEL_USSD_SHARED_SECRET).update(`${timestamp}.${signed}`).digest("hex")}}));
    const text=await response.text(),result=reply(text.replace(/^(CON|END) /,""),text.startsWith("CON "));
    const {error:finish}=await db.rpc("finish_native_ussd",{p_session:p.sessionID,p_hash:hash,p_lease:state.lease,p_reply:result,p_failed:!response.ok,p_restore_path:Boolean(emailInput)});
    if(finish)return Response.json({error:"Retry callback"},{status:503});
    return Response.json(result,{status:response.ok||response.status===422?200:503,headers:{"cache-control":"no-store"}});
  } catch { return Response.json({error:"Service unavailable"},{status:503}); }
}
