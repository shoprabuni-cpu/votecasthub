import type { ReactNode } from "react";
import { requirePlatformAdmin } from "@/lib/auth/require-platform-admin";
import { AdminSidebar } from "@/components/admin/admin-sidebar";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requirePlatformAdmin();

  return (
    <div className="min-h-screen bg-stone-50/70 text-stone-900 antialiased selection:bg-emerald-500/20 selection:text-emerald-900 flex flex-col md:flex-row">
      <AdminSidebar />
      <main className="flex-1 md:pl-64 min-w-0">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
          {children}
        </div>
      </main>
    </div>
  );
}
