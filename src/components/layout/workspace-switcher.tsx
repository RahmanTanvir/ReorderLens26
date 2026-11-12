"use client";

import { ChevronsUpDown, Store } from "lucide-react";
import { z } from "@/lib/validation/zod";

import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Select } from "@/components/ui/select";
import { safeNextPath, type MembershipWorkspace } from "@/lib/auth/contracts";
import { requestJson } from "@/lib/client/request";
import { useMutation } from "@/lib/client/use-mutation";

export function WorkspaceSwitcher({ workspace, workspaces = [] }: { workspace?: MembershipWorkspace; workspaces?: MembershipWorkspace[] }) {
  const mutation = useMutation();
  if (workspace) return <div className="relative flex min-w-0 items-center gap-3"><span className="hidden size-9 shrink-0 items-center justify-center rounded-md border bg-card text-primary sm:flex"><Store aria-hidden="true" className="size-5" /></span><div className="w-[155px] min-w-0 sm:w-[210px]"><Select aria-label="Active workspace" value={workspace.id} disabled={mutation.busy || workspaces.length < 2} title={workspaces.length < 2 ? "This is your only workspace" : "Switch workspace"} className="border-transparent bg-transparent px-1 pr-7 font-semibold disabled:opacity-100" onChange={async (event) => {
    const result = await mutation.run(() => requestJson("/api/workspaces/select", "POST", { workspaceId: event.target.value }, z.object({ redirect: z.string() })));
    if (result.ok) window.location.replace(safeNextPath(result.data.redirect));
  }}>{workspaces.map((item) => <option key={item.id} value={item.id}>{item.name}{item.is_sample ? " · Sample" : ""}</option>)}</Select></div>{mutation.error ? <Alert tone="error" className="absolute top-full left-0 z-40 mt-3 w-72">{mutation.error.message}</Alert> : null}</div>;
  return (
    <Button variant="ghost" disabled title="Workspace access is not connected in this visual preview" aria-describedby="preview-note" className="h-12 min-w-0 justify-start gap-3 px-2 text-left disabled:opacity-100 sm:h-12">
      <span className="hidden size-9 shrink-0 items-center justify-center rounded-md border bg-card text-primary sm:flex"><Store aria-hidden="true" className="size-5" /></span>
      <span className="min-w-0"><span className="block truncate text-sm font-semibold text-foreground">Preview workspace</span><span className="mt-0.5 block text-[11px] font-normal text-muted-foreground">Not connected</span></span>
      <ChevronsUpDown aria-hidden="true" className="ml-1 text-muted-foreground" />
    </Button>
  );
}
