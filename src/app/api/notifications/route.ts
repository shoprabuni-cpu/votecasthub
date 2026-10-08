import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const db = await createClient();
  const { data, error } = await db.auth.getClaims();
  const userId = data?.claims?.sub;
  if (error || typeof userId !== "string") return NextResponse.json({ error: "Sign in to view notifications." }, { status: 401 });
  const organizationId = new URL(request.url).searchParams.get("organizationId");
  if (organizationId && !z.uuid().safeParse(organizationId).success) return NextResponse.json({ error: "Invalid organization." }, { status: 400 });
  let query = db.from("notifications").select("id,title,body,read_at,created_at,organization_id,event_id").eq("user_id", userId).order("created_at", { ascending: false }).limit(20);
  if (organizationId) query = query.eq("organization_id", organizationId);
  const { data: notifications, error: queryError } = await query;
  if (queryError) return NextResponse.json({ error: "Notifications are temporarily unavailable." }, { status: 503 });
  return NextResponse.json({ notifications }, { headers: { "Cache-Control": "no-store" } });
}
