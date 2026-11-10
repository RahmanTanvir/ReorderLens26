import type { Metadata } from "next";

import { AuthFrame } from "@/components/auth/auth-frame";
import { AuthForm } from "@/components/auth/auth-form";
import { publicAuthConfiguration } from "@/server/auth/public-page";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Create account — ReorderLens" };
export default async function SignupPage() {
  return <AuthFrame><AuthForm mode="signup" configured={await publicAuthConfiguration(true)} /></AuthFrame>;
}
