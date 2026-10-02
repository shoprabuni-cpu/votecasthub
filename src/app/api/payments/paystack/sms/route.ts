import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { packageSchema, paystackSecret, smsPackages } from "@/lib/payments/paystack";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const body = await request.json(); const pkg = packageSchema.safeParse(body?.credits); if (!pkg.success) return NextResponse.json({ error:"Invalid package" },{status:400});
    const supabase = await createClient(); const { data:{ user } } = await supabase.auth.getUser(); if (!user?.email) return NextResponse.json({error:"Sign in required"},{status:401});
    const organizationId = typeof body.organizationId === "string" ? body.organizationId : ""; const { data: member } = await supabase.from("organization_members").select("role").eq("organization_id",organizationId).eq("user_id",user.id).maybeSingle(); if (!member || !["owner","admin"].includes(member.role)) return NextResponse.json({error:"Organization access denied"},{status:403});
    const selected = smsPackages[pkg.data]; const reference = `VCH-SMS-${randomBytes(8).toString("hex").toUpperCase()}`;
    const { error } = await supabase.from("sms_credit_purchases").insert({organization_id:organizationId,reference,credits:selected.credits,amount_minor:selected.amountMinor}); if(error) throw error;
    const response = await fetch("https://api.paystack.co/transaction/initialize",{method:"POST",headers:{Authorization:`Bearer ${paystackSecret()}`,"Content-Type":"application/json"},body:JSON.stringify({email:user.email,amount:selected.amountMinor,currency:"GHS",reference,callback_url:`${process.env.NEXT_PUBLIC_SITE_URL}/organizer/${organizationId}/credits`,metadata:{organization_id:organizationId,credits:selected.credits}})});
    const result = await response.json(); if(!response.ok || !result.status) return NextResponse.json({error:"Unable to start payment"},{status:502}); return NextResponse.json({url:result.data.authorization_url});
  } catch { return NextResponse.json({error:"Payment service unavailable"},{status:503}); }
}
