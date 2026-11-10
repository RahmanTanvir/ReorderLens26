import "server-only";

import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getServerEnvironment } from "@/server/config/environment";

export async function publicAuthConfiguration(redirectAuthenticated = false) {
  const configured = getServerEnvironment().public.supabase.configured;
  if (configured && redirectAuthenticated) {
    const client = await createSupabaseServerClient();
    const result = await client.auth.getUser();
    if (result.data.user) redirect("/app/overview");
  }
  return configured;
}
