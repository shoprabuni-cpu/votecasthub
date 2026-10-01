import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function requireVerifiedUser() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (error || typeof userId !== "string") redirect("/sign-in");
  return { supabase, userId };
}
