import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("close"), organizationId: z.uuid(), confirmationName: z.string().min(2).max(120), note: z.string().trim().min(20).max(1000), requestId: z.uuid().optional() }),
  z.object({ action: z.literal("reject"), organizationId: z.uuid(), requestId: z.uuid(), note: z.string().trim().min(5).max(1000) }),
]);

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: claims, error: authError } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (authError || typeof userId !== "string") return Response.json({ error: "Sign in to continue." }, { status: 401 });
  const { data: admin } = await supabase.from("platform_admins").select("role").eq("user_id", userId).eq("is_active", true).maybeSingle();
  if (!admin || !["admin", "moderator"].includes(admin.role)) return Response.json({ error: "Platform administrator access required." }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Check the organization, confirmation name, and review reason." }, { status: 400 });
  const input = parsed.data;
  if (input.action === "close" && admin.role !== "admin") return Response.json({ error: "Only platform administrators can permanently close organizations." }, { status: 403 });
  const { error } = input.action === "close"
    ? await supabase.rpc("admin_close_organization", { p_org: input.organizationId, p_confirmation_name: input.confirmationName, p_note: input.note, p_request_id: input.requestId ?? null })
    : await supabase.rpc("admin_reject_organization_closure", { p_request_id: input.requestId, p_note: input.note });
  if (error) {
    const statuses: Record<string, number> = { "42501": 403, "22023": 409, P0002: 404, "23505": 409 };
    return Response.json({ error: statuses[error.code] ? error.message : "Organization review could not be completed." }, { status: statuses[error.code] ?? 500 });
  }
  revalidatePath("/admin/organizers");
  revalidatePath(`/admin/organizers/${input.organizationId}`);
  revalidatePath("/organizer", "layout");
  revalidatePath("/events", "layout");
  revalidatePath("/");
  return Response.json({ ok: true });
}
