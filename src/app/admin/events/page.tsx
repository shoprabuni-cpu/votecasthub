import { requirePlatformAdmin } from "@/lib/auth/require-platform-admin";
import { AdminEvents } from "@/components/admin/admin-events";
export default async function AdminEventsPage(){const {supabase}=await requirePlatformAdmin();const {data}=await supabase.rpc("get_admin_events",{p_search:null});return <><header className="admin-page-head"><div><p className="eyebrow">MODERATION</p><h1>Events</h1><p>Review event status and intervene when needed.</p></div></header><AdminEvents events={data??[]}/></>}
