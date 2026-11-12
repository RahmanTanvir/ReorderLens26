"use client";

import { useId, useState, type FormEvent } from "react";
import Link from "next/link";
import { Eye, EyeOff, LoaderCircle } from "lucide-react";
import { z } from "@/lib/validation/zod";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { credentialsSchema, emailRequestSchema, passwordUpdateSchema, safeNextPath, signupSchema } from "@/lib/auth/contracts";
import { requestJson } from "@/lib/client/request";
import { useMutation } from "@/lib/client/use-mutation";

export type AuthMode = "login" | "signup" | "reset-request" | "reset-update" | "resend";
const content = {
  login: { title: "Welcome back", description: "Sign in to continue planning with ReorderLens.", action: "Sign in", endpoint: "sign-in" },
  signup: { title: "Create your account", description: "Start with secure access to your own workspace.", action: "Create account", endpoint: "sign-up" },
  "reset-request": { title: "Reset your password", description: "We'll send a secure recovery link if the account is eligible.", action: "Send recovery link", endpoint: "request-reset" },
  "reset-update": { title: "Choose a new password", description: "Set a new password for your verified account.", action: "Update password", endpoint: "update-password" },
  resend: { title: "Confirm your email", description: "Request a fresh account confirmation email.", action: "Resend confirmation", endpoint: "resend-confirmation" },
};
const resultSchema = z.object({ redirect: z.string().optional(), state: z.literal("check-email").optional() });

export function AuthForm({ mode, configured, next, notice }: { mode: AuthMode; configured: boolean; next?: string; notice?: string }) {
  const id = useId();
  const mutation = useMutation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [checkEmail, setCheckEmail] = useState(false);
  const copy = content[mode];
  const hasEmail = mode !== "reset-update";
  const hasPassword = ["login", "signup", "reset-update"].includes(mode);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const outcome = await mutation.run(async () => {
      const body = mode === "login" ? credentialsSchema.parse({ email, password, next: safeNextPath(next) })
        : mode === "signup" ? signupSchema.parse({ email, password })
        : mode === "reset-update" ? passwordUpdateSchema.parse({ password, confirmPassword }) : emailRequestSchema.parse({ email });
      return requestJson(`/auth/${copy.endpoint}`, "POST", body, resultSchema);
    });
    if (outcome.ok) {
      if (outcome.data.redirect) window.location.replace(safeNextPath(outcome.data.redirect));
      else setCheckEmail(true);
    }
  }

  function fieldMessage(name: string) {
    const message = mutation.fieldError(name);
    return message ? <p id={`${id}-${name}-error`} className="mt-2 text-xs text-destructive">{message}</p> : null;
  }

  return (
    <div className="w-full max-w-[430px] rounded-xl border bg-card p-6 sm:p-10">
      <p className="text-xs font-semibold tracking-wider text-primary uppercase">Your workspace</p>
      <h1 className="mt-3 text-[26px] leading-9 font-bold tracking-tight">{copy.title}</h1>
      <p className="mt-2 text-sm leading-6 text-secondary-foreground">{copy.description}</p>
      {!configured ? <Alert className="mt-6" id={`${id}-connection`}>Secure sign-in is not connected yet. Please ask your administrator to finish setting up access.</Alert> : null}
      {notice ? <Alert className="mt-6">{notice}</Alert> : null}
      {checkEmail ? <Alert tone="success" className="mt-6">If the account is eligible, an email is on its way. Check your inbox and open the link in this browser.</Alert> : null}
      {mutation.error ? <Alert tone="error" className="mt-6">{mutation.error.message}</Alert> : null}
      <form onSubmit={submit} noValidate className="mt-7 space-y-5" aria-busy={mutation.busy}>
        {hasEmail ? <div><label htmlFor={`${id}-email`} className="mb-2 block text-xs font-semibold text-secondary-foreground">Work email</label><Input id={`${id}-email`} name="email" type="email" autoComplete="email" placeholder="you@yourbusiness.com" value={email} onChange={(event) => setEmail(event.target.value)} maxLength={254} disabled={!configured || mutation.busy} aria-invalid={!!mutation.fieldError("email")} aria-describedby={mutation.fieldError("email") ? `${id}-email-error` : !configured ? `${id}-connection` : undefined} />{fieldMessage("email")}</div> : null}
        {hasPassword ? <div><label htmlFor={`${id}-password`} className="mb-2 block text-xs font-semibold text-secondary-foreground">{mode === "reset-update" ? "New password" : "Password"}</label><div className="relative"><Input id={`${id}-password`} name="password" type={showPassword ? "text" : "password"} autoComplete={mode === "login" ? "current-password" : "new-password"} value={password} onChange={(event) => setPassword(event.target.value)} disabled={!configured || mutation.busy} maxLength={mode === "login" ? 1024 : 128} className="pr-12" aria-invalid={!!mutation.fieldError("password")} aria-describedby={mutation.fieldError("password") ? `${id}-password-error` : mode !== "login" ? `${id}-password-hint` : undefined} /><Button variant="ghost" size="icon" className="absolute top-0 right-0" disabled={!configured || mutation.busy} aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}</Button></div>{fieldMessage("password")}{mode !== "login" ? <p id={`${id}-password-hint`} className="mt-2 text-xs text-muted-foreground">Use at least 12 characters.</p> : null}</div> : null}
        {mode === "reset-update" ? <div><label htmlFor={`${id}-confirm`} className="mb-2 block text-xs font-semibold text-secondary-foreground">Confirm new password</label><Input id={`${id}-confirm`} name="confirmPassword" type={showPassword ? "text" : "password"} autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} disabled={!configured || mutation.busy} maxLength={128} aria-invalid={!!mutation.fieldError("confirmPassword")} aria-describedby={mutation.fieldError("confirmPassword") ? `${id}-confirmPassword-error` : undefined} />{fieldMessage("confirmPassword")}</div> : null}
        {mode === "login" ? <div className="flex flex-wrap justify-between gap-3 text-xs"><Link href="/auth/resend" className="rounded-sm text-secondary-foreground hover:text-primary">Resend confirmation</Link><Link href="/auth/reset" className="rounded-sm font-semibold text-primary hover:underline">Forgot password?</Link></div> : null}
        <Button type="submit" className="w-full" disabled={!configured || mutation.busy} aria-describedby={!configured ? `${id}-connection` : undefined}>{mutation.busy ? <LoaderCircle aria-hidden="true" className="animate-spin motion-reduce:animate-none" /> : null}{mutation.busy ? "Please wait…" : copy.action}</Button>
      </form>
      <p className="mt-6 border-t pt-6 text-center text-xs leading-6 text-secondary-foreground">{mode === "login" ? <>New to ReorderLens? <Link href="/signup" className="rounded-sm font-semibold text-primary hover:underline">Create an account</Link></> : <Link href="/login" className="rounded-sm font-semibold text-primary hover:underline">Back to sign in</Link>}</p>
    </div>
  );
}
