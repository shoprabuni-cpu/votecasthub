"use server";

import { createHash, randomBytes, randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getPublicEnvironment } from "@/lib/env";
import { safeNextPath, type AuthFormState } from "@/lib/auth/form-state";
import { createHmac } from "node:crypto";
import { paymentAdmin } from "@/lib/payments/admin";
import { createVoterAuth } from "@/lib/auth/voter-auth";
import { normalizeGhanaPhone } from "@/lib/auth/phone";
import { scheduleNotificationDelivery } from "@/lib/notifications/delivery";

const loginSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(256),
  next: z.string().max(2048).optional(),
});

const registrationSchema = z.object({
  displayName: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(254),
  password: z.string().min(12).max(256),
  acceptTerms: z.literal("yes"),
  next: z.string().max(2048).optional(),
});

const eventFields = {
  name: z.string().trim().min(2).max(160),
  description: z.string().max(5000).optional().or(z.literal("")),
  votingMode: z.enum(["free", "paid"]),
  verificationMethod: z.enum(["phone", "email", "invite_code", "voter_list"]),
  votingRule: z.enum(["one_per_category", "category_limit", "per_nominee_limit"]),
  priceGhs: z.string().max(32).optional().or(z.literal("")),
  freeVoteLimit: z.string().max(3).optional().or(z.literal("")),
  votingRules: z.string().max(3000).optional().or(z.literal("")),
  startsAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/),
  endsAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/),
  resultsVisibility: z.enum(["organizer_only", "live", "after_close", "hidden"]),
};

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function captchaOptions(formData: FormData) {
  const captchaToken = formString(formData, "cf-turnstile-response");
  if (captchaToken.length > 2048 || (process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && !captchaToken)) {
    throw new Error("Complete security verification");
  }
  return captchaToken ? { captchaToken } : {};
}

function priceToMinor(value: string) {
  const [whole, fraction = ""] = value.split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}

function ghanaLocalDateToIso(value: string) {
  const date = new Date(`${value}:00+00:00`);
  if (Number.isNaN(date.getTime())) return null;
  const iso = date.toISOString();
  return iso.slice(0, 16) === value ? iso : null;
}

function eventSlug(name: string) {
  const base = name.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 88);
  return `${base || "event"}-${randomBytes(3).toString("hex")}`;
}

function eventError(code?: string) {
  if (code === "42501") return "You do not have permission to manage this event. Refresh your session and try again.";
  if (code === "23505") return "That name is already in use. Change it slightly and try again.";
  if (code === "P0002") return "This draft could not be found. Refresh the page and try again.";
  return "We could not save those changes. Check the details and try again.";
}

function parseEventForm(formData: FormData) {
  const parsed = z.object(eventFields).safeParse({
    name: formString(formData, "name"),
    description: formString(formData, "description"),
    votingMode: formString(formData, "votingMode"),
    verificationMethod: formString(formData, "verificationMethod") || "phone",
    votingRule: formString(formData, "votingRule"),
    priceGhs: formString(formData, "priceGhs"),
    freeVoteLimit: formString(formData, "freeVoteLimit"),
    votingRules: formString(formData, "votingRules"),
    startsAt: formString(formData, "startsAt"),
    endsAt: formString(formData, "endsAt"),
    resultsVisibility: formString(formData, "resultsVisibility"),
  });
  if (!parsed.success) {
    const fieldLabels: Record<string, string> = {
      name: "event name",
      description: "event description",
      votingMode: "voting type",
      votingRule: "voting rule",
      priceGhs: "price per vote",
      freeVoteLimit: "free vote limit",
      votingRules: "voting rules",
      startsAt: "voting start time",
      endsAt: "voting end time",
      resultsVisibility: "results visibility",
    };
    const invalidFields = [...new Set(parsed.error.issues.map((issue) => fieldLabels[String(issue.path[0])] ?? "event details"))];
    return { error: `Please check the ${invalidFields.join(", ")}.` } as const;
  }
  const startsAt = ghanaLocalDateToIso(parsed.data.startsAt);
  const endsAt = ghanaLocalDateToIso(parsed.data.endsAt);
  const unitPriceMinor = parsed.data.votingMode === "free" ? 0 : /^\d{1,10}(\.\d{1,2})?$/.test(parsed.data.priceGhs ?? "") ? priceToMinor(parsed.data.priceGhs ?? "") : Number.NaN;
  const freeVoteLimit = parsed.data.votingMode === "free" ? Number(parsed.data.freeVoteLimit) : null;
  if (!startsAt || !endsAt || new Date(startsAt) >= new Date(endsAt)) return { error: "Choose a valid voting start and end time." } as const;
  if (parsed.data.votingMode === "paid" && (!Number.isSafeInteger(unitPriceMinor) || unitPriceMinor < 1 || unitPriceMinor > 1_000_000_000_000)) return { error: "Enter a paid vote price with up to two decimal places." } as const;
  if (parsed.data.votingMode === "free" && (!Number.isInteger(freeVoteLimit) || (freeVoteLimit ?? 0) < 1 || (freeVoteLimit ?? 0) > 100)) return { error: "Set a free vote limit from 1 to 100." } as const;
  if (parsed.data.votingMode === "free" && parsed.data.votingRule === "one_per_category" && freeVoteLimit !== 1) return { error: "One vote per category must use a limit of one." } as const;
  return { data: { ...parsed.data, startsAt, endsAt, unitPriceMinor, freeVoteLimit } } as const;
}

