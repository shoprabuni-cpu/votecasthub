import { allow } from "@/lib/payments/gateway";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { settlementProviders, resolveSettlement } from "@/lib/payments/settlement";
export const runtime = "nodejs";
const schema = z.object({ organizationId:z.string().uuid(), type:z.enum(["ghipss","mobile_money"]), bankCode:z.string().max(20).optional(), accountNumber:z.string().max(24).optional() });
export async function POST(request:Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({error:"Invalid account details."},{status:400});
  const p = parsed.data;
  const supabase = await createClient();
  const {data:{user}} = await supabase.auth.getUser();
  if (!user) return NextResponse.json({error:"Sign in required."},{status:401});
  const {data:member} = await supabase.from("organization_members").select("role").eq("organization_id",p.organizationId).eq("user_id",user.id).maybeSingle();
  if (!member || !["owner","admin"].includes(member.role)) return NextResponse.json({error:"Only owners and admins can manage payment accounts."},{status:403});
  try {
    if(!await allow(`account-lookup:${user.id}`,15,60))return NextResponse.json({error:"Too many lookups. Wait a minute before retrying."},{status:429});
    const data = p.bankCode && p.accountNumber ? await resolveSettlement(p.type,p.bankCode,p.accountNumber) : {providers:await settlementProviders(p.type)};
    return NextResponse.json(data,{headers:{"Cache-Control":"no-store"}});
  } catch(e) { return NextResponse.json({error:e instanceof Error ? e.message : "Account lookup unavailable."},{status:422,headers:{"Cache-Control":"no-store"}}); }
}

