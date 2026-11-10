"use client";

import { useId, useState, type FormEvent } from "react";
import { ArrowRight, Database, Info, LoaderCircle, Upload } from "lucide-react";
import { z } from "zod";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { safeNextPath, workspaceCreateSchema } from "@/lib/auth/contracts";
import { requestJson } from "@/lib/client/request";
import { useMutation } from "@/lib/client/use-mutation";

export function WorkspaceForm() {
  const id = useId();
  const [name, setName] = useState("");
  const [location, setLocation] = useState("Dhaka, Bangladesh");
  const mutation = useMutation();
  async function createSample() {
    const result = await mutation.run(() => requestJson("/api/workspaces", "POST", { name: "Northgate Market — Sample Store", location: "Dhaka, Bangladesh", isSample: true }, z.object({ workspaceId: z.uuid(), redirect: z.string() })));
    if (result.ok) window.location.replace(safeNextPath(result.data.redirect));
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = await mutation.run(() => requestJson("/api/workspaces", "POST", workspaceCreateSchema.parse({ name, location, isSample: false }), z.object({ workspaceId: z.uuid(), redirect: z.string() })));
    if (result.ok) window.location.replace(safeNextPath(result.data.redirect));
  }
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
      <form onSubmit={submit} noValidate aria-busy={mutation.busy} className="space-y-6 rounded-xl border bg-card p-6 sm:p-8">
        <div className="flex items-center justify-between gap-3"><h2 className="text-lg font-semibold">Business details</h2><span className="text-xs text-muted-foreground">Required fields *</span></div>
        {mutation.error ? <Alert tone="error">{mutation.error.message}</Alert> : null}
        <div><label htmlFor={`${id}-name`} className="mb-2 block text-sm font-medium">Store or business name *</label><Input id={`${id}-name`} name="name" value={name} onChange={(event) => setName(event.target.value)} disabled={mutation.busy} maxLength={120} autoComplete="organization" aria-invalid={!!mutation.fieldError("name")} aria-describedby={mutation.fieldError("name") ? `${id}-name-error` : undefined} />{mutation.fieldError("name") ? <p id={`${id}-name-error`} className="mt-2 text-xs text-destructive">{mutation.fieldError("name")}</p> : null}</div>
        <div><label htmlFor={`${id}-location`} className="mb-2 block text-sm font-medium">Location *</label><Input id={`${id}-location`} name="location" value={location} onChange={(event) => setLocation(event.target.value)} disabled={mutation.busy} maxLength={160} aria-invalid={!!mutation.fieldError("location")} aria-describedby={mutation.fieldError("location") ? `${id}-location-error` : undefined} />{mutation.fieldError("location") ? <p id={`${id}-location-error`} className="mt-2 text-xs text-destructive">{mutation.fieldError("location")}</p> : null}</div>
        <div className="grid gap-5 sm:grid-cols-2"><div><label htmlFor={`${id}-currency`} className="mb-2 block text-sm font-medium">Currency</label><Input id={`${id}-currency`} value="BDT — Bangladeshi Taka" readOnly /></div><div><label htmlFor={`${id}-zone`} className="mb-2 block text-sm font-medium">Time zone</label><Input id={`${id}-zone`} value="Asia/Dhaka (UTC+06:00)" readOnly /></div></div>
        <Alert><span className="inline-flex items-start gap-3"><Info aria-hidden="true" className="mt-1 size-4 shrink-0" />Settings can be updated later. Creating a workspace does not connect a POS system or import records.</span></Alert>
        <div className="flex justify-end"><Button type="submit" disabled={mutation.busy}>{mutation.busy ? <LoaderCircle aria-hidden="true" className="animate-spin motion-reduce:animate-none" /> : <ArrowRight aria-hidden="true" />}{mutation.busy ? "Creating workspace…" : "Create workspace"}</Button></div>
      </form>
      <aside className="rounded-xl border bg-card p-6 sm:p-8"><p className="text-xs font-semibold tracking-wider text-primary uppercase">What happens next</p><h2 className="mt-3 text-lg font-semibold">Your own workspace</h2><p className="mt-3 text-sm leading-6 text-secondary-foreground">Your store details are saved privately, with you as its owner. Data remains separate from every other workspace.</p><div className="mt-7 flex items-start gap-3"><Upload aria-hidden="true" className="mt-1 size-5 shrink-0 text-primary" /><div><h3 className="text-sm font-semibold">Import business data</h3><p className="mt-1 text-xs leading-5 text-muted-foreground">Upload suppliers, products, stock snapshots and daily sales. Review validation before confirming any records.</p></div></div><div className="mt-6 flex items-start gap-3"><Database aria-hidden="true" className="mt-1 size-5 shrink-0 text-primary" /><div><h3 className="text-sm font-semibold">Sample workspace</h3><p id={`${id}-sample-note`} className="mt-1 text-xs leading-5 text-muted-foreground">Explore fictional Northgate Market data in a separate workspace. Your business records stay separate; CSV uploads are blocked in sample mode.</p></div></div><Button disabled={mutation.busy} onClick={createSample} variant="outline" className="mt-5 w-full" aria-describedby={`${id}-sample-note`}>Explore sample workspace</Button></aside>
    </div>
  );
}
