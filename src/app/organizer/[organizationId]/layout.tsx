import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { WorkspaceShell } from "@/components/organizations/workspace-shell";
import { requireVerifiedUser } from "@/lib/auth/require-user";


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
    supabase.from("notifications").select("id,title,body,read_at,created_at,organization_id,event_id").eq("user_id", userId).eq("organization_id", organizationId).order("created_at", { ascending: false }).limit(20),
  ]);
  if (!organization || !membership) notFound();

  return <WorkspaceShell organizationId={organizationId} organizationName={organization.name} role={membership.role} notifications={notifications ?? []}>{children}</WorkspaceShell>;
}