function readForm(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

function logAuthFailure(flow: "signup" | "confirmation_resend" | "password_reset" | "password_update" | "phone_signin", code?: string) {
  // Log only the flow and provider code; never include account identifiers or credentials.
  console.warn("Authentication request failed", { flow, ...(code ? { code } : {}) });
}

export async function signInAction(_previousState: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = loginSchema.safeParse(readForm(formData));
  if (!parsed.success) return { message: "Enter a valid email address and password." };

  const supabase = await createClient();
  try {
    const { error } = await supabase.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
      options: captchaOptions(formData),
    });
    if (error) return { message: "We could not sign you in. Check your details or verify your email, then try again." };
  } catch {
    return { message: "Sign-in is temporarily unavailable. Please try again shortly." };
  }

  revalidatePath("/", "layout");
  const destination = safeNextPath(parsed.data.next);
  if (destination === "/organizer") {
    const { data: memberships } = await supabase.from("organization_members").select("organization_id").eq("user_id", (await supabase.auth.getUser()).data.user?.id ?? "");
    const ids = [...new Set((memberships ?? []).map((row: { organization_id: string }) => row.organization_id))];
    if (ids.length === 1) redirect(`/organizer/${ids[0]}/events`);
  }
  redirect(destination);
}

const phoneSchema = z.string().max(32).transform(normalizeGhanaPhone).pipe(z.string().regex(/^\+233\d{9}$/));

export async function requestVoterPhoneCodeAction(_previousState: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const phone = phoneSchema.safeParse(formString(formData, "phone"));
  const next = safeNextPath(formString(formData, "next"), "/events");
  if (!phone.success) return { message: "Enter a Ghana phone number such as 0241234567 or +233241234567." };
  if (process.env.NODE_ENV === "production" && !process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY) return { message: "Phone verification is temporarily unavailable. Please try again later." };
  if (process.env.NODE_ENV === "production" && !formString(formData, "cf-turnstile-response")) return { message: "Complete security verification before requesting a phone code." };
  try {
    const eventSlug = /^\/events\/([^/?]+)(?:[/?]|$)/.exec(next)?.[1];
    const hookSecret = process.env.SUPABASE_SEND_SMS_HOOK_SECRET?.replace(/^v1,/, "");
    if (!eventSlug || !hookSecret) return { message: "Open the event you want to vote in before requesting a code." };
    const admin = paymentAdmin();
    const { data: target, error: targetError } = await admin.from("events").select("id").eq("slug", eventSlug).maybeSingle();
    if (targetError || !target) return { message: "Voting verification is unavailable for this event." };
    const { data: eligible, error: eligibilityError } = await admin.rpc("prepare_event_voter_verification", { p_event_id: target.id, p_identifier_type: "phone", p_identifier: phone.data });
    if (eligibilityError || eligible?.success !== true) return { message: eligible?.error ?? "Voting verification is unavailable for this event." };
    const recipientHash = createHmac("sha256", hookSecret).update(`phone:${phone.data.replace(/^\+/, "")}`).digest("hex");
    const { data: sponsored, error: sponsorError } = await paymentAdmin().rpc("prepare_voter_sms", { p_recipient_hash: recipientHash, p_event_slug: eventSlug });
    if (sponsorError || !sponsored) return { message: "Verification is unavailable. The event must be open with SMS credits available. Wait a minute before retrying." };
    const { error } = await (await createVoterAuth()).signInWithOtp({ phone: phone.data, options: { shouldCreateUser: true, ...captchaOptions(formData) } });
    if (error) {
      logAuthFailure("phone_signin", error.code);
      console.error("phone_signin_supabase_error", { code: error.code ?? "unknown", status: error.status ?? null, name: error.name ?? "AuthError" });
      return { message: "We could not create the verification challenge. Please request a new code." };
    }
  } catch {
    logAuthFailure("phone_signin");
    return { message: "Phone verification is temporarily unavailable. Please try again shortly." };
  }
  return { message: "Verification code requested. Check your messages.", success: true, codeSent: true, phone: phone.data, next, resendAt: Date.now() + 60_000 };
}

