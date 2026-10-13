import { z } from "zod";
import { authenticUssd, ussdConfiguration } from "@/lib/ussd/provider";
import { reconcileUssd } from "@/lib/ussd/reconcile";
export const runtime = "nodejs";
export async function POST(request: Request) {
 const config=ussdConfiguration(); if(!config.success)return new Response("Unavailable",{status:503});
 const raw=await request.text();if(raw.length>4096)return new Response("Too large",{status:413});
 if(!authenticUssd(request,raw,config.data.ARKESEL_USSD_SHARED_SECRET))return new Response("Unauthorized",{status:401});
 let body;try{body=JSON.parse(raw);}catch{return new Response("Bad request",{status:400});}
 const parsed=z.object({reference:z.string().regex(/^VCH-USSD-[a-f0-9]{32}$/)}).safeParse(body);
 if(!parsed.success)return new Response("Bad request",{status:400});
 try { if(!await reconcileUssd(parsed.data.reference))return new Response("Retry",{status:503});return Response.json({received:true}); } catch { return new Response("Retry",{status:503}); }
}
