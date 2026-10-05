import { randomBytes } from "node:crypto";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { paymentAdmin } from "@/lib/payments/admin";
import { packageSchema,smsPackages } from "@/lib/payments/paystack";
import { allow,siteUrl } from "@/lib/payments/gateway";
import { reserveCheckout,initializeCheckout } from "@/lib/payments/checkout";
export const runtime="nodejs";
const schema=z.object({organizationId:z.string().uuid(),requestKey:z.string().uuid(),credits:packageSchema});
export async function POST(request:Request){
 try{
  const parsed=schema.safeParse(await request.json());if(!parsed.success)return Response.json({error:"Invalid package."},{status:400});
  const p=parsed.data;const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();
  if(!user?.email)return Response.json({error:"Sign in required."},{status:401});
  const {data:member}=await supabase.from("organization_members").select("role").eq("organization_id",p.organizationId).eq("user_id",user.id).maybeSingle();
  if(!member||!["owner","admin"].includes(member.role))return Response.json({error:"Organization access denied."},{status:403});
  if(!await allow(`sms-purchase:${user.id}`,10,600))return Response.json({error:"Too many requests. Try again shortly."},{status:429});
  const origin=siteUrl();const selected=smsPackages[p.credits];
  const session=await reserveCheckout(p.requestKey,{...p,userId:user.id},`VCH-SMS-${randomBytes(16).toString("hex").toUpperCase()}`);
  if(!session.fresh)return session.url?Response.json({url:session.url}):Response.json({error:"This purchase is being confirmed. Check your credits before starting another."},{status:409});
  const {error}=await paymentAdmin().from("sms_credit_purchases").insert({organization_id:p.organizationId,reference:session.reference,credits:selected.credits,amount_minor:selected.amountMinor});if(error)throw error;
  const url=await initializeCheckout(session.reference,{email:user.email,amount:selected.amountMinor,currency:"GHS",callback_url:`${origin}/payments/complete`,metadata:{kind:"sms_credits"}});
  return Response.json({url});
 }catch(error){const detail=error instanceof Error?error.message:"Unknown payment error";console.error("sms_checkout_failed",error instanceof Error?{message:error.message,stack:error.stack}:error);return Response.json({error:"Payment service unavailable.",detail},{status:503});}
}
