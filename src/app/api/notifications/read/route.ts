import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
export async function POST(request: Request) {
  const parsed = z.object({ id: z.uuid() }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid notification." }, { status: 400 });
  const db = await createClient();
  const { data, error: authError } = await db.auth.getClaims();
  const userId = data?.claims?.sub;
  if (authError || typeof userId !== "string") return NextResponse.json({ error: "Sign in to update notifications." }, { status: 401 });
  const { error } = await db.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", parsed.data.id).eq("user_id", userId);
  if (error) return NextResponse.json({ error: "Unable to update this notification." }, { status: 503 });
  return NextResponse.json({ ok: true });
}
