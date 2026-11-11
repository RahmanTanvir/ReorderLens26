"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Alert } from "@/components/ui/alert";
import { generateForecastSchema,generationSchema,type ForecastRun } from "@/lib/forecast/contracts";
import { requestJson } from "@/lib/client/request";
import { useMutation } from "@/lib/client/use-mutation";

export function ForecastControls({today,run,canGenerate,isSample}:{today:string;run:ForecastRun|null;canGenerate:boolean;isSample:boolean}) {
  const router=useRouter(),mutation=useMutation();
  const [asOfDate,setDate]=useState(run?.asOfDate??today),[horizon,setHorizon]=useState(String(run?.horizonDays??7));
  const [saved,setSaved]=useState<string|null>(null);
  return <section aria-label="Forecast generation" className="rounded-xl border bg-card p-5"><form aria-busy={mutation.busy} onSubmit={async event=>{
    event.preventDefault();setSaved(null);
    const result=await mutation.run(async()=>requestJson("/api/forecasts/runs","POST",generateForecastSchema.parse({asOfDate,horizonDays:Number(horizon)}),generationSchema));
    if(result.ok){const value=result.data;setSaved(value.status==="failed"?"This run failed; no partial estimates were saved. Review its status and retry when ready.":value.reused?"Opened the existing run for these inputs. No duplicate was created.":"Run saved. Review each product’s evidence before using its estimate.");router.push(`/app/forecasts?runId=${value.runId}`);router.refresh();}
  }} className="flex flex-wrap items-end gap-4"><div className="w-full min-w-0 sm:w-auto"><label htmlFor="forecast-cutoff" className="mb-2 block text-xs font-medium">Sales cutoff · Asia/Dhaka</label><Input id="forecast-cutoff" type="date" min="1900-01-01" max={today} value={asOfDate} onChange={event=>setDate(event.target.value)} disabled={!canGenerate||mutation.busy} required/></div><div className="w-full min-w-0 sm:w-auto"><label htmlFor="forecast-horizon" className="mb-2 block text-xs font-medium">Forecast horizon</label><Select id="forecast-horizon" value={horizon} onChange={event=>setHorizon(event.target.value)} disabled={!canGenerate||mutation.busy}>{[7,14,28].map(days=><option key={days} value={days}>{days} days</option>)}</Select></div><Button type="submit" className="w-full sm:w-auto" disabled={!canGenerate||mutation.busy} aria-describedby="forecast-generation-note">{mutation.busy?"Generating…":"Generate forecast"}</Button><p id="forecast-generation-note" className="max-w-xl text-xs leading-6 text-muted-foreground">{isSample?"Sample workspace · Illustrative data. Fixed sample rates are read-only; no future curve is invented.":!canGenerate?"Your viewer role can inspect saved runs. Owners and operators can generate forecasts.":"Uses recorded sales in the preceding 28 days, including the cutoff. Requires 14 eligible days and a recent observation per product."}</p></form>
    {mutation.busy?<p role="status" className="mt-4 text-sm text-secondary-foreground">Saving this run atomically. Keep the page open; estimates appear after completion.</p>:null}
    {mutation.error?<div className="mt-4"><Alert tone="error">{mutation.error.message} If the response was interrupted, check saved runs and retry the same inputs; successful runs are reused.</Alert></div>:null}
    {saved?<p role="status" className="mt-4 text-sm text-secondary-foreground">{saved}</p>:null}
  </section>;
}
