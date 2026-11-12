"use client";
import { useWorkspaceRequest } from "@/components/workspace/workspace-request-provider";

import { useId, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { z } from "@/lib/validation/zod";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { profileUpdateSchema, workspaceUpdateSchema, type MembershipWorkspace } from "@/lib/auth/contracts";

import { useMutation } from "@/lib/client/use-mutation";

export function SettingsForm({ workspace, displayName }: { workspace: MembershipWorkspace; displayName: string }) {
  const requestJson=useWorkspaceRequest();
  const id = useId();
  const router = useRouter();
  const [name, setName] = useState(workspace.name);
  const [location, setLocation] = useState(workspace.location);
  const [profileName, setProfileName] = useState(displayName);
  const settings = useMutation();
  const profile = useMutation();
  const owner = workspace.role === "owner";
  async function saveWorkspace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = await settings.run(() => requestJson("/api/workspace", "PATCH", workspaceUpdateSchema.parse({ name, location }), z.object({ workspace: z.object({ id: z.uuid(), name: z.string() }) })));
    if (result.ok) router.refresh();
  }
  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = await profile.run(() => requestJson("/api/profile", "PATCH", profileUpdateSchema.parse({ displayName: profileName }), z.object({ profile: z.object({ display_name: z.string() }) })));
    if (result.ok) router.refresh();
  }
  return <div className="grid items-start gap-6 lg:grid-cols-[190px_minmax(0,1fr)]"><nav aria-label="Settings sections" className="flex flex-wrap gap-2 lg:flex-col"><a href="#workspace-settings" className="rounded-md border-l-2 border-primary bg-primary/10 px-4 py-3 text-sm text-primary">Workspace</a><a href="#account-settings" className="rounded-md px-4 py-3 text-sm text-secondary-foreground hover:bg-accent">Account</a></nav><div className="space-y-6">
    <form id="workspace-settings" onSubmit={saveWorkspace} noValidate className="scroll-mt-24 space-y-6 rounded-xl border bg-card p-6 sm:p-8" aria-busy={settings.busy}>
      <div><h2 className="text-lg font-semibold">Workspace information</h2><p className="mt-2 text-sm leading-6 text-secondary-foreground">These details define how your business appears in ReorderLens.</p></div>
      {!owner ? <Alert>Only the workspace owner can edit these settings.</Alert> : null}
      {settings.error ? <Alert tone="error">{settings.error.message}</Alert> : null}{settings.succeeded ? <Alert tone="success">Workspace settings saved.</Alert> : null}
      <div className="grid gap-5 sm:grid-cols-2"><div><label htmlFor={`${id}-name`} className="mb-2 block text-sm font-medium">Business name</label><Input id={`${id}-name`} value={name} onChange={(event) => setName(event.target.value)} disabled={!owner || settings.busy} maxLength={120} aria-invalid={!!settings.fieldError("name")} aria-describedby={settings.fieldError("name") ? `${id}-name-error` : undefined} />{settings.fieldError("name") ? <p id={`${id}-name-error`} className="mt-2 text-xs text-destructive">{settings.fieldError("name")}</p> : null}</div><div><label htmlFor={`${id}-location`} className="mb-2 block text-sm font-medium">Location</label><Input id={`${id}-location`} value={location} onChange={(event) => setLocation(event.target.value)} disabled={!owner || settings.busy} maxLength={160} aria-invalid={!!settings.fieldError("location")} aria-describedby={settings.fieldError("location") ? `${id}-location-error` : undefined} />{settings.fieldError("location") ? <p id={`${id}-location-error`} className="mt-2 text-xs text-destructive">{settings.fieldError("location")}</p> : null}</div><div><label htmlFor={`${id}-currency`} className="mb-2 block text-sm font-medium">Default currency</label><Input id={`${id}-currency`} value="BDT — Bangladeshi Taka" readOnly /></div><div><label htmlFor={`${id}-timezone`} className="mb-2 block text-sm font-medium">Time zone</label><Input id={`${id}-timezone`} value="Asia/Dhaka (UTC+06:00)" readOnly /></div></div>
      {owner ? <div className="flex flex-wrap justify-end gap-3"><Button variant="outline" disabled={settings.busy} onClick={() => { setName(workspace.name); setLocation(workspace.location); }}>Discard changes</Button><Button type="submit" disabled={settings.busy}>{settings.busy ? "Saving…" : "Save workspace settings"}</Button></div> : null}
    </form>
    <form id="account-settings" onSubmit={saveProfile} noValidate className="scroll-mt-24 space-y-5 rounded-xl border bg-card p-6 sm:p-8" aria-busy={profile.busy}><div><h2 className="text-lg font-semibold">Account</h2><p className="mt-2 text-sm leading-6 text-secondary-foreground">Your display name is shared only where your account is shown.</p></div>{profile.error ? <Alert tone="error">{profile.error.message}</Alert> : null}{profile.succeeded ? <Alert tone="success">Display name saved.</Alert> : null}<div><label htmlFor={`${id}-display`} className="mb-2 block text-sm font-medium">Display name</label><Input id={`${id}-display`} value={profileName} onChange={(event) => setProfileName(event.target.value)} disabled={profile.busy} maxLength={120} autoComplete="name" aria-invalid={!!profile.fieldError("displayName")} aria-describedby={profile.fieldError("displayName") ? `${id}-display-error` : undefined} />{profile.fieldError("displayName") ? <p id={`${id}-display-error`} className="mt-2 text-xs text-destructive">{profile.fieldError("displayName")}</p> : null}</div><div className="flex justify-end"><Button type="submit" disabled={profile.busy}>{profile.busy ? "Saving…" : "Save display name"}</Button></div></form>
  </div></div>;
}