export async function verifyVoterPhoneCodeAction(_previousState: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const phone = phoneSchema.safeParse(formString(formData, "phone"));
  const token = z.string().regex(/^\d{6,8}$/).safeParse(formString(formData, "token"));
  const next = safeNextPath(formString(formData, "next"), "/events");
  if (!phone.success || !token.success) return { message: "Enter the phone number and verification code." };
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ phone: phone.data, token: token.data, type: "sms" });
    if (error) return { message: "That code is invalid or expired. Request a new one and try again." };
  } catch {
    return { message: "Phone verification is temporarily unavailable. Please try again shortly." };
  }
  revalidatePath("/", "layout");
  redirect(next);
}

const emailSchema = z.string().trim().email().max(320);
export async function requestVoterEmailCodeAction(_previousState: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const email = emailSchema.safeParse(formString(formData, "email"));
  const next = safeNextPath(formString(formData, "next"), "/events");
  if (!email.success) return { message: "Enter a valid email address." };
  if (process.env.NODE_ENV === "production" && (!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || !formString(formData, "cf-turnstile-response"))) return { message: "Complete security verification before requesting an email code." };
  try {
    const eventSlug = /^\/events\/([^/?]+)(?:[/?]|$)/.exec(next)?.[1];
    if (eventSlug) {
      const admin = paymentAdmin();
      const { data: target, error: targetError } = await admin.from("events").select("id").eq("slug", eventSlug).maybeSingle();
      if (targetError || !target) return { message: "Voting verification is unavailable for this event." };
      const { data: eligible, error: eligibilityError } = await admin.rpc("prepare_event_voter_verification", { p_event_id: target.id, p_identifier_type: "email", p_identifier: email.data.toLowerCase() });
      if (eligibilityError || eligible?.success !== true) return { message: eligible?.error ?? "Voting verification is unavailable for this event." };
    }
    const { error } = await (await createVoterAuth()).signInWithOtp({ email: email.data, options: { shouldCreateUser: true, ...captchaOptions(formData) } });
    if (error) { logAuthFailure("phone_signin", error.code); return { message: "We could not send an email code. Please try again." }; }
  } catch { return { message: "Email verification is temporarily unavailable." }; }
  return { message: "Verification code sent. Check your email.", success: true, codeSent: true, email: email.data, next, resendAt: Date.now() + 60_000 };
}

export async function verifyVoterEmailCodeAction(_previousState: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const email = emailSchema.safeParse(formString(formData, "email"));
  const token = z.string().regex(/^\d{6,8}$/).safeParse(formString(formData, "token"));
  const next = safeNextPath(formString(formData, "next"), "/events");
  if (!email.success || !token.success) return { message: "Enter your email and the verification code." };
  try { const supabase = await createClient(); const { error } = await supabase.auth.verifyOtp({ email: email.data, token: token.data, type: "email" }); if (error) return { message: "That code is invalid or expired. Request a new one." }; } catch { return { message: "Email verification is temporarily unavailable." }; }
  revalidatePath("/", "layout"); redirect(next);
}

export async function castFreeVotesAction(_previousState: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = z.object({
    eventId: z.string().uuid(),
    categoryId: z.string().uuid(),
    nomineeId: z.string().uuid(),
    requestKey: z.string().uuid(),
    quantity: z.coerce.number().int().min(1).max(100),
  }).safeParse({
    eventId: formString(formData, "eventId"),
    categoryId: formString(formData, "categoryId"),
    nomineeId: formString(formData, "nomineeId"),
    requestKey: formString(formData, "requestKey"),
    quantity: formString(formData, "quantity"),
  });
  if (!parsed.success) return { message: "Choose a valid vote quantity and try again." };
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("cast_free_votes", {
      p_event_id: parsed.data.eventId,
      p_category_id: parsed.data.categoryId,
      p_nominee_id: parsed.data.nomineeId,
      p_quantity: parsed.data.quantity,
      p_request_key: parsed.data.requestKey,
    });
    if (error) {
      if (error.code === "42501") {
        if (error.message.includes("Verify your phone")) return { message: "Verify your phone number before voting." };
        if (error.message.includes("Verify your email")) return { message: "Verify your email address before voting." };
        if (error.message.includes("access code")) return { message: "Please redeem a valid event access code before voting." };
        if (error.message.includes("voter-list") || error.message.includes("voter list")) return { message: "Please verify your approved voter eligibility before voting." };
        if (error.message.includes("Authentication required")) return { message: "Complete verification on this event page before voting." };
      }
      if (error.message.includes("reached the vote limit")) return { message: error.message.includes("this nominee") ? "You have reached the vote limit for this nominee." : "You have reached the vote limit for this category." };
      if (error.message.includes("not open")) return { message: "Voting is not open for this event right now." };
      return { message: error.message || "We could not record your vote. Refresh the page and try again." };
    }
  } catch {
    return { message: "Voting is temporarily unavailable. Please try again shortly." };
  }
  revalidatePath("/events", "layout");
  revalidatePath("/events/[slug]", "page");
  return { message: "Your vote has been recorded securely.", success: true, nextRequestKey: randomUUID() };
}

