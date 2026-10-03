import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { paymentAdmin } from "@/lib/payments/admin";
import { paystackSecret } from "@/lib/payments/paystack";
import { resolveSettlement } from "@/lib/payments/settlement";
export const runtime = "nodejs";
const input=z.object({organizationId:z.string().uuid(),type:z.enum(["ghipss","mobile_money"]),confirmedAccountName:z.string().min(1).max(200),businessName:z.string().trim().min(2).max(160),bankCode:z.string().trim().min(2).max(12),accountNumber:z.string().min(6).max(24),contactName:z.string().trim().min(2).max(120),contactPhone:z.string().trim().min(7).max(24)});
export async function POST(request:Request) {
  try {
    const parsed=input.safeParse(await request.json());
    if(!parsed.success)return NextResponse.json({error:"Check the payment account details."},{status:400});
    const p=parsed.data;
    const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();
    if(!user?.email)return NextResponse.json({error:"Sign in required."},{status:401});
    const {data:member}=await supabase.from("organization_members").select("role").eq("organization_id",p.organizationId).eq("user_id",user.id).maybeSingle();
    if(!member||!["owner","admin"].includes(member.role))return NextResponse.json({error:"Organization access denied."},{status:403});
    const admin=paymentAdmin();
    const {data:existing,error}=await admin.from("organization_paystack_accounts").select("organization_id").eq("organization_id",p.organizationId).maybeSingle();
    if(error)throw error;
    if(existing)return NextResponse.json({error:"A payment account is already linked. View its details on the Payment account page."},{status:409});
    const resolved=await resolveSettlement(p.type,p.bankCode,p.accountNumber);
    if(resolved.accountName!==p.confirmedAccountName)return NextResponse.json({error:"Account name changed. Verify it again."},{status:409});
    const secret=paystackSecret();
    const {error:reserved}=await admin.from("paystack_account_requests").insert({organization_id:p.organizationId});
    if(reserved)return NextResponse.json({error:reserved.code==="23505"?"Account setup has already been submitted. Refresh your account page. If it remains unavailable, contact support to reconcile the existing Paystack request.":"Account setup is temporarily unavailable."},{status:409});
    // Retain the reservation after ambiguous network errors: retrying could create a duplicate remotely.
    const response=await fetch("https://api.paystack.co/subaccount",{method:"POST",headers:{Authorization:`Bearer ${secret}`,"Content-Type":"application/json"},signal:AbortSignal.timeout(20000),body:JSON.stringify({business_name:p.businessName,bank_code:p.bankCode,account_number:resolved.accountNumber,percentage_charge:10,currency:"GHS",primary_contact_name:p.contactName,primary_contact_email:user.email,primary_contact_phone:p.contactPhone,metadata:JSON.stringify({organization_id:p.organizationId})})});
    const result=await response.json();
    if(!response.ok||!result.status){
      if(response.status>=400&&response.status<500)await admin.from("paystack_account_requests").delete().eq("organization_id",p.organizationId);
      return NextResponse.json({error:"Paystack could not create this account. If setup was submitted, contact support before trying again."},{status:502});
    }
    const account=result.data;const active=account.is_verified===true&&account.active===true;
    const {error:saved}=await admin.from("organization_paystack_accounts").insert({organization_id:p.organizationId,subaccount_code:account.subaccount_code,business_name:p.businessName,settlement_bank:account.settlement_bank,account_last4:resolved.accountNumber.slice(-4),account_name:resolved.accountName,account_type:p.type,status:active?"active":"pending",paystack_verified:account.is_verified===true,percentage_charge:10});
    if(saved)return NextResponse.json({error:"Paystack created the account but saving failed. Contact support to recover it; do not create another account."},{status:503});
    return NextResponse.json({status:active?"active":"pending"});
  }catch{return NextResponse.json({error:"Account setup could not be completed. Refresh the page; contact support if a submitted account is missing."},{status:503});}
}

export async function PATCH(request:Request) {
  try {
    const parsed=z.object({organizationId:z.string().uuid()}).safeParse(await request.json());
    if(!parsed.success)return NextResponse.json({error:"Invalid organization."},{status:400});
    const organizationId=parsed.data.organizationId;
    const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();
    if(!user)return NextResponse.json({error:"Sign in required."},{status:401});
    const {data:member}=await supabase.from("organization_members").select("role").eq("organization_id",organizationId).eq("user_id",user.id).maybeSingle();
    if(!member||!["owner","admin"].includes(member.role))return NextResponse.json({error:"Organization access denied."},{status:403});
    const admin=paymentAdmin();const {data:account,error}=await admin.from("organization_paystack_accounts").select("subaccount_code").eq("organization_id",organizationId).single();
    if(error||!account)return NextResponse.json({error:"No saved payment account found."},{status:404});
    const response=await fetch(`https://api.paystack.co/subaccount/${encodeURIComponent(account.subaccount_code)}`,{headers:{Authorization:`Bearer ${paystackSecret()}`},cache:"no-store",signal:AbortSignal.timeout(12000)});
    const result=await response.json();const remote=result.data;
    if(!response.ok||!result.status||remote?.subaccount_code!==account.subaccount_code)throw new Error("Lookup failed");
    const status=remote.active===false?"inactive":remote.is_verified===true&&remote.active===true&&Number(remote.percentage_charge)===10&&remote.currency==="GHS"?"active":"pending";
    const {error:save}=await admin.from("organization_paystack_accounts").update({status,paystack_verified:remote.is_verified===true,account_name:remote.account_name||null,settlement_bank:remote.settlement_bank,account_last4:String(remote.account_number).slice(-4),updated_at:new Date().toISOString()}).eq("organization_id",organizationId);
    if(save)throw save;
    return NextResponse.json({status});
  }catch{return NextResponse.json({error:"Could not refresh verification. Try again shortly."},{status:503});}
}
