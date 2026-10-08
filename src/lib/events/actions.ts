"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { AuthFormState } from "@/lib/auth/form-state";
import { cleanupEventImages } from "./image-cleanup";

export async function sendEventReviewMessageAction(_state: AuthFormState, form: FormData): Promise<AuthFormState> {
  const parsed = z.object({ eventId: z.uuid(), message: z.string().trim().min(5).max(2000) }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return { message: "Write a message of 5–2000 characters." };
  try {
    const db = await createClient();
    const { error } = await db.rpc("send_event_review_message", { p_event_id: parsed.data.eventId, p_body: parsed.data.message });
    if (error) return { message: error.code === "22023" ? error.message : "Unable to send this message. Check your access and try again." };
    revalidatePath("/organizer", "layout");
    revalidatePath("/admin", "layout");
    return { success: true, message: "Message sent. The recipient has been notified." };
  } catch { return { message: "Messaging is temporarily unavailable. Please try again." }; }
}

export async function requestEventCorrectionAction(_state: AuthFormState, form: FormData): Promise<AuthFormState> {
  const parsed = z.object({
    eventId:z.string().uuid(),kind:z.enum(["name","description","instructions","clarification","photo"]),
    value:z.string().min(1).max(5000),reason:z.string().trim().min(20).max(1000),
    nomineeId:z.string().uuid().optional(),
  }).safeParse(Object.fromEntries(form));
  if(!parsed.success)return {message:"Enter the proposed correction and a reason of at least 20 characters."};
  try {
    const p=parsed.data;const db=await createClient();
    const {error}=await db.rpc("request_event_correction",{p_event_id:p.eventId,p_kind:p.kind,p_value:p.value,p_reason:p.reason,p_nominee_id:p.nomineeId??null});
    if(error)return {message:error.code==="23505"?"A correction for this item is already awaiting review.":error.code==="22023"?error.message:"Could not submit this correction. Check your access and try again."};
    revalidatePath("/organizer","layout");
    return {success:true,message:"Correction submitted for platform review. The current public details stay unchanged until approved."};
  }catch{return {message:"Correction submission is temporarily unavailable."};}
}

export async function reopenEventAction(_state: AuthFormState, form: FormData): Promise<AuthFormState> {
  const parsed=z.object({eventId:z.string().uuid(),endsAt:z.string().datetime(),reason:z.string().trim().min(20).max(1000),acknowledged:z.literal("yes")}).safeParse(Object.fromEntries(form));
  if(!parsed.success)return {message:"Choose a new deadline, explain the reopening and confirm that existing votes and limits remain."};
  try {
    const p=parsed.data;const db=await createClient();
    const {error}=await db.rpc("reopen_event_voting",{p_event_id:p.eventId,p_ends_at:p.endsAt,p_reason:p.reason});
    if(error)return {message:error.code==="22023"?error.message:"Only owners and admins can reopen eligible expired events."};
    revalidatePath("/organizer","layout");revalidatePath("/events","layout");
    return {success:true,message:"Voting reopened. Your reason and the old and new deadlines are now public."};
  }catch{return {message:"Reopening is temporarily unavailable. Refresh before retrying."};}
}

export async function updatePublicEventAction(_state: AuthFormState, form: FormData): Promise<AuthFormState> {
  const parsed = z.object({
    eventId: z.string().uuid(), name: z.string().trim().min(2).max(160),
    description: z.string().max(5000), votingRules: z.string().max(3000),
    startsAt: z.string().datetime(), endsAt: z.string().datetime(),
    resultsVisibility: z.enum(["live","after_close","hidden","organizer_only"]),
  }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return { message: "Check the event details and dates." };
  const p = parsed.data;
  try {
    const db = await createClient();
    const { error } = await db.rpc("update_event_details", {
      p_event_id: p.eventId, p_name: p.name, p_description: p.description,
      p_voting_rules: p.votingRules, p_starts_at: p.startsAt, p_ends_at: p.endsAt,
      p_results_visibility: p.resultsVisibility,
    });
    if (error) return { message: error.code === "22023" ? error.message : "We could not save this event. Check your access and try again." };
    revalidatePath("/organizer", "layout");
    revalidatePath("/events", "layout");
    return { message: "Event updated. The public page now shows your changes.", success: true };
  } catch { return { message: "Event updates are temporarily unavailable. Please try again." }; }
}

export async function deleteUnusedEventAction(_state: AuthFormState, form: FormData): Promise<AuthFormState> {
  const id = z.string().uuid().safeParse(form.get("eventId"));
  if (!id.success) return { message: "Invalid event." };
  let organizationId: string;
  try {
    const db = await createClient();
    const { data, error } = await db.rpc("delete_unused_event", { p_event_id: id.data });
    if (error || !data) return { message: error?.code === "22023" ? error.message : "This event could not be deleted. Check your access and try again." };
    organizationId = data;
    await cleanupEventImages().catch(() => { console.error("event_image_cleanup_pending"); });
  } catch { return { message: "Deletion is temporarily unavailable. Please refresh before trying again." }; }
  revalidatePath("/organizer", "layout");
  revalidatePath("/events", "layout");
  redirect(`/organizer/${organizationId}/events`);
}
