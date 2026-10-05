import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/auth/require-platform-admin";
export async function POST(request:Request){const {supabase}=await requirePlatformAdmin();const body=await request.json().catch(()=>null);if(!body||typeof body.id!=="string"||typeof body.reason!=="string")return NextResponse.json({error:"A reason is required"},{status:400});const {error}=await supabase.rpc("admin_reject_event",{p_event_id:body.id,p_reason:body.reason});if(error)return NextResponse.json({error:error.message},{status:400});return NextResponse.json({ok:true});}
