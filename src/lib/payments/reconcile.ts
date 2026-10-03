import "server-only";
import { z } from "zod";
import { paymentAdmin } from "./admin";
import { paystack } from "./gateway";
import { paystackSecret } from "./paystack";

const txSchema=z.object({id:z.number().int().positive().safe(),reference:z.string(),status:z.string(),amount:z.number().int().positive().safe(),currency:z.string(),domain:z.enum(["live","test"]),fees:z.number().int().nonnegative().safe().nullable(),subaccount:z.object({subaccount_code:z.string().optional()}).nullable().optional()});
type Transaction=z.infer<typeof txSchema>;
async function applyTransaction(t:Transaction,allowReversed=false){
  if(t.domain!==(paystackSecret().startsWith("sk_live_")?"live":"test"))throw new Error("Payment mode mismatch");
  if(t.status!=="success"&&!(allowReversed&&t.status==="reversed"))return;
  const db=paymentAdmin();
  if(t.reference.startsWith("VCH-VOTE-")){
    const {data:p,error}=await db.from("payment_attempts").select("total_amount_minor,currency,subaccount_code,organization_id").eq("provider_reference",t.reference).eq("provider","paystack").maybeSingle();
    if(error)throw error;if(!p)return;
    let subaccount=p.subaccount_code;
    if(!subaccount){const {data:a,error:e}=await db.from("organization_paystack_accounts").select("subaccount_code").eq("organization_id",p.organization_id).single();if(e)throw e;subaccount=a.subaccount_code;}
    if(Number(p.total_amount_minor)!==t.amount||p.currency!==t.currency||t.subaccount?.subaccount_code!==subaccount||t.fees===null)throw new Error("Payment verification mismatch");
    const {error:e}=await db.rpc("confirm_paid_vote",{p_reference:t.reference,p_transaction_id:t.id,p_paid_amount_minor:t.amount,p_provider_fee_minor:t.fees});if(e)throw e;
  }else if(t.reference.startsWith("VCH-SMS-")){
    const {data:p,error}=await db.from("sms_credit_purchases").select("amount_minor").eq("reference",t.reference).maybeSingle();if(error)throw error;if(!p)return;
    if(Number(p.amount_minor)!==t.amount||t.currency!=="GHS")throw new Error("SMS payment mismatch");
    const {error:e}=await db.rpc("fulfill_sms_credit_purchase",{p_reference:t.reference,p_transaction_id:t.id});if(e)throw e;
  }
}
export async function reconcileReference(reference:string){
  const tx=txSchema.parse(await paystack(`/transaction/verify/${encodeURIComponent(reference)}`));
  if(tx.reference!==reference)throw new Error("Reference mismatch");
  if(!["success","reversed"].includes(tx.status))return false;
  await applyTransaction(tx,tx.status==="reversed");
  if(tx.status==="reversed")await adjust(reference,`reversed:${tx.id}`,tx.amount,"reversal");
  return true;
}
async function adjust(reference:string,key:string,amount:number,kind:"refund"|"reversal"){
  const db=paymentAdmin();
  // Ignore payments belonging to other products on this Paystack integration.
  const table=reference.startsWith("VCH-VOTE-")?"payment_attempts":reference.startsWith("VCH-SMS-")?"sms_credit_purchases":null;
  if(!table)return;
  const {data,error}=await db.from(table).select("id").eq(table==="payment_attempts"?"provider_reference":"reference",reference).maybeSingle();if(error)throw error;if(!data)return;
  const {error:e}=await db.rpc("apply_payment_adjustment",{p_reference:reference,p_provider_key:key,p_amount_minor:amount,p_kind:kind});if(e)throw e;
}
const adjustmentSchema=z.object({id:z.number().int().positive().safe(),status:z.string(),amount:z.number().int().positive().safe().optional(),refund_amount:z.number().int().positive().safe().nullable().optional(),dispute:z.number().int().positive().nullable().optional(),currency:z.string().nullable().optional(),transaction:z.union([z.number().int().positive().safe(),z.object({id:z.number().int().positive().safe()})]),resolution:z.string().nullable().optional()});
export async function processPaymentJob(kind:string,resource:string){
  if(kind==="charge.success")return reconcileReference(resource);
  const isRefund=kind==="refund.processed";
  if(!isRefund&&kind!=="charge.dispute.resolve")return true;
  const a=adjustmentSchema.parse(await paystack(`/${isRefund?"refund":"dispute"}/${encodeURIComponent(resource)}`));
  if(String(a.id)!==resource)throw new Error("Adjustment identity mismatch");
  if(isRefund?a.status!=="processed":a.status!=="resolved"||a.resolution!=="merchant-accepted")return false;
  const amount=a.amount??a.refund_amount; if(!amount)throw new Error("Missing adjustment amount");
  const id=typeof a.transaction==="number"?a.transaction:a.transaction.id;
  const tx=txSchema.parse(await paystack(`/transaction/${id}`));
  if(tx.id!==id||amount>tx.amount||(a.currency&&a.currency!==tx.currency))throw new Error("Adjustment mismatch");
  await applyTransaction(tx,true);
  await adjust(tx.reference,`${isRefund&&!a.dispute?"refund":"dispute"}:${a.dispute??a.id}`,amount,isRefund?"refund":"reversal");
}


