import { requirePlatformAdmin } from "@/lib/auth/require-platform-admin";
import { ModerationQueue } from "@/components/admin/moderation-queue";

export default async function ModerationPage() {
  const { supabase } = await requirePlatformAdmin();
  const { data } = await supabase.rpc("get_admin_moderation_flags");

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 border-b border-stone-200 pb-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-emerald-800">
          SAFETY &amp; TRUST
        </p>
        <h1 className="text-2xl font-serif font-bold tracking-tight text-stone-900 sm:text-3xl">
          Moderation &amp; Risk Signals
        </h1>
        <p className="text-xs text-stone-500 max-w-xl">
          Inspect automated risk triggers, abnormal voting spikes, payment disputes, and apply organizer access restrictions.
        </p>
      </div>

      <ModerationQueue flags={data ?? []} />
    </div>
  );
}
