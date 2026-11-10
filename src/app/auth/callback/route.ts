import { NextRequest, NextResponse } from "next/server";

import { safeNextPath } from "@/lib/auth/contracts";
import { privateHeaders } from "@/lib/auth/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getServerEnvironment } from "@/server/config/environment";

export async function GET(request: NextRequest) {
  const next = safeNextPath(request.nextUrl.searchParams.get("next"));
  const code = request.nextUrl.searchParams.get("code");
  let destination = next.startsWith("/auth/reset") ? "/auth/reset?notice=expired" : "/login?notice=callback";
  try {
    if (code && code.length <= 2048) {
      const client = await createSupabaseServerClient(true);
      const { error } = await client.auth.exchangeCodeForSession(code);
      if (!error) destination = next;
    }
  } catch { /* Never reflect provider errors or tokens into a redirect/log. */ }
  const response = NextResponse.redirect(new URL(destination, getServerEnvironment().public.appUrl));
  Object.entries(privateHeaders).forEach(([name, value]) => response.headers.set(name, value));
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
