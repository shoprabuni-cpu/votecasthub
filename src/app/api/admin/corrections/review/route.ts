import { NextResponse } from "next/server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
export async function POST(request: Request) {
  const parsed = z.object({ id: z.uuid(), approve: z.boolean(), note: z.string().trim().min(20).max(1000) }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Provide a review note of 20–1000 characters explaining the identity and fairness checks." }, { status: 400 });
  const db = await createClient();
  const { data: claims, error: authError } = await db.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (authError || typeof userId !== "string") return NextResponse.json({ error: "Sign in again before reviewing a correction." }, { status: 401 });
  const { data: admin, error: adminError } = await db.from("platform_admins").select("role").eq("user_id", userId).eq("is_active", true).maybeSingle();
  if (adminError) return NextResponse.json({ error: "Unable to verify admin access." }, { status: 503 });
  if (!admin) return NextResponse.json({ error: "Platform admin access is required." }, { status: 403 });
  const { error } = await db.rpc("admin_review_event_correction", { p_request_id: parsed.data.id, p_approve: parsed.data.approve, p_note: parsed.data.note });
  if (error) {
    const expected = error.code === "22023" || (error.code === "P0001" && ["Correction is not reviewable", "The original has changed. Reject this stale request and request a new correction"].includes(error.message));
    if (expected) return NextResponse.json({ error: error.message }, { status: 409 });
    if (error.code === "42501") return NextResponse.json({ error: "Your access or the organization's current status prevents this correction." }, { status: 403 });
    console.error("Correction review failed", { code: error.code, message: error.message });
    return NextResponse.json({ error: "Unable to review this correction. Please try again." }, { status: 500 });
  }
  revalidatePath("/admin", "layout");revalidatePath("/organizer", "layout");revalidatePath("/events", "layout");revalidatePath("/");
  return NextResponse.json({ ok: true });
}