export async function signUpAction(_previousState: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = registrationSchema.safeParse(readForm(formData));
  if (!parsed.success) return { message: "Enter your name, a valid email, and a password of at least 12 characters." };

  let hasSession = false;
  const nextPath = safeNextPath(parsed.data.next);
  try {
    const supabase = await createClient();
    const { NEXT_PUBLIC_SITE_URL } = getPublicEnvironment();
    const emailRedirectTo = new URL(`/auth/callback?next=${encodeURIComponent(nextPath)}`, NEXT_PUBLIC_SITE_URL).toString();
    const { data, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        emailRedirectTo,
        ...captchaOptions(formData),
        data: { display_name: parsed.data.displayName, terms_accepted_at: new Date().toISOString(), terms_version: "2026-10-02" },
      },
    });

    if (error) {
      logAuthFailure("signup", error.code);
      // Keep all valid registration responses uniform so account existence is not exposed.
      return { message: "If this address can be registered, confirmation instructions will be sent. Check your inbox shortly.", success: true };
    }
    hasSession = Boolean(data.session);
  } catch {
    logAuthFailure("signup");
    return { message: "If this address can be registered, confirmation instructions will be sent. Check your inbox shortly.", success: true };
  }

  if (hasSession) {
    revalidatePath("/", "layout");
    redirect(nextPath);
  }
  return { message: "If this address can be registered, confirmation instructions will be sent. Check your inbox shortly.", success: true };
}

const passwordResetRequestSchema = z.object({
  email: z.string().trim().email().max(254),
});

export async function resendConfirmationAction(_previousState: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = z.object({ email: z.string().trim().email().max(254), next: z.string().max(2048).optional() }).safeParse({ email: formString(formData, "email"), next: formString(formData, "next") });
  if (!parsed.success) return { message: "Enter a valid email address." };
  const nextPath = safeNextPath(parsed.data.next);

  try {
    const supabase = await createClient();
    const { NEXT_PUBLIC_SITE_URL } = getPublicEnvironment();
    const emailRedirectTo = new URL(`/auth/callback?next=${encodeURIComponent(nextPath)}`, NEXT_PUBLIC_SITE_URL).toString();
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: parsed.data.email,
      options: { emailRedirectTo, ...captchaOptions(formData) },
    });
    if (error) logAuthFailure("confirmation_resend", error.code);
  } catch {
    logAuthFailure("confirmation_resend");
  }

  return {
    message: "If that address has a pending confirmation, a new link will be sent. Check your inbox shortly.",
    success: true,
  };
}

const passwordUpdateSchema = z.object({
  password: z.string().min(12).max(256),
  confirmPassword: z.string().min(12).max(256),
}).refine((value) => value.password === value.confirmPassword);

export async function requestPasswordResetAction(_previousState: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = passwordResetRequestSchema.safeParse({ email: formString(formData, "email") });
  if (!parsed.success) return { message: "Enter a valid email address." };

  try {
    const supabase = await createClient();
    const { NEXT_PUBLIC_SITE_URL } = getPublicEnvironment();
    const redirectTo = new URL("/auth/callback?next=%2Freset-password", NEXT_PUBLIC_SITE_URL).toString();
    const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, { redirectTo, ...captchaOptions(formData) });
    if (error) {
      logAuthFailure("password_reset", error.code);
      return { message: "If an account matches that address, password reset instructions will be sent. Check your inbox.", success: true };
    }
  } catch {
    logAuthFailure("password_reset");
    return { message: "If an account matches that address, password reset instructions will be sent. Check your inbox.", success: true };
  }

  return {
    message: "If an account matches that address, password reset instructions will be sent. Check your inbox.",
    success: true,
  };
}

