import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
export async function POST(request:Request){const body=await request.json().catch(()=>null);if(!body||typeof body.eventId!=="string"||typeof body.visitorHash!=="string")return NextResponse.json({ok:false},{status:400});const db=await createClient();await db.rpc("record_event_view",{p_event_id:body.eventId,p_visitor_hash:body.visitorHash});return NextResponse.json({ok:true},{headers:{"cache-control":"no-store"}})}
