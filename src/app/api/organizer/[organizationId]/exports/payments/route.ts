import { NextResponse } from "next/server";
import { requireVerifiedUser } from "@/lib/auth/require-user";
import { analyticsScope, csvValue } from "@/lib/analytics";

export async function GET(request: Request, { params }: { params: Promise<{ organizationId: string }> }) {
  const { organizationId } = await params;
  const query = new URL(request.url).searchParams;
  let scope: ReturnType<typeof analyticsScope>;
  try { scope = analyticsScope({ event: query.get("event") ?? undefined, range: query.get("range") ?? undefined }); } catch { return NextResponse.json({ error: "Invalid event filter" }, { status: 400 }); }
  const { supabase } = await requireVerifiedUser();
  const { data, error } = await supabase.rpc("get_scoped_payment_export", { p_org: organizationId, ...scope.params });
  if (error) return NextResponse.json({ error: "Unable to export payments" }, { status: error.code === "42501" ? 403 : 503 });
  const headers = ["reference", "event_id", "event_name", "created_at", "status", "gross_minor", "refunded_minor", "net_minor"];
  const rows = (data ?? []) as Record<string, unknown>[];
  const csv = [headers, ...rows.map(row => headers.map(header => row[header]))].map(row => row.map(csvValue).join(",")).join("\r\n");
  return new NextResponse(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="votecasthub-payments-${scope.days}days.csv"`, "Cache-Control": "private, no-store" } });
}