export async function updatePasswordAction(_previousState: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = passwordUpdateSchema.safeParse({
    password: formString(formData, "password"),
    confirmPassword: formString(formData, "confirmPassword"),
  });
  if (!parsed.success) return { message: "Use a matching password of at least 12 characters." };

  try {
    const supabase = await createClient();
    const { data: claims, error: claimsError } = await supabase.auth.getClaims();
    if (claimsError || typeof claims?.claims?.sub !== "string") {
      return { message: "This reset session has expired. Request a new password reset link." };
    }

    const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
    if (error) {
      logAuthFailure("password_update", error.code);
      return { message: "We could not update that password. The reset link may have expired; request a new one." };
    }
  } catch {
    logAuthFailure("password_update");
    return { message: "We could not update that password. The reset link may have expired; request a new one." };
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signOut({ scope: "global" });
    if (error) await supabase.auth.signOut({ scope: "local" });
  } catch {
    // The password is already changed; keep the success path and let the user sign in again.
  }

  revalidatePath("/", "layout");
  redirect("/sign-in?notice=password-updated");
}
export async function signOutAction(previousState: AuthFormState, formData: FormData): Promise<AuthFormState> {
  void previousState;
  void formData;
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signOut();
    if (error) return { message: "We could not safely end this session. Please try again." };
  } catch {
    return { message: "Sign-out is temporarily unavailable. Please try again." };
  }

  revalidatePath("/", "layout");
  redirect("/");
}

export async function createOrganizationAction(_previousState: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = z.object({ name: z.string().trim().min(2).max(120) }).safeParse(readForm(formData));
  if (!parsed.success) return { message: "Organization name must be between 2 and 120 characters." };

  const baseSlug = parsed.data.name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);
  const slug = `${baseSlug || "organization"}-${randomBytes(3).toString("hex")}`;

  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("create_organization", {
      p_name: parsed.data.name,
      p_slug: slug,
    });
    if (error) {
      if (error.code === "42501") return { message: "Sign in again before creating an organization." };
      if (error.code === "22023") return { message: "Check the organization name and try again." };
      return { message: "We could not create the organization right now. Please try again." };
    }
  } catch {
    return { message: "Organization setup is temporarily unavailable. Please try again." };
  }

  revalidatePath("/organizer", "page");
  redirect("/organizer");
}

export async function createOrganizationInvitationAction(_previousState: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = z.object({
    organizationId: z.string().uuid(),
    email: z.string().trim().email().max(254),
    role: z.enum(["admin", "editor", "viewer"]),
  }).safeParse({
    organizationId: formString(formData, "organizationId"),
    email: formString(formData, "email"),
    role: formString(formData, "role"),
  });
  if (!parsed.success) return { message: "Enter a valid email and invitation role." };
  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  try {
    const supabase = await createClient();
    const { NEXT_PUBLIC_SITE_URL } = getPublicEnvironment();
    const { error } = await supabase.rpc("create_organization_invitation", {
      p_organization_id: parsed.data.organizationId,
      p_email: parsed.data.email.toLowerCase(),
      p_role: parsed.data.role,
      p_token_hash: tokenHash,
    });
    if (error) {
      if (error.code === "42501") return { message: "You do not have permission to invite members with that role." };
      if (error.code === "23505") return { message: "That person is already a member or has a pending invitation." };
      if (error.code === "22023") return { message: "Enter a valid email address and invitation role." };
      return { message: "We could not create the invitation. Refresh and try again." };
    }
    const inviteUrl = new URL(`/invite/${token}`, NEXT_PUBLIC_SITE_URL).toString();
    revalidatePath(`/organizer/${parsed.data.organizationId}/team`);
    return { message: "Invitation link created. Share it with the invited person; it expires in 7 days.", success: true, inviteUrl };
  } catch {
    return { message: "Invitations are temporarily unavailable. Please try again." };
  }
}

export async function revokeOrganizationInvitationAction(_previousState: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const invitationId = z.string().uuid().safeParse(formString(formData, "invitationId"));
  const organizationId = z.string().uuid().safeParse(formString(formData, "organizationId"));
  if (!invitationId.success || !organizationId.success) return { message: "That invitation could not be revoked." };
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("revoke_organization_invitation", { p_invitation_id: invitationId.data });
    if (error) return { message: "We could not revoke that invitation. Refresh and try again." };
  } catch {
    return { message: "Invitations are temporarily unavailable. Please try again." };
  }
  revalidatePath(`/organizer/${organizationId.data}/team`);
  return { message: "Invitation revoked.", success: true };
}

export async function acceptOrganizationInvitationAction(_previousState: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const token = z.string().regex(/^[A-Za-z0-9_-]{43}$/).safeParse(formString(formData, "token"));
  if (!token.success) return { message: "This invitation link is invalid or expired." };
  let organizationId: string | null = null;
  try {
    const supabase = await createClient();
    const tokenHash = createHash("sha256").update(token.data).digest("hex");
    const { data, error } = await supabase.rpc("accept_organization_invitation", { p_token_hash: tokenHash });
    if (error || !data) {
      if (error?.code === "42501" && error.message.includes("Verify your email")) return { message: "Verify your email before accepting this invitation." };
      if (error?.code === "42501" && error.message.includes("invited email")) return { message: "Sign in with the email address this invitation was sent to." };
      return { message: "This invitation is invalid, expired, or already used." };
    }
    organizationId = data;
  } catch {
    return { message: "We could not accept this invitation. Sign in with the invited email and try again." };
  }
  if (!organizationId) return { message: "This invitation is invalid, expired, or already used." };
  revalidatePath("/organizer", "page");
  redirect(`/organizer/${organizationId}/events`);
}

