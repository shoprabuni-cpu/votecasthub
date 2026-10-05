import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/auth/require-platform-admin";
export async function POST(request:Request){const {supabase}=await requirePlatformAdmin();const body=await request.json().catch(()=>null);if(!body||typeof body.id!=="string")return NextResponse.json({error:"Invalid request"},{status:400});const {error}=await supabase.rpc("admin_approve_event",{p_event_id:body.id,p_note:"Approved in platform review"});if(error)return NextResponse.json({error:"Unable to approve event"},{status:400});return NextResponse.json({ok:true});}
