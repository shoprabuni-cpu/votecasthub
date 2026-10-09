import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies, headers } from "next/headers";
import { isIP } from "node:net";
import { createClient } from "@/lib/supabase/server";

/** Auth-only client: the secret key and forwarded address never reach the browser. */
export async function createVoterAuth() {
  const key = process.env.SUPABASE_SECRET_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const ip = (await headers()).get("x-vercel-forwarded-for")?.split(",")[0].trim();
  // Forward only Vercel's trusted header; legacy keys cannot use this feature.
  if (!key?.startsWith("sb_secret_") || !url || !ip || !isIP(ip)) return (await createClient()).auth;
  const store = await cookies();
  const client = createServerClient(url, key, {
    global: { headers: { "Sb-Forwarded-For": ip } },
    cookies: {
      getAll: () => store.getAll(),
      setAll: values => { for (const { name, value, options } of values) store.set(name, value, options); },
    },
  });
  return client.auth;
}
