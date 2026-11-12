import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

import { safeNextPath } from "@/lib/auth/contracts";
import { privateHeaders } from "@/lib/auth/errors";
import type { Database } from "@/lib/supabase/database.types";
import { parsePublicEnvironment } from "@/lib/validation/environment";
import { contentPolicy } from "@/lib/security/content-policy";

export async function proxy(request: NextRequest) {
  const nonce=Buffer.from(crypto.randomUUID()).toString("base64");
  const policy=contentPolicy(nonce,process.env.NODE_ENV==="development",request.nextUrl.protocol==="https:");
  const requestHeaders=new Headers(request.headers);
  // Replace spoofed nonce/policy headers before Next renders its inline scripts.
  requestHeaders.set("x-nonce",nonce);
  requestHeaders.set("Content-Security-Policy",policy);
  let refreshed = NextResponse.next({ request: { headers:requestHeaders } });
  const path = request.nextUrl.pathname;
  const protectedPage = path === "/setup" || path === "/app" || path.startsWith("/app/");
  const protectedApi = path === "/api" || path.startsWith("/api/");
  const environment = parsePublicEnvironment(process.env);
  let authenticated = false;
  if (environment.supabase.configured&&(protectedPage||protectedApi||["/login","/signup"].includes(path)||path.startsWith("/auth/"))) {
    const client = createServerClient<Database>(environment.supabase.url, environment.supabase.publishableKey, {
      cookieOptions: { httpOnly: true, secure: new URL(environment.appUrl).protocol === "https:", sameSite: "lax", path: "/" },
      global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store", signal: init?.signal ?? AbortSignal.timeout(15000) }) },
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (values, cacheHeaders) => {
          values.forEach(({ name, value }) => request.cookies.set(name, value));
          requestHeaders.set("cookie",request.headers.get("cookie")??"");
          const previousCookies = refreshed.cookies.getAll();
          refreshed = NextResponse.next({ request: { headers:requestHeaders } });
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
  response.headers.set("Content-Security-Policy",policy);
  if(path.startsWith("/auth/"))response.headers.set("Referrer-Policy","no-referrer");
  return response;
}

export const config = { matcher: ["/((?!_next/static|_next/image|branding/|fonts/|templates/|favicon.ico|robots.txt).*)"] };
