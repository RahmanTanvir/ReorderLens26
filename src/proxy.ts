import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

import { safeNextPath } from "@/lib/auth/contracts";
import { privateHeaders } from "@/lib/auth/errors";
import type { Database } from "@/lib/supabase/database.types";
import { parsePublicEnvironment } from "@/lib/validation/environment";

export async function proxy(request: NextRequest) {
  let refreshed = NextResponse.next({ request });
  const path = request.nextUrl.pathname;
  const protectedPage = path === "/setup" || path === "/app" || path.startsWith("/app/");
  const protectedApi = path === "/api" || path.startsWith("/api/");
  const environment = parsePublicEnvironment(process.env);
  let authenticated = false;
  if (environment.supabase.configured) {
    const client = createServerClient<Database>(environment.supabase.url, environment.supabase.publishableKey, {
      cookieOptions: { httpOnly: true, secure: new URL(environment.appUrl).protocol === "https:", sameSite: "lax", path: "/" },
      global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store", signal: init?.signal ?? AbortSignal.timeout(15000) }) },
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (values, cacheHeaders) => {
          values.forEach(({ name, value }) => request.cookies.set(name, value));
          const previousCookies = refreshed.cookies.getAll();
          refreshed = NextResponse.next({ request });
          previousCookies.forEach((cookie) => refreshed.cookies.set(cookie));
          values.forEach(({ name, value, options }) => refreshed.cookies.set(name, value, options));
          Object.entries(cacheHeaders).forEach(([name, value]) => refreshed.headers.set(name, value));
        },
      },
    });
    try { const { data, error } = await client.auth.getClaims(); authenticated = !error && !!data?.claims?.sub; } catch { authenticated = false; }
  }
  let response = refreshed;
  if (!authenticated && protectedApi) response = NextResponse.json({ error: { code: "AUTH_REQUIRED", message: "Sign in to continue.", requestId: crypto.randomUUID() } }, { status: 401 });
  if (!authenticated && protectedPage) {
    const destination = new URL("/login", request.url);
    destination.searchParams.set("next", safeNextPath(`${path}${request.nextUrl.search}`));
    response = NextResponse.redirect(destination);
  }
  if (response !== refreshed) refreshed.cookies.getAll().forEach((cookie) => response.cookies.set(cookie));
  Object.entries(privateHeaders).forEach(([name, value]) => response.headers.set(name, value));
  return response;
}

export const config = { matcher: ["/login", "/signup", "/setup", "/app/:path*", "/api/:path*", "/auth/:path*"] };
