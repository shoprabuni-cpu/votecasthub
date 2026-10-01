import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/auth/form-state";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeNextPath(url.searchParams.get("next"));
  let confirmed = false;

  if (code) {
    try {
      const supabase = await createClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      confirmed = !error;
    } catch {
      confirmed = false;
    }
  }

  if (confirmed) redirect(next);
  if (next.split(/[?#]/, 1)[0] === "/reset-password") redirect("/forgot-password?notice=reset-failed");
  redirect("/sign-in?notice=confirmation-failed");
}
