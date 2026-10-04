"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { AuthFormState } from "@/lib/auth/form-state";
import { cleanupEventImages } from "./image-cleanup";

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
