import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { WorkspaceSidebar } from "@/components/organizations/workspace-sidebar";
import { requireVerifiedUser } from "@/lib/auth/require-user";
import { NotificationBell } from "@/components/notifications/notification-bell";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function OrganizationWorkspaceLayout({ children, params }: { children: ReactNode; params: Promise<unknown> }) {
  const routeParams = await params;
  if (!routeParams || typeof routeParams !== "object" || !("organizationId" in routeParams) || typeof routeParams.organizationId !== "string") notFound();
  const organizationId = routeParams.organizationId;
  if (!uuidPattern.test(organizationId)) notFound();
  const { supabase, userId } = await requireVerifiedUser();
  const [{ data: organization }, { data: membership }, { data: notifications }] = await Promise.all([
    supabase.from("organizations").select("id, name").eq("id", organizationId).maybeSingle(),
    supabase.from("organization_members").select("role").eq("organization_id", organizationId).eq("user_id", userId).maybeSingle(),
    supabase.from("notifications").select("id,title,body,read_at,created_at").eq("user_id", userId).eq("organization_id", organizationId).order("created_at", { ascending: false }).limit(12),
  ]);
  if (!organization || !membership) notFound();

  return <div className="workspace-frame"><WorkspaceSidebar organizationId={organizationId} organizationName={organization.name} role={membership.role}/><div className="workspace-content"><div className="workspace-notification-bar"><NotificationBell notifications={notifications ?? []}/></div>{children}</div></div>;
}
