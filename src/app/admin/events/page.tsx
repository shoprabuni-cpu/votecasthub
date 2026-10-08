import { requirePlatformAdmin } from "@/lib/auth/require-platform-admin";
import { AdminEvents } from "@/components/admin/admin-events";

export default async function AdminEventsPage() {
  const { supabase } = await requirePlatformAdmin();
  const { data, error } = await supabase.rpc("get_admin_events", { p_search: null });

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
        <AdminEvents events={data ?? []} />
      )}
    </div>
  );
}
