import { NextResponse } from "next/server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const parsed = z.object({ id: z.uuid(), reason: z.string().trim().min(5).max(1000) }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Select an event and explain the required changes in 5–1000 characters." }, { status: 400 });
  const db = await createClient();
  const { data: claims, error: authError } = await db.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (authError || typeof userId !== "string") return NextResponse.json({ error: "Sign in again before returning an event." }, { status: 401 });
  const { data: admin, error: adminError } = await db.from("platform_admins").select("role").eq("user_id", userId).eq("is_active", true).maybeSingle();
  if (adminError) return NextResponse.json({ error: "Unable to verify admin access. Try again." }, { status: 503 });
  if (!admin) return NextResponse.json({ error: "Platform admin access is required." }, { status: 403 });
  const { error } = await db.rpc("admin_reject_event", { p_event_id: parsed.data.id, p_reason: parsed.data.reason });
  if (error) {
    if (error.code === "22023" || error.code === "P0002") return NextResponse.json({ error: error.message }, { status: error.code === "P0002" ? 404 : 409 });
    if (error.code === "42501") return NextResponse.json({ error: "Your access or the organization's current status prevents returning this event." }, { status: 403 });
    console.error("Event return failed", { code: error.code, message: error.message });
    return NextResponse.json({ error: "Unable to return this event. Please try again." }, { status: 500 });
  }
  revalidatePath("/organizer", "layout");
  revalidatePath("/admin", "layout");
  revalidatePath("/events", "layout");
  revalidatePath("/");
  return NextResponse.json({ ok: true });
}