export async function createEventAction(_previousState: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const organizationId = z.string().uuid().safeParse(formString(formData, "organizationId"));
  const parsed = parseEventForm(formData);
  if (!organizationId.success) return { message: "This organization reference is invalid. Return to your organization and try again." };
  if ("error" in parsed) return { message: typeof parsed.error === "string" ? parsed.error : "Check the event details." };

  let newEventId: string | null = null;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("create_event", {
      p_organization_id: organizationId.data,
      p_name: parsed.data.name,
      p_slug: eventSlug(parsed.data.name),
      p_description: parsed.data.description || null,
      p_unit_price_minor: parsed.data.unitPriceMinor,
      p_starts_at: parsed.data.startsAt,
      p_ends_at: parsed.data.endsAt,
      p_results_visibility: parsed.data.resultsVisibility,
      p_voting_mode: parsed.data.votingMode,
      p_free_vote_limit_per_phone: parsed.data.freeVoteLimit,
      p_voting_rule: parsed.data.votingRule,
      p_voting_rules: parsed.data.votingRules || null,
    });
    if (error || !data) return { message: eventError(error?.code) };
    newEventId = data;
    if (parsed.data.votingMode === "free") {
      const methodResult = await supabase.rpc("set_event_verification_method", { p_event_id: data, p_method: parsed.data.verificationMethod });
      if (methodResult.error) {
        console.error("set_event_verification_method failed on create:", methodResult.error);
        return { message: "We could not save the verification method." };
      }
    }
  } catch {
    return { message: "Event setup is temporarily unavailable. Please try again shortly." };
  }
  revalidatePath(`/organizer/${organizationId.data}/events`);
  redirect(`/organizer/${organizationId.data}/events/${newEventId}`);
}

export async function updateEventDraftAction(_previousState: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const eventId = z.string().uuid().safeParse(formString(formData, "eventId"));
  const organizationId = z.string().uuid().safeParse(formString(formData, "organizationId"));
  const parsed = parseEventForm(formData);
  if (!eventId.success || !organizationId.success) return { message: "This event or organization reference is invalid. Return to your event and try again." };
  if ("error" in parsed) return { message: typeof parsed.error === "string" ? parsed.error : "Check the event details." };

  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("update_event_draft", {
      p_event_id: eventId.data,
      p_name: parsed.data.name,
      p_description: parsed.data.description || null,
      p_unit_price_minor: parsed.data.unitPriceMinor,
      p_starts_at: parsed.data.startsAt,
      p_ends_at: parsed.data.endsAt,
      p_results_visibility: parsed.data.resultsVisibility,
      p_voting_mode: parsed.data.votingMode,
      p_free_vote_limit_per_phone: parsed.data.freeVoteLimit,
      p_voting_rule: parsed.data.votingRule,
      p_voting_rules: parsed.data.votingRules || null,
    });
    if (error) return { message: eventError(error.code) };
    if (parsed.data.votingMode === "free") {
      const methodResult = await supabase.rpc("set_event_verification_method", { p_event_id: eventId.data, p_method: parsed.data.verificationMethod });
      if (methodResult.error) {
        console.error("set_event_verification_method failed on update:", methodResult.error);
        return { message: "We could not save the verification method." };
      }
    }
    revalidatePath(`/organizer/${organizationId.data}/events/${eventId.data}`);
    revalidatePath(`/events`);
    return { message: "Draft details saved.", success: true };
  } catch {
    return { message: "Event setup is temporarily unavailable. Please try again shortly." };
  }
}

export async function addEventCategoryAction(_previousState: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const eventId = z.string().uuid().safeParse(formString(formData, "eventId"));
  const backTo = safeNextPath(formString(formData, "backTo"), "/organizer");
  const parsed = z.object({ name: z.string().trim().min(1).max(120), description: z.string().max(2000).optional().or(z.literal("")) }).safeParse({
    name: formString(formData, "name"), description: formString(formData, "description"),
  });
  if (!eventId.success || !parsed.success) return { message: "Enter a category name up to 120 characters." };
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("add_event_category", { p_event_id: eventId.data, p_name: parsed.data.name, p_description: parsed.data.description || null, p_display_order: null });
    if (error) return { message: eventError(error.code) };
    revalidatePath(backTo);
    return { message: "Category added. You can now add nominees below.", success: true, createdId: String(data) };
  } catch {
    return { message: "We could not add that category right now. Please try again." };
  }
}

