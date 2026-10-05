import Link from "next/link";
import { requireVerifiedUser } from "@/lib/auth/require-user";
import { DashboardHeader } from "@/components/dashboard-header";
import { CsvExportButton } from "@/components/payments/csv-export-button";
import { ExportCenter } from "@/components/organizer/export-center";
import { AnalyticsVisuals } from "@/components/organizer/analytics-visuals";

export default async function AnalyticsPage({ params }: { params: Promise<{ organizationId: string }> }) {
  const { organizationId } = await params;
  const { supabase } = await requireVerifiedUser();
  const { data: analytics, error } = await supabase.rpc("get_organization_event_analytics", { p_org: organizationId });
  if (error) return <main className="dashboard-page"><DashboardHeader organizationId={organizationId}/><section className="dashboard-content"><h1>Analytics unavailable</h1><Link href={`/organizer/${organizationId}/events`}>Return to events</Link></section></main>;
  type AnalyticsRow = { event_id: string; event_name: string; status: string; total_votes: number; paid_votes: number; gross_minor: number; net_minor: number };
  const rows = (analytics ?? []) as AnalyticsRow[];
  const totalVotes = rows.reduce((sum, row) => sum + Number(row.total_votes ?? 0), 0);
  const gross = rows.reduce((sum, row) => sum + Number(row.gross_minor ?? 0), 0);
  const net = rows.reduce((sum, row) => sum + Number(row.net_minor ?? 0), 0);
  const maxVotes = Math.max(1, ...rows.map((row) => Number(row.total_votes ?? 0)));
  return <main className="dashboard-page"><DashboardHeader organizationId={organizationId}/><section className="dashboard-content analytics-page">
    <div className="workspace-page-head"><div><p className="eyebrow">ORGANIZER ANALYTICS</p><h1>See how your events are performing.</h1><p>Votes and paid revenue across this organization.</p></div><CsvExportButton organizationId={organizationId} /></div>
    <section className="analytics-summary" aria-label="Organization totals"><article><span>Total votes</span><strong>{totalVotes.toLocaleString()}</strong></article><article><span>Gross revenue</span><strong>GHS {(gross / 100).toFixed(2)}</strong></article><article><span>Organizer net</span><strong>GHS {(net / 100).toFixed(2)}</strong></article></section>
    <section className="analytics-panel"><div className="analytics-panel-head"><div><h2>Event performance</h2><p>Paid votes are shown after refunds and reversals.</p></div><span>{rows.length} events</span></div>{rows.length ? <div className="analytics-table-wrap"><table className="analytics-table"><thead><tr><th>Event</th><th>Status</th><th>Votes</th><th>Paid votes</th><th>Gross</th><th>Net</th></tr></thead><tbody>{rows.map((row) => <tr key={row.event_id}><td><strong>{row.event_name}</strong><div className="analytics-bar"><i style={{ width: `${Math.round((Number(row.total_votes ?? 0) / maxVotes) * 100)}%` }} /></div></td><td><span className={`status-pill status-${row.status}`}>{row.status}</span></td><td>{Number(row.total_votes ?? 0).toLocaleString()}</td><td>{Number(row.paid_votes ?? 0).toLocaleString()}</td><td>GHS {(Number(row.gross_minor ?? 0) / 100).toFixed(2)}</td><td>GHS {(Number(row.net_minor ?? 0) / 100).toFixed(2)}</td></tr>)}</tbody></table></div> : <div className="empty-state"><h2>No event activity yet</h2><p>Create an event and votes will appear here.</p></div>}</section>
  <AnalyticsVisuals rows={rows}/><ExportCenter organizationId={organizationId}/></section></main>;
}
