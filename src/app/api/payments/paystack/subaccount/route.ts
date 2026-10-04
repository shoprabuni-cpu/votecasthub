import { randomUUID } from "node:crypto";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { paymentAdmin } from "@/lib/payments/admin";
import { paystackSecret } from "@/lib/payments/paystack";
import { resolveSettlement } from "@/lib/payments/settlement";
import { recoverAccount } from "@/lib/payments/recover-account";
import { allow } from "@/lib/payments/gateway";
export const runtime = "nodejs";

const identity = z.object({ organizationId: z.string().uuid() });
const details = identity.extend({
  type: z.enum(["ghipss", "mobile_money"]),
  confirmedAccountName: z.string().min(1).max(200),
  businessName: z.string().trim().min(2).max(160),
  bankCode: z.string().trim().min(2).max(12),
  accountNumber: z.string().min(6).max(24),
  contactName: z.string().trim().min(2).max(120),
  contactPhone: z.string().trim().min(7).max(24),
});
const remoteSchema = z.object({
  subaccount_code: z.string().regex(/^ACCT_[A-Za-z0-9]+$/),
  business_name: z.string(), settlement_bank: z.string(),
  account_number: z.string(), account_name: z.string().nullable().optional(),
  active: z.boolean(), is_verified: z.boolean(), currency: z.string(),
  percentage_charge: z.coerce.number(),
});
type Kind = "create" | "update" | "deactivate" | "refresh";
async function handle(request: Request, kind: Kind) {
  const db = paymentAdmin();
  let locked = false;
  let remoteStarted = false;
  let organizationId = "";
  const token = randomUUID();
  const release = async () => {
    const { error } = await db.from("payment_account_operations").delete().eq("organization_id", organizationId).eq("token", token);
    if (error) throw error;
    locked = false;
  };
  try {
    const raw = await request.json();
    const parsed = identity.safeParse(raw);
    const form = kind === "create" || kind === "update" ? details.safeParse(raw) : null;
    if (!parsed.success || (form && !form.success)) return Response.json({ error: "Check the payment account details." }, { status: 400 });
    organizationId = parsed.data.organizationId;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) return Response.json({ error: "Sign in required." }, { status: 401 });
    const { data: member } = await supabase.from("organization_members").select("role").eq("organization_id", organizationId).eq("user_id", user.id).maybeSingle();
    if (!member || !["owner", "admin"].includes(member.role)) return Response.json({ error: "Only owners and admins can manage payment accounts." }, { status: 403 });
    if (!await allow(`account-manage:${user.id}`, 6, 60)) return Response.json({ error: "Please wait a minute before trying again." }, { status: 429 });
    const p = form?.success ? form.data : null;
    const resolved = p ? await resolveSettlement(p.type, p.bankCode, p.accountNumber) : null;
    if (p && resolved?.accountName !== p.confirmedAccountName) return Response.json({ error: "Account name changed. Verify it again." }, { status: 409 });
    const { error: lockError } = await db.rpc("begin_payment_account_change", { p_organization_id: organizationId, p_token: token, p_kind: kind });
    if (lockError) {
      const message = lockError.code === "P0001" ? lockError.message : "Another account change is in progress. If an earlier request failed, contact support to reconcile it before retrying.";
      return Response.json({ error: message }, { status: 409 });
    }
    locked = true;
    const { data: saved, error: readError } = await db.from("organization_paystack_accounts").select("subaccount_code,status,account_type").eq("organization_id", organizationId).maybeSingle();
    if (readError) throw readError;
    const account = saved ?? (kind === "refresh" ? await recoverAccount(organizationId) : null);
    if (kind !== "create" && !account) {
      await release();
      return Response.json({ error: "No saved payment account found." }, { status: 404 });
    }
    const headers = { Authorization: `Bearer ${paystackSecret()}`, "Content-Type": "application/json" };
    // Verify the previous remote account is inactive before creating its replacement.
    if (kind === "create" && saved) {
      const check = await fetch(`https://api.paystack.co/subaccount/${encodeURIComponent(saved.subaccount_code)}`, { headers, cache: "no-store", signal: AbortSignal.timeout(12000) });
      const old = await check.json();
      if (!check.ok || old.status !== true || old.data?.active !== false || old.data?.subaccount_code !== saved.subaccount_code) {
        await release();
        return Response.json({ error: "The previous account must be confirmed inactive in Paystack before you can replace it." }, { status: 409 });
      }
    }
    if (kind === "create") {
      const { error } = await db.from("paystack_account_requests").insert({ organization_id: organizationId });
      if (error) {
        await release();
        return Response.json({ error: "Account setup was already submitted. Refresh verification or contact support to recover it." }, { status: 409 });
      }
    }
    const body = p && resolved ? {
      business_name: p.businessName, bank_code: p.bankCode, account_number: resolved.accountNumber,
      percentage_charge: 10, currency: "GHS", primary_contact_name: p.contactName,
      primary_contact_email: user.email, primary_contact_phone: p.contactPhone,
      metadata: JSON.stringify({ organization_id: organizationId, account_operation: token, account_type: p.type }),
    } : kind === "deactivate" ? { active: false } : undefined;
    remoteStarted = kind !== "refresh";
    const response = await fetch(`https://api.paystack.co/subaccount${kind === "create" ? "" : "/" + encodeURIComponent(account!.subaccount_code)}`, {
      method: kind === "create" ? "POST" : kind === "refresh" ? "GET" : "PUT",
      headers, body: body ? JSON.stringify(body) : undefined, cache: "no-store", signal: AbortSignal.timeout(20000),
    });
    const result = await response.json();
    if (!response.ok || result.status !== true) {
      // Only explicit rejection proves that retrying a mutation cannot duplicate it.
      if (response.status >= 400 && response.status < 500) {
        remoteStarted = false;
        if (kind === "create") {
          const { error } = await db.from("paystack_account_requests").delete().eq("organization_id", organizationId);
          if (error) throw error;
        }
      }
      throw new Error("Paystack request failed");
    }
    const remote = remoteSchema.parse(result.data);
    if (kind !== "create" && remote.subaccount_code !== account!.subaccount_code) throw new Error("Account mismatch");
    if (p && resolved) {
      const returnedNumber = p.type === "mobile_money" ? remote.account_number.replace(/^\+?233/, "0") : remote.account_number;
      if (returnedNumber !== resolved.accountNumber || remote.business_name !== p.businessName || remote.currency !== "GHS" || remote.percentage_charge !== 10) throw new Error("Updated settlement details were not confirmed");
    }
    if (kind === "deactivate" && remote.active !== false) throw new Error("Deactivation not confirmed");
    const status = !remote.active ? "inactive" : remote.is_verified && remote.currency === "GHS" && remote.percentage_charge === 10 ? "active" : "pending";
    const { error: saveError } = await db.from("organization_paystack_accounts").upsert({
      organization_id: organizationId, subaccount_code: remote.subaccount_code,
      business_name: remote.business_name, settlement_bank: remote.settlement_bank,
      account_last4: remote.account_number.slice(-4), account_name: remote.account_name || resolved?.accountName || null,
      account_type: p?.type ?? saved?.account_type ?? null, percentage_charge: 10,
      status, paystack_verified: remote.is_verified, updated_at: new Date().toISOString(),
    }, { onConflict: "organization_id" });
    if (saveError) throw saveError;
    await release();
    return Response.json({ status });
  } catch {
    // An ambiguous remote mutation stays locked; support must reconcile before any replacement.
    if (locked && !remoteStarted) await release().catch(() => undefined);
    return Response.json({ error: remoteStarted
      ? "Paystack has not been fully synchronized. New checkouts and account changes are paused. Contact support to reconcile this request; do not create another account."
      : "Could not manage the payment account. Please try again shortly." }, { status: 503 });
  }
}
export const POST = (request: Request) => handle(request, "create");
export const PUT = (request: Request) => handle(request, "update");
export const DELETE = (request: Request) => handle(request, "deactivate");
export const PATCH = (request: Request) => handle(request, "refresh");
