import "server-only";

import { cookies } from "next/headers";
import type { NextRequest } from "next/server";

import { credentialsSchema, emailRequestSchema, passwordUpdateSchema, safeNextPath, signupSchema } from "@/lib/auth/contracts";
import { AppError } from "@/lib/auth/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUser } from "@/server/auth/context";
import { getServerEnvironment } from "@/server/config/environment";
import { readJson } from "@/server/http";

function authFailure(error: { code?: string; status?: number } | null) {
  if (!error) return;
  if (error.status === 429) throw new AppError(429, "RATE_LIMITED", "Too many attempts. Please wait a few minutes and try again.");
  if (error.code === "email_not_confirmed") throw new AppError(401, "EMAIL_UNCONFIRMED", "Confirm your email before signing in. Check your inbox or request another confirmation email.");
  if (error.code === "invalid_credentials") throw new AppError(401, "INVALID_CREDENTIALS", "The email or password is incorrect.");
  if (error.code === "weak_password") throw new AppError(400, "WEAK_PASSWORD", "Choose a stronger password that meets the account's password requirements.");
  if (error.status && error.status < 500) throw new AppError(400, "AUTH_REQUEST_FAILED", "This request could not be completed. Check your details or request a new email link.");
  throw new AppError(503, "AUTH_UNAVAILABLE", "Secure access is temporarily unavailable. Please try again.");
}

function callbackUrl(next: string) {
  const url = new URL("/auth/callback", getServerEnvironment().public.appUrl);
  url.searchParams.set("next", next);
  return url.toString();
}

export async function handleAuthOperation(request: NextRequest) {
  const action = request.nextUrl.pathname.split("/").pop();
  if (action === "sign-in") {
    const input = await readJson(request, credentialsSchema);
    const client = await createSupabaseServerClient(true);
    const result = await client.auth.signInWithPassword({ email: input.email, password: input.password });
    authFailure(result.error);
    return { data: { redirect: safeNextPath(input.next) } };
  }
  if (action === "sign-up") {
    const input = await readJson(request, signupSchema);
    const client = await createSupabaseServerClient(true);
    const result = await client.auth.signUp({ ...input, options: { emailRedirectTo: callbackUrl("/setup") } });
    authFailure(result.error);
    return { data: result.data.session ? { redirect: "/setup" } : { state: "check-email" } };
  }
  if (action === "request-reset" || action === "resend-confirmation") {
    const input = await readJson(request, emailRequestSchema);
    const client = await createSupabaseServerClient(true);
    const result = action === "request-reset"
      ? await client.auth.resetPasswordForEmail(input.email, { redirectTo: callbackUrl("/auth/reset?mode=update") })
      : await client.auth.resend({ type: "signup", email: input.email, options: { emailRedirectTo: callbackUrl("/setup") } });
    authFailure(result.error);
    return { data: { state: "check-email" } };
  }
  if (action === "update-password") {
    const input = await readJson(request, passwordUpdateSchema);
    const context = await requireUser(true);
    const result = await context.client.auth.updateUser({ password: input.password });
    authFailure(result.error);
    return { data: { redirect: "/app/overview" } };
  }
  if (action === "sign-out") {
    const client = await createSupabaseServerClient(true);
    const result = await client.auth.signOut({ scope: "local" });
    authFailure(result.error);
    (await cookies()).delete("rl-workspace");
    return { data: { state: "signed-out" } };
  }
  throw new AppError(404, "NOT_FOUND", "This action is not available.");
}
