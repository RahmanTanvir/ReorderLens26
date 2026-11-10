"use client";

import { LogOut } from "lucide-react";
import { z } from "zod";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { requestJson } from "@/lib/client/request";
import { useMutation } from "@/lib/client/use-mutation";

export function SignOutButton() {
  const mutation = useMutation();
  return <div>{mutation.error ? <Alert tone="error" className="mb-3">{mutation.error.message}</Alert> : null}<Button variant="ghost" className="w-full justify-start" disabled={mutation.busy} onClick={async () => {
    const result = await mutation.run(() => requestJson("/auth/sign-out", "POST", {}, z.object({ state: z.literal("signed-out") })));
    if (result.ok) window.location.replace("/login");
  }}><LogOut aria-hidden="true" />{mutation.busy ? "Signing out…" : "Sign out"}</Button></div>;
}
