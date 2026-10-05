import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
export async function requirePlatformAdmin() {
  const { supabase, userId } = await (async () => { const client = await createClient(); const { data, error } = await client.auth.getClaims(); const id = data?.claims?.sub; if (error || typeof id !== "string") redirect("/sign-in"); return { supabase: client, userId: id }; })();
  const { data } = await supabase.from("platform_admins").select("role").eq("user_id", userId).eq("is_active", true).maybeSingle();
  if (!data) redirect("/organizer");
  return { supabase, userId, role: data.role };
}
