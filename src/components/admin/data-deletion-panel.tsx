import { createClient } from "@/lib/supabase/server";
import { DataDeletionControls } from "@/components/admin/data-deletion-controls";
import type { DeletionKind, DeletionPreview } from "@/lib/admin/deletion";

export async function DataDeletionPanel({ kind, targetId, role }: { kind: DeletionKind; targetId: string; role: string }) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_admin_deletion_preview", { p_kind: kind, p_id: targetId });
  if (error || !data) return <p role="status" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">Deletion preview could not be loaded. Apply the latest database migration and refresh.</p>;
  return <DataDeletionControls kind={kind} targetId={targetId} preview={data as DeletionPreview} canDelete={role === "admin"} />;
}
