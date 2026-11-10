import { AuthFrame } from "@/components/auth/auth-frame";
import { AuthForm } from "@/components/auth/auth-form";
import { publicAuthConfiguration } from "@/server/auth/public-page";

export const dynamic = "force-dynamic";
export const metadata = { title: "Confirm email — ReorderLens" };
export default async function ResendPage() {
  return <AuthFrame><AuthForm mode="resend" configured={await publicAuthConfiguration()} /></AuthFrame>;
}
