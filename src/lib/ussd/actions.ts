"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { AuthFormState } from "@/lib/auth/form-state";
import { ussdConfiguration, ussdPaymentReady } from "./provider";

export async function requestUssdAction(_: AuthFormState, form: FormData): Promise<AuthFormState> {
  const data = z.object({ eventId: z.uuid(), requested: z.enum(["yes", "no"]) }).safeParse(Object.fromEntries(form));
  if (!data.success) return { message: "Check the event and try again." };
  try {
    const db = await createClient();
    const { error } = await db.rpc("request_event_ussd", { p_event_id: data.data.eventId, p_requested: data.data.requested === "yes" });
    if (error) return { message: error.code === "22023" ? error.message : "Could not update the USSD request. Check your access and try again." };
    revalidatePath("/organizer", "layout");
    revalidatePath("/admin/ussd");
    return { success: true, message: data.data.requested === "yes" ? "Request received. Your website voting stays available. USSD needs a quote and activation first." : "USSD request cancelled." };
  } catch { return { message: "USSD requests are temporarily unavailable." }; }
}

export async function quoteUssdAction(_: AuthFormState, form: FormData): Promise<AuthFormState> {
  const data = z.object({ eventId: z.uuid(), price: z.string().regex(/^\d+(\.\d{1,2})?$/), terms: z.string().trim().min(20).max(3000), expires: z.string().min(1) }).safeParse(Object.fromEntries(form));
  if (!data.success) return { message: "Enter a price, full terms and quote expiry." };
  const amount = Math.round(Number(data.data.price) * 100);
  const expiry = new Date(`${data.data.expires}:00Z`);
  if (!Number.isSafeInteger(amount) || amount < 1 || amount > 100000000 || !Number.isFinite(expiry.getTime())) return { message: "Check the price and Ghana expiry date." };
  try {
    const db = await createClient();
    const { error } = await db.rpc("quote_event_ussd", { p_event_id: data.data.eventId, p_amount_minor: amount, p_terms: data.data.terms, p_valid_until: expiry.toISOString() });
    if (error) return { message: error.code === "22023" ? error.message : "Only platform admins can issue quotes." };
    revalidatePath("/admin/ussd"); revalidatePath("/organizer", "layout");
    return { success: true, message: "Quote issued. The organizer must accept it before payment and activation." };
  } catch { return { message: "Could not issue quote. Try again." }; }
}

export async function acceptUssdQuoteAction(_: AuthFormState, form: FormData): Promise<AuthFormState> {
  const data = z.object({ eventId: z.uuid(), quoteId: z.uuid(), acknowledged: z.literal("yes") }).safeParse(Object.fromEntries(form));
  if (!data.success) return { message: "Confirm that you accept the displayed price and terms." };
  try {
    const db = await createClient();
    const { error } = await db.rpc("accept_event_ussd_quote", { p_event_id: data.data.eventId, p_quote_id: data.data.quoteId });
    if (error) return { message: error.code === "22023" ? error.message : "An organizer owner or admin must accept the quote." };
    revalidatePath("/admin/ussd"); revalidatePath("/organizer", "layout");
    return { success: true, message: "Quote accepted. No payment was taken. Provider setup and activation are still required." };
  } catch { return { message: "Could not accept quote. Refresh and try again." }; }
}

export async function configureUssdAction(_: AuthFormState, form: FormData): Promise<AuthFormState> {
  const parsed = z.object({ eventId: z.uuid(), enabled: z.enum(["yes", "no"]), dialCode: z.string().default(""), from: z.string().default(""), until: z.string().default(""), notice: z.string().max(300).default(""), tested: z.string().optional() }).safeParse(Object.fromEntries(form));
  if(!parsed.success)return {message:"Check USSD activation settings."};
  const p=parsed.data,enabled=p.enabled==="yes",config=ussdConfiguration();
  if(enabled&&p.tested!=="yes")return {message:"Confirm provider and real-phone testing before activation."};
  if(enabled&&(!config.success||p.dialCode!==config.data.ARKESEL_USSD_SERVICE_CODE))return {message:"Configure and verify the provider adapter and matching shortcode before activation."};
  const from=enabled?new Date(`${p.from}:00Z`):null,until=enabled?new Date(`${p.until}:00Z`):null;
  if(enabled&&(!Number.isFinite(from?.getTime())||!Number.isFinite(until?.getTime())))return {message:"Enter valid activation dates in Ghana time."};
  try {
    const db=await createClient();
    if(enabled&&!ussdPaymentReady()){const {data:event}=await db.from("events").select("voting_mode").eq("id",p.eventId).maybeSingle();if(!event||event.voting_mode!=="free")return {message:"Paid USSD needs the Mobile Money API adapter. Free phone voting can use the native session gateway."};}
    const {error}=await db.rpc("configure_event_ussd",{p_event_id:p.eventId,p_enabled:enabled,p_dial_code:p.dialCode,p_from:from?.toISOString()??null,p_until:until?.toISOString()??null,p_network_notice:p.notice});
    if(error)return {message:"Activation failed. Check confirmed payment, published event, phone verification and dates within the event window."};
    revalidatePath("/admin/ussd");revalidatePath("/organizer","layout");revalidatePath("/events","layout");
    return {success:true,message:enabled?"USSD access enabled for the configured event period.":"USSD access disabled."};
  }catch{return {message:"Could not update USSD access."};}
}
