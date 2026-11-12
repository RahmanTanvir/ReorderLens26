"use client";
import { useWorkspaceRequest } from "@/components/workspace/workspace-request-provider";
import { useRef,useState } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useMutation } from "@/lib/client/use-mutation";

import { createPlanSchema,createdPlanSchema } from "@/lib/planning/contracts";
import type { ForecastRun } from "@/lib/forecast/contracts";

export function PlanCreation({runs,selectedRunId,canCreate,isSample}:{runs:ForecastRun[];selectedRunId?:string;canCreate:boolean;isSample:boolean}) {
  const requestJson=useWorkspaceRequest();
  const [runId,setRun]=useState(selectedRunId??runs.find(run=>run.summary.sufficient>0)?.id??runs[0]?.id??""),[budget,setBudget]=useState("50000.00"),[review,setReview]=useState("7"),[safety,setSafety]=useState("2");
  const mutation=useMutation(),router=useRouter(),identity=useRef<{key:string;id:string}|null>(null);
  const selected=runs.find(run=>run.id===runId),ready=canCreate&&selected?.status==="succeeded"&&selected.summary.sufficient>0;
  return <section className="rounded-xl border bg-card p-5"><h2 className="text-lg font-semibold">{isSample?"Load illustrative plan":"Create a purchasing plan"}</h2><form className="mt-4 grid items-end gap-4 sm:grid-cols-2 xl:grid-cols-[minmax(220px,1fr)_150px_100px_100px_auto]" aria-busy={mutation.busy} onSubmit={async event=>{
    event.preventDefault();const result=await mutation.run(async()=>{const fields={forecastRunId:runId,budget,reviewPeriodDays:Number(review),safetyDays:Number(safety)},key=JSON.stringify(fields);if(identity.current?.key!==key)identity.current={key,id:crypto.randomUUID()};return requestJson("/api/plans","POST",createPlanSchema.parse({planId:identity.current.id,...fields}),createdPlanSchema);});
    if(result.ok){router.push(`/app/replenishment?planId=${result.data.planId}`);router.refresh();}
  }}><div className="min-w-0"><label htmlFor="plan-forecast" className="mb-2 block text-xs font-medium">Completed forecast</label><Select id="plan-forecast" value={runId} onChange={event=>setRun(event.target.value)} disabled={!canCreate||mutation.busy}>{runs.length?runs.map(run=><option key={run.id} value={run.id}>{run.asOfDate} · {run.horizonDays} days · {run.summary.sufficient} sufficient · {run.id.slice(0,8)}</option>):<option value="">No completed forecast</option>}</Select></div><div><label htmlFor="create-budget" className="mb-2 block text-xs font-medium">Budget · BDT</label><Input id="create-budget" inputMode="decimal" value={budget} onChange={event=>setBudget(event.target.value)} disabled={isSample||!canCreate||mutation.busy} required maxLength={15}/></div><div><label htmlFor="review-days" className="mb-2 block text-xs font-medium">Review days</label><Input id="review-days" type="number" min={1} max={30} value={review} onChange={event=>setReview(event.target.value)} disabled={isSample||!canCreate||mutation.busy} required/></div><div><label htmlFor="safety-days" className="mb-2 block text-xs font-medium">Safety days</label><Input id="safety-days" type="number" min={0} max={30} value={safety} onChange={event=>setSafety(event.target.value)} disabled={isSample||!canCreate||mutation.busy} required/></div><Button type="submit" disabled={!ready||mutation.busy}>{mutation.busy?"Saving plan…":isSample?"Load sample plan":"Generate plan"}</Button></form><p className="mt-4 text-xs leading-6 text-muted-foreground">{!canCreate?"Viewers can inspect saved plans; owners and operators can create or edit them.":isSample?"Documented fictional fixture: BDT 50,000 budget, BDT 48,750 suggestions. These quantities are not runtime algorithm output. You can edit the saved approvals and budget.":"Greedy allocation prioritizes risk, pre-arrival gap, then SKU. It is not a globally optimal allocation. A successful run still needs sufficient demand, stock and positive cost on a product within the reorder window."}</p>{!isSample&&selected?.summary.sufficient===0?<div className="mt-4"><Alert>The selected run has no sufficient product forecasts. Review recorded history in Forecasts before generating recommendations. No purchase quantities will be invented.</Alert></div>:null}{mutation.error?<div className="mt-4"><Alert tone="error">{mutation.error.message} Interrupted responses can be retried with the same inputs; the creation ID is reused.</Alert></div>:null}</section>;
}
