"use client";

import { z } from "@/lib/validation/zod";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { MembershipWorkspace } from "@/lib/auth/contracts";
import { safeNextPath } from "@/lib/auth/contracts";
import { requestJson } from "@/lib/client/request";
import { useMutation } from "@/lib/client/use-mutation";

export function WorkspacePicker({ workspaces }: { workspaces: MembershipWorkspace[] }) {
  const mutation = useMutation();
  return <section className="rounded-xl border bg-card p-6"><h2 className="text-lg font-semibold">Choose a workspace</h2>{mutation.error ? <Alert tone="error" className="mt-4">{mutation.error.message}</Alert> : null}<ul className="mt-5 space-y-3">{workspaces.map((workspace) => <li key={workspace.id}><Button variant="outline" disabled={mutation.busy} className="h-auto min-h-14 w-full justify-between gap-3 py-3 text-left whitespace-normal" onClick={async () => {
    const result = await mutation.run(() => requestJson("/api/workspaces/select", "POST", { workspaceId: workspace.id }, z.object({ redirect: z.string() })));
    if (result.ok) window.location.replace(safeNextPath(result.data.redirect));
  }}><span className="min-w-0 break-words">{workspace.name}<span className="mt-1 block text-xs font-normal text-muted-foreground">{workspace.location}{workspace.is_sample ? " · Sample workspace · Illustrative data" : ""}</span></span><span className="shrink-0 text-xs text-muted-foreground capitalize">{workspace.role}</span></Button></li>)}</ul></section>;
}
