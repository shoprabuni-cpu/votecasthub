import { NextResponse } from "next/server";
import { requireVerifiedUser } from "@/lib/auth/require-user";
export async function POST(request:Request){const {supabase,userId}=await requireVerifiedUser();const body=await request.json().catch(()=>null);if(!body||typeof body.id!=="string")return NextResponse.json({error:"Invalid request"},{status:400});const {error}=await supabase.from("notifications").update({read_at:new Date().toISOString()}).eq("id",body.id).eq("user_id",userId);if(error)return NextResponse.json({error:"Unable to update"},{status:400});return NextResponse.json({ok:true});}
