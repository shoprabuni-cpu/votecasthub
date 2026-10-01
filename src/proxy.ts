import { randomBytes } from "node:crypto";
import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

function getSupabaseOrigins() {
  try {
    const endpoint = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "");
    const realtimeScheme = endpoint.protocol === "https:" ? "wss:" : "ws:";
    return { api: endpoint.origin, realtime: `${realtimeScheme}//${endpoint.host}` };
  } catch {
    return { api: "", realtime: "" };
  }
}

export async function proxy(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  const isProduction = process.env.NODE_ENV === "production";
  let csp: string | undefined;

  if (isProduction) {
    const nonce = randomBytes(16).toString("base64");
    const supabase = getSupabaseOrigins();
    const supabaseSources = [supabase.api, supabase.realtime].filter(Boolean).join(" ");
    requestHeaders.set("x-nonce", nonce);
    csp = [
      "default-src 'self'",
      `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
      `style-src 'self' 'nonce-${nonce}'`,
      `img-src 'self' data: blob:${supabase.api ? ` ${supabase.api}` : ""}`,
      "font-src 'self' data:",
      `connect-src 'self'${supabaseSources ? ` ${supabaseSources}` : ""}`,
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "upgrade-insecure-requests",
    ].join("; ");
    requestHeaders.set("Content-Security-Policy", csp);
  }

  const response = await updateSession(request, requestHeaders);
  if (csp) response.headers.set("Content-Security-Policy", csp);
  if (isProduction) response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
