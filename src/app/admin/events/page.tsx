import { requirePlatformAdmin } from "@/lib/auth/require-platform-admin";
import { AdminEvents } from "@/components/admin/admin-events";

export default async function AdminEventsPage() {
  const { supabase } = await requirePlatformAdmin();
  const { data, error } = await supabase.rpc("get_admin_events", { p_search: null });
  const eventIds = (data ?? []).map((e: { id: string }) => e.id);
  const [
    { data: ticketTierRows },
    { data: eventMetas }
  ] = await Promise.all([
    eventIds.length
      ? supabase.from("event_ticket_tiers").select("event_id").in("event_id", eventIds)
      : Promise.resolve({ data: [] }),
    eventIds.length
      ? supabase.from("events").select("id, image_path").in("id", eventIds)
      : Promise.resolve({ data: [] }),
  ]);

  const imagePaths = [...new Set((eventMetas ?? []).map((m: any) => m.image_path).filter(Boolean))] as string[];
  const { data: signedImages } = imagePaths.length
    ? await supabase.storage.from("nominee-images").createSignedUrls(imagePaths, 3600)
    : { data: [] };
  const imageUrlMap = new Map(
    (signedImages ?? []).flatMap((img) => (img.path && img.signedUrl ? [[img.path, img.signedUrl] as const] : []))
  );
  const metaMap = new Map((eventMetas ?? []).map((m: any) => [m.id, m]));

  const ticketEventSet = new Set((ticketTierRows ?? []).map((r: { event_id: string }) => r.event_id));
  const events = (data ?? []).map((e: { id: string; event_type?: string }) => {
    const meta = metaMap.get(e.id);
    const imageUrl = meta?.image_path ? imageUrlMap.get(meta.image_path) ?? null : null;
    return {
      ...e,
      event_type: e.event_type === "ticketing" || ticketEventSet.has(e.id) ? "ticketing" : e.event_type,
      imageUrl,
    };
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 border-b border-stone-200 pb-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-emerald-800">
          EVENT OVERSIGHT
        </p>
        <h1 className="text-2xl font-serif font-bold tracking-tight text-stone-900 sm:text-3xl">
          Platform Events
        </h1>
        <p className="text-xs text-stone-500 max-w-xl">
          Review submissions awaiting approval, pause voting on live ballots during investigations, and archive ended events.
        </p>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-xs text-red-900">
          Events could not be loaded. Please refresh the page.
        </div>
      ) : (
        <AdminEvents events={events as any} />
      )}
    </div>
  );
}