export async function importEventCategoriesNomineesAction(_previousState: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const eventId = z.string().uuid().safeParse(formString(formData, "eventId"));
  const backTo = safeNextPath(formString(formData, "backTo"), "/organizer");
  let inputRows: unknown;
  try { inputRows = JSON.parse(formString(formData, "rows") || "[]"); } catch { return { message: "This import could not be read. Choose the file again." }; }
  const rows = z.array(z.object({
    category: z.string().trim().min(1).max(120),
    categoryDescription: z.string().max(2000).optional().default(""),
    nominee: z.string().trim().min(1).max(160),
    publicCode: z.string().trim().max(32).regex(/^[A-Za-z0-9-]*$/).optional().default(""),
    biography: z.string().max(3000).optional().default(""),
  })).min(1).max(1000).safeParse(inputRows);
  if (!eventId.success || !rows.success) return { message: "Use the template columns and add at least one valid row." };
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("import_event_categories_nominees", { p_event_id: eventId.data, p_rows: rows.data });
    if (error) return { message: error.code === "23505" ? "A nominee name or code is repeated in a category. No entries were imported. Correct the file and try again." : "No entries were imported. Check the file and confirm your event is still a draft." };
    revalidatePath(backTo);
    return { message: `Imported ${data} nominees.`, success: true };
  } catch {
    return { message: "We could not import this file right now. Check the preview and try again." };
  }
}

export async function updateEventCategoryAction(_previousState: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const categoryId = z.string().uuid().safeParse(formString(formData, "categoryId"));
  const backTo = safeNextPath(formString(formData, "backTo"), "/organizer");
  const parsed = z.object({
    name: z.string().trim().min(1).max(120),
    description: z.string().max(2000).optional().or(z.literal("")),
    displayOrder: z.coerce.number().int().min(0).max(10000),
    isActive: z.enum(["true", "false"]),
  }).safeParse({
    name: formString(formData, "name"),
    description: formString(formData, "description"),
    displayOrder: formString(formData, "displayOrder"),
    isActive: formString(formData, "isActive"),
  });
  if (!categoryId.success || !parsed.success) return { message: "Check the category name, description, order, and visibility." };
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("update_event_category", {
      p_category_id: categoryId.data,
      p_name: parsed.data.name,
      p_description: parsed.data.description || null,
      p_display_order: parsed.data.displayOrder,
      p_is_active: parsed.data.isActive === "true",
    });
    if (error) return { message: eventError(error.code) };
    revalidatePath(backTo);
    revalidatePath("/events", "layout");
    return { message: "Category updated.", success: true };
  } catch {
    return { message: "We could not update that category right now. Please try again." };
  }
}

export async function addCategoryNomineeAction(_previousState: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const categoryId = z.string().uuid().safeParse(formString(formData, "categoryId"));
  const backTo = safeNextPath(formString(formData, "backTo"), "/organizer");
  const parsed = z.object({
    name: z.string().trim().min(1).max(160),
    publicCode: z.string().trim().max(32).regex(/^[A-Za-z0-9-]*$/).optional().or(z.literal("")),
    biography: z.string().max(3000).optional().or(z.literal("")),
  }).safeParse({ name: formString(formData, "name"), publicCode: formString(formData, "publicCode"), biography: formString(formData, "biography") });
  if (!categoryId.success) return { message: "This category reference is invalid. Refresh the event page and try again." };
  if (!parsed.success) {
    const labels: Record<string, string> = { name: "name (1–160 characters)", publicCode: "public code (up to 32 letters, numbers, or hyphens)", biography: "biography (up to 3,000 characters)" };
    const invalidFields = [...new Set(parsed.error.issues.map((issue) => labels[String(issue.path[0])] ?? "nominee details"))];
    return { message: `Please check the ${invalidFields.join(" and ")}.` };
  }
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("add_category_nominee", {
      p_category_id: categoryId.data, p_name: parsed.data.name, p_public_code: parsed.data.publicCode || null, p_biography: parsed.data.biography || null, p_display_order: null,
    });
    if (error?.code === "23505") return { message: "A nominee with that name or public code already exists in this category." };
    if (error) return { message: eventError(error.code) };
    revalidatePath(backTo);
    return { message: "Nominee added.", success: true };
  } catch {
    return { message: "We could not add that nominee right now. Please try again." };
  }
}

