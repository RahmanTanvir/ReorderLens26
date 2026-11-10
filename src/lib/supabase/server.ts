import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { AppError } from "@/lib/auth/errors";
import type { Database } from "@/lib/supabase/database.types";
import { getServerEnvironment } from "@/server/config/environment";

export async function createSupabaseServerClient(writable = false) {
  const environment = getServerEnvironment().public;
  if (!environment.supabase.configured) throw new AppError(503, "AUTH_NOT_CONFIGURED", "Secure access is not connected yet. Please contact your administrator.");
  const store = await cookies();
  return createServerClient<Database>(environment.supabase.url, environment.supabase.publishableKey, {
    cookieOptions: { httpOnly: true, secure: new URL(environment.appUrl).protocol === "https:", sameSite: "lax", path: "/" },
    global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store", signal: init?.signal ?? AbortSignal.timeout(15000) }) },
    cookies: {
      getAll: () => store.getAll(),
      setAll: (values) => {
        // Read-only Server Components rely on proxy refresh. Route responses and
        // proxy always carry privateHeaders, including SDK refresh responses.
        if (writable) values.forEach(({ name, value, options }) => store.set(name, value, options));
      },
    },
  });
}
