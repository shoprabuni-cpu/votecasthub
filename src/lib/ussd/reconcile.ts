import "server-only";
import { paymentAdmin } from "@/lib/payments/admin";
import { verifiedUssdTransaction } from "./provider";
export async function reconcileUssd(reference: string) {
  const transaction = await verifiedUssdTransaction(reference);
  const db = paymentAdmin();
  const { data, error } = await db.from("payment_attempts").select("total_amount_minor,currency,status").eq("provider", "arkesel_ussd").eq("provider_reference", reference).maybeSingle();
  if (error || !data || Number(data.total_amount_minor) !== transaction.amount || data.currency !== transaction.currency) throw new Error("USSD payment mismatch");
  if (transaction.status === "pending") return false;
  if (transaction.status === "failed") {
    const { error: failure } = await db.from("payment_attempts").update({ status: "failed" }).eq("provider_reference", reference).eq("provider", "arkesel_ussd").eq("status", "pending");
    if (failure) throw failure;
    return true;
  }
  const { error: confirm } = await db.rpc("confirm_ussd_paid_vote", { p_reference: reference, p_transaction_id: transaction.transactionId, p_paid_amount_minor: transaction.amount, p_provider_fee_minor: transaction.fees });
  if (confirm) throw confirm;
  if (transaction.status === "reversed") {
    const { error: reverse } = await db.rpc("apply_payment_adjustment", { p_reference: reference, p_provider_key: `ussd:reversed:${transaction.transactionId}`, p_amount_minor: transaction.amount, p_kind: "reversal" });
    if (reverse) throw reverse;
  }
  return true;
}

export async function reconcileUssdBatch() {
 const db=paymentAdmin();const {data,error}=await db.from("payment_attempts").select("provider_reference").eq("provider","arkesel_ussd").in("status",["pending","succeeded","refunded"]).order("updated_at").limit(4);if(error)throw error;
 let failed=0;for(const row of data??[]){try{await reconcileUssd(row.provider_reference);}catch{failed++;}await db.from("payment_attempts").update({updated_at:new Date().toISOString()}).eq("provider_reference",row.provider_reference).eq("provider","arkesel_ussd");}return failed;
}
