import "server-only";
import { createClient } from "@supabase/supabase-js";
import { requirePlatformAdmin } from "@/lib/auth/require-platform-admin";

export type AdminOrganizer = {
  id: string;
  name: string;
  moderation_status: string;
  event_count: number;
  paystack_status: string;
  paystack_verified: boolean;
};

type OrganizerRecord = {
  id: string;
  name: string;
  moderation_status: string;
  events: { count: number }[];
  organization_paystack_accounts: { status: string; paystack_verified: boolean } | { status: string; paystack_verified: boolean }[] | null;
};

export async function loadAdminOrganizers() {
  // Verify the signed-in administrator before using server credentials.
  const access = await requirePlatformAdmin();
  const result = await access.supabase.rpc("get_admin_organizations");
  if (!result.error && result.data?.length) {
    return { ...access, organizers: result.data as AdminOrganizer[], error: false };
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("admin_organizers_fallback_unconfigured", { rpcCode: result.error?.code });
    return { ...access, organizers: [] as AdminOrganizer[], error: true };
  }
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  // A left relationship keeps organizers visible when they have no current events.
  const fallback = await db.from("organizations")
    .select("id,name,moderation_status,events(count),organization_paystack_accounts(status,paystack_verified)")
    .is("purged_at", null).is("events.purged_at", null)
    .order("created_at", { ascending: false }).limit(500);
  if (fallback.error) {
    console.error("admin_organizers_load_failed", { rpcCode: result.error?.code, fallbackCode: fallback.error.code });
    return { ...access, organizers: [] as AdminOrganizer[], error: true };
  }
  const organizers = (fallback.data as unknown as OrganizerRecord[]).map((record) => {
    const account = Array.isArray(record.organization_paystack_accounts)
      ? record.organization_paystack_accounts[0] : record.organization_paystack_accounts;
    return {
      id: record.id, name: record.name, moderation_status: record.moderation_status,
      event_count: record.events[0]?.count ?? 0,
      paystack_status: account?.status ?? "not_connected",
      paystack_verified: account?.paystack_verified ?? false,
    };
  });
  return { ...access, organizers, error: false };
}
