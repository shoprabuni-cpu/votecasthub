import Link from "next/link";
import { requirePlatformAdmin } from "@/lib/auth/require-platform-admin";

export default async function AdminEventDetail({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const { supabase } = await requirePlatformAdmin();
  const { data, error } = await supabase.rpc("get_admin_event_detail", { p_event_id: eventId });
  const rows = data ?? [];
  if (error || !rows.length) return <section className="admin-empty"><h2>Event details unavailable</h2><p>Apply the latest Supabase migrations, then try again.</p><Link className="button button-secondary" href="/admin/events">Back to events</Link></section>;
  const event = rows[0];
  const categories = new Map<string, { name: string; active: boolean; nominees: { id: string; name: string; active: boolean }[] }>();
  for (const row of rows) if (row.category_id) { const category: { name: string; active: boolean; nominees: { id: string; name: string; active: boolean }[] } = categories.get(row.category_id) ?? { name: row.category_name, active: row.category_active, nominees: [] }; if (row.nominee_id) category.nominees.push({ id: row.nominee_id, name: row.nominee_name, active: row.nominee_active }); categories.set(row.category_id, category); }
  return <><header className="admin-page-head"><div><p className="eyebrow">EVENT DETAIL</p><h1>{event.event_name}</h1><p>{event.organization_name} · <span className={`status-pill status-${event.event_status}`}>{event.event_status}</span></p></div><Link className="button button-secondary" href="/admin/events">← Events</Link></header><section className="admin-summary">{[["Voting mode",event.voting_mode], ["Starts",new Date(event.starts_at).toLocaleString("en-GH")], ["Ends",new Date(event.ends_at).toLocaleString("en-GH")], ["Categories",categories.size]].map(([label,value])=><article key={String(label)}><span>{label}</span><strong>{value}</strong></article>)}</section><section className="admin-review-card"><h2>Description</h2><p>{event.description || "No description provided."}</p></section><section className="admin-queue">{Array.from(categories.values()).map(category=><article className="admin-review-card" key={category.name}><div className="admin-review-meta"><h2>{category.name}</h2><span>{category.active ? "Active" : "Hidden"}</span></div>{category.nominees.length ? <ul>{category.nominees.map(n=><li key={n.id}>{n.name} · {n.active ? "Active" : "Hidden"}</li>)}</ul> : <p>No nominees.</p>}</article>)}</section></>;
}

