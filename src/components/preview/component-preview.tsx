"use client";

import { useId, useState, type FormEvent } from "react";
import { Check, Shapes } from "lucide-react";

import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

export function ComponentPreview() {
  const nameId = useId();
  const errorId = useId();
  const statusId = useId();
  const [name, setName] = useState("");
  const [status, setStatus] = useState("all");
  const [result, setResult] = useState<"idle" | "error" | "success">("idle");

  function validate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setResult(name.trim().length < 2 ? "error" : "success");
  }

  function reset() {
    setName("");
    setStatus("all");
    setResult("idle");
  }

  return (
    <Dialog>
      <DialogTrigger asChild><Button variant="outline" size="sm"><Shapes aria-hidden="true" />View components</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Graphite components</DialogTitle><DialogDescription>Interactive visual examples. These values are illustrative and nothing is saved.</DialogDescription></DialogHeader>
        <form onSubmit={validate} noValidate className="space-y-5">
          <div>
            <label htmlFor={nameId} className="mb-2 block text-sm font-medium">Workspace name (example)</label>
            <Input id={nameId} value={name} onChange={(event) => { setName(event.target.value); setResult("idle"); }} placeholder="e.g. Sample store" maxLength={120} aria-invalid={result === "error"} aria-describedby={result === "error" ? errorId : undefined} />
          </div>
          {result === "error" ? <Alert tone="error" id={errorId}>Enter at least two characters for this example.</Alert> : null}
          {result === "success" ? <Alert tone="success"><span className="inline-flex items-center gap-2"><Check aria-hidden="true" className="size-4" />Example accepted. Nothing was saved.</span></Alert> : null}
          <div>
            <label htmlFor={statusId} className="mb-2 block text-sm font-medium">Status style (example)</label>
            <Select id={statusId} value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="all">All status styles</option><option value="critical">At risk</option><option value="warning">Reorder soon</option><option value="healthy">Healthy</option><option value="unknown">Insufficient data</option>
            </Select>
          </div>
          <div role="group" className="flex min-h-8 flex-wrap gap-2" aria-label="Illustrative status styles">
            {status === "all" || status === "critical" ? <Badge tone="critical">At risk</Badge> : null}
            {status === "all" || status === "warning" ? <Badge tone="warning">Reorder soon</Badge> : null}
            {status === "all" || status === "healthy" ? <Badge tone="healthy">Healthy</Badge> : null}
            {status === "all" || status === "unknown" ? <Badge>Insufficient data</Badge> : null}
          </div>
          <div className="border-t pt-5"><p className="mb-3 text-xs text-muted-foreground">Loading style example</p><div role="group" className="space-y-2" aria-label="Illustrative loading placeholder"><Skeleton className="h-3 w-3/4" /><Skeleton className="h-3 w-1/2" /></div></div>
          <div className="flex flex-wrap gap-3 border-t pt-5"><Button type="submit">Validate example</Button><Button variant="ghost" onClick={reset}>Reset example</Button></div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
