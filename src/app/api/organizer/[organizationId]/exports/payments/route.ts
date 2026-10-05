import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireVerifiedUser } from "@/lib/auth/require-user";
function csv(value: unknown) { const text = String(value ?? ""); return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text; }
export async function GET(_: Request, { params }: { params: Promise<{ organizationId: string }> }) {
  const { organizationId } = await params; await requireVerifiedUser(); const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_organization_payment_export", { p_org: organizationId }); if (error) return NextResponse.json({ error: "Unable to export payments" }, { status: 403 });
  const lines = [["Reference","Event","Created at","Status","Gross (minor)","Refunded (minor)","Provider fee (minor)","Platform fee (minor)","Organizer net (minor)"], ...(data ?? []).map((row: Record<string, unknown>) => [row.reference,row.event_name,row.created_at,row.status,row.gross_minor,row.refunded_minor,row.provider_fee_minor,row.platform_fee_minor,row.net_minor])].map((row) => row.map(csv).join(","));
  return new NextResponse(lines.join("\n"), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": "attachment; filename=\"votecasthub-payments.csv\"", "Cache-Control": "no-store" } });
}
