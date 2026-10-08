import { NextResponse } from "next/server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const parsed = z.object({ id: z.uuid() }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "A valid event ID is required." }, { status: 400 });
  const supabase = await createClient();
  const { data: claims, error: authError } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (authError || typeof userId !== "string") return NextResponse.json({ error: "Sign in again before approving an event." }, { status: 401 });
  const { data: admin, error: adminError } = await supabase.from("platform_admins").select("role").eq("user_id", userId).eq("is_active", true).maybeSingle();
  if (adminError) return NextResponse.json({ error: "Unable to verify admin access. Try again." }, { status: 503 });
  if (!admin) return NextResponse.json({ error: "Platform admin access is required." }, { status: 403 });
  const { error } = await supabase.rpc("admin_approve_event", { p_event_id: parsed.data.id, p_note: "Approved in platform review" });
  if (error) {
    if (error.code === "22023" || error.code === "P0002" || (error.code === "P0001" && error.message === "Event is not awaiting review")) {
      return NextResponse.json({ error: error.message }, { status: error.code === "P0002" ? 404 : 409 });
    }
    if (error.code === "42501") {
      const known = ["Platform admin access required", "This organization is restricted, suspended, or closed", "This workspace or event is scheduled for deletion or already purged"];
      return NextResponse.json({ error: known.includes(error.message) ? error.message : "Approval is blocked by database permissions. Please contact support." }, { status: 403 });
    }
    console.error("Event approval failed", { code: error.code, message: error.message });
    return NextResponse.json({ error: "Approval failed. Please try again or contact support." }, { status: 500 });
  }
  revalidatePath("/");
  revalidatePath("/events");
  revalidatePath("/admin");
  revalidatePath("/admin/events");
  revalidatePath("/events/[slug]", "page");
  revalidatePath("/organizer");
  revalidatePath("/organizer/events", "layout");
  return NextResponse.json({ ok: true });
}
