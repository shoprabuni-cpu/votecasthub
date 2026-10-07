import { NextResponse } from "next/server";
import { requireVerifiedUser } from "@/lib/auth/require-user";
import { analyticsScope, csvValue, type OrganizerAnalytics } from "@/lib/analytics";

export async function GET(request: Request, { params }: { params: Promise<{ organizationId: string; kind: string }> }) {
  const { organizationId, kind } = await params;
  if (!["votes", "nominees", "refunds", "settlements", "sms", "moderation"].includes(kind)) return NextResponse.json({ error: "Unsupported export" }, { status: 400 });
  if (kind === "moderation") return NextResponse.json({ error: "Moderation records are restricted to platform administrators" }, { status: 403 });
  const query = new URL(request.url).searchParams;
  let scope: ReturnType<typeof analyticsScope>;
  try { scope = analyticsScope({ event: query.get("event") ?? undefined, range: query.get("range") ?? undefined }); } catch { return NextResponse.json({ error: "Invalid event filter" }, { status: 400 }); }
  const { supabase } = await requireVerifiedUser();
  // The checked RPC validates membership and ownership, including for direct URLs.
  const { data: overview, error: scopeError } = await supabase.rpc("get_scoped_organizer_analytics", { p_org: organizationId, ...scope.params });
  if (scopeError || !overview) return NextResponse.json({ error: "Unable to load export scope" }, { status: scopeError?.code === "42501" ? 403 : 503 });
  let rows: Record<string, unknown>[] = [];
  let headers: string[];
  if (kind === "votes" || kind === "refunds" || kind === "settlements") {
    const { data, error } = await supabase.rpc(kind === "votes" ? "get_scoped_vote_export" : "get_scoped_payment_export", { p_org: organizationId, ...scope.params });
    if (error) return NextResponse.json({ error: "Export unavailable" }, { status: 503 });
    rows = (data ?? []) as Record<string, unknown>[];
    if (kind === "refunds") rows = rows.filter(row => Number(row.refunded_minor) > 0);
    // Preserve old URLs, but identify these as earnings, not actual payouts.
    headers = kind === "votes" ? ["batch_id", "event_id", "event_name", "category_name", "nominee_name", "created_at", "recorded_votes", "valid_votes", "paid"] : ["reference", "event_id", "event_name", "created_at", "status", "gross_minor", "refunded_minor", "net_minor"];
  } else if (kind === "nominees") {
    rows = (overview as OrganizerAnalytics).nominees;
    headers = ["event_id", "event_name", "category_id", "category_name", "nominee_id", "nominee_name", "total_votes", "paid_votes"];
  } else {
    if (kind === "sms" && scope.event) return NextResponse.json({ error: "SMS credits are organization-wide; select organization overview" }, { status: 400 });
    headers = ["entry_type", "reference", "credits", "amount_minor", "refunded_minor", "status", "created_at"];
    const { data, error } = await supabase.rpc("get_scoped_sms_export", { p_org: organizationId, p_days: scope.days });
    if (error) return NextResponse.json({ error: "Export unavailable" }, { status: 503 });
    rows = (data ?? []) as Record<string, unknown>[];
  }
  const csv = [headers, ...rows.map(row => headers.map(header => row[header]))].map(row => row.map(csvValue).join(",")).join("\r\n");
  return new NextResponse(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="votecasthub-${kind === "settlements" ? "earnings" : kind}-${scope.days}days.csv"`, "Cache-Control": "private, no-store" } });
}
