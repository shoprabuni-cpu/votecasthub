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
    if (error || !data?.claims?.sub) {
      if (isProtectedRoute) {
        const signInUrl = new URL("/sign-in", request.url);
        signInUrl.searchParams.set("next", request.nextUrl.pathname);
        const redirect = NextResponse.redirect(signInUrl);
        // Wipe stale auth cookies
        for (const cookie of request.cookies.getAll()) {
          if (cookie.name.includes("auth-token") || cookie.name.startsWith("sb-")) {
            redirect.cookies.delete(cookie.name);
          }
        }
        redirect.headers.set("Cache-Control", "private, no-store");
        return redirect;
      }
      // On public routes with invalid/expired tokens, clear stale cookies so subsequent requests don't fail
      if (error) {
        for (const cookie of request.cookies.getAll()) {
          if (cookie.name.includes("auth-token") || cookie.name.startsWith("sb-")) {
            response.cookies.delete(cookie.name);
          }
        }
      }
      return response;
    }
    return response;
  } catch {
    if (isProtectedRoute) {
      const signInUrl = new URL("/sign-in", request.url);
      signInUrl.searchParams.set("next", request.nextUrl.pathname);
      const redirect = NextResponse.redirect(signInUrl);
      for (const cookie of request.cookies.getAll()) {
        if (cookie.name.includes("auth-token") || cookie.name.startsWith("sb-")) {
          redirect.cookies.delete(cookie.name);
        }
      }
      redirect.headers.set("Cache-Control", "private, no-store");
      return redirect;
    }
    return response;
  }
}

