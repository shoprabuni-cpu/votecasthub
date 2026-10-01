import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { getPublicEnvironment } from "@/lib/env";

export async function updateSession(request: NextRequest, requestHeaders: Headers) {
  const isProtectedRoute = ["/organizer", "/admin", "/reset-password"].some(
    (base) => request.nextUrl.pathname === base || request.nextUrl.pathname.startsWith(`${base}/`),
  );

  let url: string;
  let publishableKey: string;
  try {
    ({ NEXT_PUBLIC_SUPABASE_URL: url, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publishableKey } = getPublicEnvironment());
  } catch {
    if (isProtectedRoute) {
      return NextResponse.json({ error: "Service temporarily unavailable" }, { status: 503, headers: { "Cache-Control": "private, no-store" } });
    }
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  let response = NextResponse.next({ request: { headers: requestHeaders } });
  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        requestHeaders.set("cookie", request.cookies.toString());
        response = NextResponse.next({ request: { headers: requestHeaders } });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
      },
    },
  });

  try {
    const { data, error } = await supabase.auth.getClaims();
    if (error && isProtectedRoute) {
      return NextResponse.json({ error: "Unable to verify your session" }, { status: 503, headers: { "Cache-Control": "private, no-store" } });
    }
    if (isProtectedRoute && !data?.claims?.sub) {
      const signInUrl = new URL("/sign-in", request.url);
      signInUrl.searchParams.set("next", request.nextUrl.pathname);
      const redirect = NextResponse.redirect(signInUrl);
      for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
      redirect.headers.set("Cache-Control", "private, no-store");
      return redirect;
    }
    return response;
  } catch {
    if (isProtectedRoute) {
      return NextResponse.json({ error: "Unable to verify your session" }, { status: 503, headers: { "Cache-Control": "private, no-store" } });
    }
    return response;
  }
}

