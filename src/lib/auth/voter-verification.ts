"use server";

import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createVoterAuth } from "@/lib/auth/voter-auth";
import { createClient } from "@/lib/supabase/server";
import { paymentAdmin } from "@/lib/payments/admin";
import { allow } from "@/lib/payments/gateway";
import { normalizeGhanaPhone } from "@/lib/auth/phone";
import { requestVoterEmailCodeAction, requestVoterPhoneCodeAction } from "@/lib/auth/actions";
import type { AuthFormState } from "@/lib/auth/form-state";

const detailsSchema = z.object({
  eventId: z.string().uuid(),
  type: z.enum(["phone", "email", "identifier", "invite_code"]),
  identifier: z.string().trim().min(1).max(320),
  claimCode: z.string().trim().max(32),
  token: z.string().max(2048),
  otp: z.string().regex(/^\d{6,8}$/).or(z.literal("")),
});

export async function verifyEventVoterAction(_previous: AuthFormState, form: FormData): Promise<AuthFormState> {
  const parsed = detailsSchema.safeParse({ eventId: form.get("eventId"), type: form.get("type"), identifier: form.get("identifier"), claimCode: form.get("claimCode") ?? "", token: form.get("cf-turnstile-response") ?? "", otp: form.get("otp") ?? "" });
  if (!parsed.success) return { message: "Check your voting details and verification code." };
  const { eventId, type, claimCode, token, otp } = parsed.data;
  let identifier = parsed.data.identifier;
  if (type === "phone") {
    identifier = normalizeGhanaPhone(identifier);
    if (!/^\+233\d{9}$/.test(identifier)) return { message: "Enter a Ghana phone number, for example 0241234567." };
  }
  if (type === "email") {
    if (!z.string().email().safeParse(identifier).success) return { message: "Enter a valid email address." };
    identifier = identifier.toLowerCase();
  }
  if (otp && type !== "phone" && type !== "email") return { message: "Use the verification method selected for this event." };
  if (!otp && ((process.env.NODE_ENV === "production" && !process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY) || (process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && !token))) return { message: "Complete security verification and try again." };
  try {
    const requestHeaders = await headers();
    // Vercel overwrites this header. Never accept an IP from submitted fields.
    const ip = requestHeaders.get("x-vercel-forwarded-for") ?? (process.env.NODE_ENV === "production" ? "unknown" : "local");
    const bucket = createHash("sha256").update(ip).digest("hex");
    const recipient = createHash("sha256").update(`${type}:${identifier}`).digest("hex");
    if (!await allow(`voter-page:${bucket}`, 200, 300) || !await allow(`voter-event:${bucket}:${eventId}:${recipient}`, 10, 300)) return { message: "Too many attempts. Please wait five minutes and try again." };
    let supabase = await createClient();
    const { data: current } = await supabase.auth.getUser();
    const { data: prepared, error: prepareError } = await paymentAdmin().rpc("prepare_event_voter_verification", {
      p_event_id: eventId, p_identifier_type: type, p_identifier: identifier,
      p_claim_code: claimCode || null, p_user_id: current.user?.id ?? null,
    });
    if (prepareError) return { message: "Voting verification is temporarily unavailable. Please try again later." };
    if (prepared?.success !== true) return { message: prepared?.error ?? "Check your voting details." };
    if (type === "phone" || type === "email") {
      if (!otp) {
        const sending = new FormData();
        sending.set(type, identifier);
        sending.set("next", `/events/${prepared.slug}`);
        sending.set("cf-turnstile-response", token);
        return type === "phone" ? await requestVoterPhoneCodeAction(null, sending) : await requestVoterEmailCodeAction(null, sending);
      }
      const auth = await createVoterAuth();
      const { error } = type === "phone"
        ? await auth.verifyOtp({ phone: identifier, token: otp, type: "sms" })
        : await auth.verifyOtp({ email: identifier, token: otp, type: "email" });
      if (error) return { message: "That code is invalid or expired. Try again or request a new code." };
      supabase = await createClient();
      if (prepared.method === "voter_list") {
        const { data, error: rosterError } = await supabase.rpc("verify_event_voter_identifier", { p_event_id: eventId, p_identifier: identifier, p_identifier_type: type, p_claim_code: null });
        if (rosterError || data?.success !== true) return { message: data?.error ?? "We could not confirm your voter-list eligibility." };
      }
    } else {
      if (!current.user) {
        // Auth validates Turnstile once and sets the background session cookies.
        const { error } = await (await createVoterAuth()).signInAnonymously({ options: token ? { captchaToken: token } : {} });
        if (error) return { message: "Code verification is temporarily unavailable. Please contact the organizer or try again later." };
      } else if (process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY) {
        // Existing sessions do not call Auth; validate their token on the server.
        const secret = process.env.TURNSTILE_SECRET_KEY;
        if (!secret) return { message: "Security verification is temporarily unavailable." };
        const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body: new URLSearchParams({ secret, response: token }), signal: AbortSignal.timeout(10_000) });
        const result = await response.json();
        if (!response.ok || result.success !== true) return { message: "Security verification expired. Please try again." };
      }
      supabase = await createClient();
      const { data, error } = type === "invite_code"
        ? await supabase.rpc("verify_event_access_code", { p_event_id: eventId, p_code_hash: createHash("sha256").update(identifier.toUpperCase()).digest("hex") })
        : await supabase.rpc("verify_event_voter_identifier", { p_event_id: eventId, p_identifier: identifier, p_identifier_type: "identifier", p_claim_code: claimCode.toUpperCase() });
      if (error || data?.success !== true) return { message: data?.error ?? "We could not verify your voting details." };
    }
    revalidatePath(`/events/${prepared.slug}`);
    return { message: "Verified. You can vote below.", success: true };
  } catch {
    return { message: "Verification is temporarily unavailable. Please try again shortly." };
  }
}
