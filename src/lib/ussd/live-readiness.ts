import "server-only";

type ReadinessCheck = { label: string; ready: boolean; purchase: boolean };
export function ussdLiveReadiness(env: NodeJS.ProcessEnv = process.env) {
  const checks: ReadinessCheck[] = [];
  const add = (label: string, ready: unknown, purchase = false) => checks.push({ label, ready: Boolean(ready), purchase });
  const https = (value?: string) => { try { return new URL(value ?? "").protocol === "https:"; } catch { return false; } };
  const live = env.VERCEL_ENV === "production";
  add("Live Supabase URL", https(env.NEXT_PUBLIC_SUPABASE_URL) && !env.NEXT_PUBLIC_SUPABASE_URL?.includes("mpajnwllttagglxnlekf"));
  add("Supabase public key", env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim());
  add("Server database key", env.SUPABASE_SECRET_KEY?.trim() || env.SUPABASE_SERVICE_ROLE_KEY?.trim());
  add("Stable live website URL", https(env.NEXT_PUBLIC_SITE_URL) && !env.NEXT_PUBLIC_SITE_URL?.includes("-git-"));
  add("Live Paystack key", env.PAYSTACK_SECRET_KEY?.startsWith("sk_live_"));
  add("Payment recovery secret", (env.CRON_SECRET?.length ?? 0) >= 32);
  add("Native Arkesel callback mode", env.USSD_SESSION_PROTOCOL === "arkesel-json");
  add("Paystack Mobile Money configured", (env.USSD_PAYMENT_PROVIDER ?? "paystack") === "paystack");
  add("Simulator disabled", env.USSD_SIMULATOR_MODE !== "true" && !env.USSD_SIMULATOR_EVENT_IDS?.trim());
  add("Gateway launch switch configured", ["false", "true"].includes(env.USSD_ENABLED ?? ""));
  add("Callback secret configured", (env.ARKESEL_USSD_CALLBACK_TOKEN?.length ?? 0) >= 32);
  add("Separate session secret configured", (env.ARKESEL_USSD_SHARED_SECRET?.length ?? 0) >= 32 && env.ARKESEL_USSD_SHARED_SECRET !== env.ARKESEL_USSD_CALLBACK_TOKEN);
  add("Purchased dialing code", /^\*[0-9*]{2,30}#$/.test(env.ARKESEL_USSD_SERVICE_CODE ?? ""), true);
  add("Assigned subscription user ID", env.ARKESEL_USSD_USER_ID?.trim(), true);
  add("Live launch enabled after provider checks", env.USSD_LIVE_LAUNCH_ENABLED === "true", true);
  return { live, checks,
    prepared: live && checks.filter(check => !check.purchase).every(check => check.ready),
    configured: live && checks.every(check => check.ready), enabled: env.USSD_ENABLED === "true" && (!live || env.USSD_LIVE_LAUNCH_ENABLED === "true") };
}
