import type { Metadata } from "next";

import { AuthFrame } from "@/components/auth/auth-frame";
import { AuthForm } from "@/components/auth/auth-form";
import { publicAuthConfiguration } from "@/server/auth/public-page";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Sign in — ReorderLens" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; notice?: string }> }) {
  const params = await searchParams;
  // A database/setup outage redirects here with a notice; do not bounce an
  // otherwise valid Auth session straight back into the failing workspace.
  const configured = await publicAuthConfiguration(params.notice !== "unavailable");
  const notice = params.notice === "callback" ? "This email link expired or could not be verified. Request a fresh link and open it in the same browser." : params.notice === "unavailable" ? "Workspace access is temporarily unavailable. Please try again or contact your administrator." : undefined;
  return <AuthFrame><AuthForm mode="login" configured={configured} next={params.next} notice={notice} /></AuthFrame>;
}
