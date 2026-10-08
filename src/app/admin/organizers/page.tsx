import { requirePlatformAdmin } from "@/lib/auth/require-platform-admin";
import { OrganizerQueue } from "@/components/admin/organizer-queue";

export default async function AdminOrganizersPage() {
  const { supabase } = await requirePlatformAdmin();
  const { data, error } = await supabase.rpc("get_admin_organizations");

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="border-b border-stone-200 pb-6">
        <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-1">
          Organizers
        </p>
        <h1 className="text-2xl font-serif font-bold text-stone-900 sm:text-3xl">
          Organizer Accounts
        </h1>
        <p className="mt-1 text-sm text-stone-500">
          Review access, event activity, and Paystack onboarding status.
        </p>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-800">
          <strong>Data unavailable.</strong> Organizer data could not be loaded.
          Apply the latest Supabase migrations, then refresh.
        </div>
      ) : (
        <OrganizerQueue organizers={data ?? []} />
      )}
    </div>
  );
}
