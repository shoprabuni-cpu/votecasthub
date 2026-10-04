import "server-only";
import { paymentAdmin } from "@/lib/payments/admin";
export async function cleanupEventImages() {
  const db = paymentAdmin();
  const { data, error } = await db.from("event_image_cleanup").select("path").order("created_at").limit(50);
  if (error) throw error;
  if (!data?.length) return;
  const paths = data.map(row => row.path);
  const { error: removed } = await db.storage.from("nominee-images").remove(paths);
  if (removed) throw removed;
  const { error: cleared } = await db.from("event_image_cleanup").delete().in("path", paths);
  if (cleared) throw cleared;
}
