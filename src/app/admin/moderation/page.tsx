import { requirePlatformAdmin } from "@/lib/auth/require-platform-admin";
import { ModerationQueue } from "@/components/admin/moderation-queue";
export default async function ModerationPage(){const {supabase}=await requirePlatformAdmin();const {data}=await supabase.rpc("get_admin_moderation_flags");return <><header className="admin-page-head"><div><p className="eyebrow">SAFETY &amp; TRUST</p><h1>Moderation queue</h1><p>Review suspicious activity and organizer risk signals.</p></div><span className="admin-count">{data?.length??0} open</span></header><ModerationQueue flags={data??[]}/></>}
