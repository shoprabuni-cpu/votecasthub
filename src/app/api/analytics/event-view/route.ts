import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";
const viewSchema = z.object({ eventId: z.string().uuid(), visitorHash: z.string().min(16).max(128) });
export async function POST(request: Request) {
  const parsed = viewSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });
  const db = await createClient();
  const { error } = await db.rpc("record_event_view", { p_event_id: parsed.data.eventId, p_visitor_hash: parsed.data.visitorHash });
  return NextResponse.json({ ok: !error }, { status: error ? 503 : 200, headers: { "Cache-Control": "no-store" } });
}