export async function updateCategoryNomineeAction(_previousState: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const nomineeId = z.string().uuid().safeParse(formString(formData, "nomineeId"));
  const backTo = safeNextPath(formString(formData, "backTo"), "/organizer");
  const parsed = z.object({
    name: z.string().trim().min(1).max(160),
    publicCode: z.string().trim().max(32).regex(/^[A-Za-z0-9-]*$/).optional().or(z.literal("")),
    biography: z.string().max(3000).optional().or(z.literal("")),
    displayOrder: z.coerce.number().int().min(0).max(10000),
    isActive: z.enum(["true", "false"]),
  }).safeParse({
    name: formString(formData, "name"),
    publicCode: formString(formData, "publicCode"),
    biography: formString(formData, "biography"),
    displayOrder: formString(formData, "displayOrder"),
    isActive: formString(formData, "isActive"),
  });
  if (!nomineeId.success || !parsed.success) return { message: "Check the nominee details, display order, and visibility." };
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("update_category_nominee", {
      p_nominee_id: nomineeId.data,
      p_name: parsed.data.name,
      p_public_code: parsed.data.publicCode || null,
      p_biography: parsed.data.biography || null,
      p_display_order: parsed.data.displayOrder,
      p_is_active: parsed.data.isActive === "true",
    });
    if (error) return { message: eventError(error.code) };
    revalidatePath(backTo);
    revalidatePath("/events", "layout");
    return { message: "Nominee updated.", success: true };
  } catch {
    return { message: "We could not update that nominee right now. Please try again." };
  }
}

export async function updateNomineeImageAction(_previousState: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const nomineeId = z.string().uuid().safeParse(formString(formData, "nomineeId"));
  const backTo = safeNextPath(formString(formData, "backTo"), "/organizer");
  const imagePath = z.string().max(512).optional().or(z.literal("")).safeParse(formString(formData, "imagePath"));
  if (!nomineeId.success || !imagePath.success) return { message: "That image could not be saved." };
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("update_nominee_image", { p_nominee_id: nomineeId.data, p_image_path: imagePath.data || null });
    if (error) {
      if (error.code === "42501") return { message: "You do not have permission to change this nominee image." };
      if (error.code === "22023") return { message: "Check the image reference. Archived events cannot change nominee images." };
      return { message: "We could not save the image. Refresh the page and try again." };
    }
    revalidatePath(backTo);
    revalidatePath("/events", "layout");
    return { message: imagePath.data ? "Nominee image updated." : "Nominee image removed.", success: true };
  } catch {
    return { message: "Image updates are temporarily unavailable. Please try again." };
  }
}

export async function updateEventImageAction(_previousState: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const eventId = z.string().uuid().safeParse(formString(formData, "eventId"));
  const backTo = safeNextPath(formString(formData, "backTo"), "/organizer");
  const imagePath = z.string().max(512).optional().or(z.literal("")).safeParse(formString(formData, "imagePath"));
  if (!eventId.success || !imagePath.success) return { message: "That event image could not be saved." };
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("update_event_image", { p_event_id: eventId.data, p_image_path: imagePath.data || null });
    if (error) {
      if (error.code === "42501") return { message: "You do not have permission to change this event image." };
      if (error.code === "22023") return { message: "Archived events cannot change their cover image." };
      return { message: "We could not save the cover image. Refresh the page and try again." };
    }
    revalidatePath(backTo);
    revalidatePath("/events", "layout");
    return { message: imagePath.data ? "Event cover updated." : "Event cover removed.", success: true };
  } catch {
    return { message: "Event image updates are temporarily unavailable. Please try again." };
  }
}

export async function setEventStatusAction(_previousState: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const eventId = z.string().uuid().safeParse(formString(formData, "eventId"));
  const action = z.enum(["publish", "pause", "resume", "close", "archive", "unpublish"]).safeParse(formString(formData, "action"));
  const backTo = safeNextPath(formString(formData, "backTo"), "/organizer");
  if (!eventId.success || !action.success) return { message: "That event action is invalid." };
  try {
    const supabase = await createClient();
    const { error } = action.data === "publish"
      ? await supabase.rpc("submit_event_for_review", { p_event_id: eventId.data })
      : await supabase.rpc("set_event_status", { p_event_id: eventId.data, p_action: action.data });
    if (error?.message.includes("Add SMS credits")) return { message: "Add SMS credits in your workspace before publishing this free event." };
    if (error?.message.includes("Verify the organizer Paystack subaccount")) return { message: "Open Payment account and refresh verification after Paystack approves your account, then publish this event." };
    if (error?.message.includes("Paid voting cannot be published")) return { message: "Paid events can stay as drafts, but cannot go online until a payment provider is connected and confirmed." };
    if (error) return { message: error.code === "22023" ? error.message : eventError(error.code) };
    if (action.data === "publish") scheduleNotificationDelivery();
  } catch {
    return { message: "We could not update the event status. Please try again." };
  }
  revalidatePath(backTo);
  revalidatePath("/events", "layout");
  redirect(backTo);
}


