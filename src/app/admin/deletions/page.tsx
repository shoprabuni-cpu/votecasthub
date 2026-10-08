import Link from "next/link";
import { requirePlatformAdmin } from "@/lib/auth/require-platform-admin";
import type { DeletionJob } from "@/lib/admin/deletion";

export default async function AdminDeletionsPage() {
  const { supabase } = await requirePlatformAdmin();
  const { data, error } = await supabase.from("admin_deletion_jobs").select("id,target_kind,target_id,target_name,status,scheduled_for,created_at,completed_at,attempts,last_error,reason,result").order("status", { ascending: false }).order("created_at", { ascending: false }).limit(100);
  const jobs = (data ?? []) as DeletionJob[];
  return <div className="space-y-6">
    <div><h1 className="text-2xl font-serif font-bold">Data deletion</h1><p className="mt-2 text-sm text-stone-600">Review scheduled purges and their outcomes. Cancel pending deletion from the event or organization profile. Completed purges cannot be undone here.</p></div>
    {error ? <p role="status" className="text-sm text-red-800">Deletion history could not be loaded.</p> : !jobs.length ? <p className="text-sm text-stone-500">No deletions requested.</p> : <div className="space-y-3">{jobs.map((job) => <article key={job.id} className="space-y-2 rounded-xl border border-stone-200 bg-white p-4">
      <div className="flex justify-between gap-3"><h2 className="font-semibold">{job.target_name}</h2><span className="text-xs capitalize">{job.status}</span></div>
      <p className="text-sm text-stone-600">{job.reason}</p>
      <p className="text-xs text-stone-500">{job.target_kind} · Scheduled {new Date(job.scheduled_for).toLocaleString("en-GH", { timeZone: "Africa/Accra" })} · Attempts: {job.attempts}</p>
      {job.last_error && <p role="status" className="text-xs text-amber-900">{job.last_error} — queued for retry.</p>}
      {job.status === "completed" && <p className="text-xs text-stone-500">{job.result?.retained_reference ? "Disposable data purged; historical reference retained." : "Item physically deleted."} Image cleanup continues until successful.</p>}
      {job.status === "pending" && <Link className="text-xs font-semibold text-emerald-800 underline" href={job.target_kind === "event" ? `/admin/events/${job.target_id}` : `/admin/organizers/${job.target_id}`}>Review or cancel deletion</Link>}
    </article>)}</div>}
  </div>;
}
