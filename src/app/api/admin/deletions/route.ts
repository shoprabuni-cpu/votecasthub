import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("request"), kind: z.enum(["event", "organization"]), targetId: z.uuid(), confirmationName: z.string().max(160), reason: z.string().trim().min(20).max(1000) }),
  z.object({ action: z.literal("cancel"), jobId: z.uuid(), reason: z.string().trim().min(5).max(1000) }),
]);

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const parsed = z.object({ kind: z.enum(["event", "organization"]), targetId: z.uuid() }).safeParse({ kind: params.get("kind"), targetId: params.get("targetId") });
  if (!parsed.success) return Response.json({ error: "Check the export target." }, { status: 400 });
  const supabase = await createClient();
  const { data: claims, error: authError } = await supabase.auth.getClaims();
  if (authError || typeof claims?.claims?.sub !== "string") return Response.json({ error: "Sign in to continue." }, { status: 401 });
  const { data, error } = await supabase.rpc("get_admin_deletion_snapshot", { p_kind: parsed.data.kind, p_id: parsed.data.targetId });
  if (error) return Response.json({ error: "Results snapshot could not be exported." }, { status: error.code === "42501" ? 403 : error.code === "P0002" ? 404 : 500 });
  return Response.json(data, { headers: {
    "Content-Disposition": `attachment; filename="${parsed.data.kind}-${parsed.data.targetId}-results.json"`,
    "Cache-Control": "private, no-store",
  } });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: claims, error: authError } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (authError || typeof userId !== "string") return Response.json({ error: "Sign in to continue." }, { status: 401 });
  const { data: admin } = await supabase.from("platform_admins").select("role").eq("user_id", userId).eq("is_active", true).maybeSingle();
  if (admin?.role !== "admin") return Response.json({ error: "Only platform administrators can delete data." }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Check the confirmation name and reason." }, { status: 400 });
  const input = parsed.data;
  const { data, error } = input.action === "request"
    ? await supabase.rpc("admin_request_deletion", { p_kind: input.kind, p_id: input.targetId, p_confirmation_name: input.confirmationName, p_reason: input.reason })
    : await supabase.rpc("admin_cancel_deletion", { p_job: input.jobId, p_reason: input.reason });
  if (error) {
    const statuses: Record<string, number> = { "42501": 403, "22023": 409, P0002: 404, "23505": 409 };
    return Response.json({ error: statuses[error.code] ? error.message : "Deletion could not be updated." }, { status: statuses[error.code] ?? 500 });
  }
  revalidatePath("/admin", "layout");
  revalidatePath("/organizer", "layout");
  revalidatePath("/events", "layout");
  revalidatePath("/");
  return Response.json({ ok: true, ...(input.action === "request" ? data : {}) });
}
