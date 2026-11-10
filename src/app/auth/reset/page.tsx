import { redirect } from "next/navigation";

import { AuthFrame } from "@/components/auth/auth-frame";
import { AuthForm } from "@/components/auth/auth-form";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { publicAuthConfiguration } from "@/server/auth/public-page";

export const dynamic = "force-dynamic";
export const metadata = { title: "Reset password — ReorderLens" };
export default async function ResetPage({ searchParams }: { searchParams: Promise<{ mode?: string; notice?: string }> }) {
  const params = await searchParams;
  const configured = await publicAuthConfiguration();
  if (params.mode === "update") {
    if (!configured) redirect("/auth/reset?notice=expired");
    const result = await (await createSupabaseServerClient()).auth.getUser();
    if (!result.data.user) redirect("/auth/reset?notice=expired");
  }
  return <AuthFrame><AuthForm mode={params.mode === "update" ? "reset-update" : "reset-request"} configured={configured} notice={params.notice === "expired" ? "This recovery link expired or could not be verified. Request a fresh link below." : undefined} /></AuthFrame>;
}
