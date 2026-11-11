import Link from "next/link";
import { ScenarioWorkspace } from "@/components/scenarios/scenario-workspace";
import { PageHeader } from "@/components/shared/page-header";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { AppError } from "@/lib/auth/errors";
import { requirePageWorkspace } from "@/server/auth/context";
import { listPlans,planningQuery,readPlanContext,scenarioFromContext } from "@/server/services/planning";
import { planningQuerySchema } from "@/lib/planning/contracts";
export const metadata={title:"Scenario Analysis — ReorderLens"};
export default async function ScenarioPage({searchParams}:PageProps<"/app/scenarios">) {
  const context=await requirePageWorkspace();let data=null;let message="This plan could not be loaded.";
  try{const query=planningQuery(await searchParams);if(query.planId)data=await readPlanContext(context,query.planId);}
  catch(error){if(error instanceof AppError&&[400,404].includes(error.status))message=error.message;else throw error;}
  if(!data){const plans=await listPlans(context);return <div className="space-y-6"><PageHeader title="Scenario Analysis" description="Select the saved plan whose inputs you want to compare."/><Alert>{message==="This plan could not be loaded."?"Scenarios require an explicitly selected saved plan.":message}</Alert>{plans.items.length?<form action="/app/scenarios" className="flex flex-wrap items-end gap-4"><div className="min-w-0"><label htmlFor="scenario-plan" className="mb-2 block text-xs font-medium">Saved plan</label><Select id="scenario-plan" name="planId">{plans.items.map(plan=><option key={plan.id} value={plan.id}>{plan.snapshotDate} · revision {plan.revision} · {plan.id.slice(0,8)}</option>)}</Select></div><Button type="submit">Open scenario inputs</Button></form>:null}<Link href="/app/replenishment" className="inline-flex min-h-11 items-center rounded-sm text-primary underline">Open Replenishment Planner</Link></div>;}
  const suppliers=[...new Map(data.items.map(line=>[line.supplierId,{id:line.supplierId,name:line.supplierName}])).values()];
  const initialResult=suppliers[0]?scenarioFromContext(data,context.workspace.is_sample,{planId:data.plan.id,supplierId:suppliers[0].id,extraDelayDays:0},planningQuerySchema.parse({})):undefined;
  return <ScenarioWorkspace key={`${data.plan.id}:${data.plan.revision}`} plan={data.plan} suppliers={suppliers} initialResult={initialResult} isSample={context.workspace.is_sample}/>;
}
