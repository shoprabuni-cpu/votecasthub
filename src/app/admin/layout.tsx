import type { ReactNode } from "react";
import { PRIVATE_ROBOTS } from "@/lib/seo/metadata";
export const metadata = { robots: PRIVATE_ROBOTS };
import { requirePlatformAdmin } from "@/lib/auth/require-platform-admin";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { NotificationBell } from "@/components/notifications/notification-bell";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const { supabase, userId } = await requirePlatformAdmin();
  const { data: notifications } = await supabase.from("notifications").select("id,title,body,read_at,created_at,organization_id,event_id").eq("user_id", userId).order("created_at", { ascending: false }).limit(20);

  return (
    <div className="min-h-screen bg-stone-50/70 text-stone-900 antialiased selection:bg-emerald-500/20 selection:text-emerald-900 flex flex-col md:flex-row">
      <AdminSidebar />
      <main className="flex-1 md:pl-64 min-w-0">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
          <div className="flex justify-end"><NotificationBell notifications={notifications ?? []} admin /></div>
          {children}
        </div>
      </main>
    </div>
  );
}
