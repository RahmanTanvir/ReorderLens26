import Link from "next/link";
import { PlanCreation } from "@/components/planning/plan-creation";
import { PlannerEditor } from "@/components/planning/planner-editor";
import { PageHeader } from "@/components/shared/page-header";
import { Alert } from "@/components/ui/alert";
import { Button,buttonVariants } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { AppError } from "@/lib/auth/errors";
import { requirePageWorkspace } from "@/server/auth/context";
import { listForecasts,readForecast } from "@/server/services/forecasts";
import { forecastQuerySchema } from "@/lib/forecast/contracts";
import { listPlans,planningQuery,readPlan } from "@/server/services/planning";
export const metadata={title:"Replenishment Planner — ReorderLens"};
export default async function PlannerPage({searchParams}:PageProps<"/app/replenishment">) {
  const context=await requirePageWorkspace();let model=null;let message="This plan selection could not be loaded.";
  try{const query=planningQuery(await searchParams),[plans,forecasts]=await Promise.all([listPlans(context,25,query.plansCursor),listForecasts(context,100)]),id=query.planId??(query.forecastRunId?undefined:plans.items[0]?.id),data=id?await readPlan(context,id,query):null;
    const runs=forecasts.items.filter(run=>run.status==="succeeded"),selected=query.forecastRunId??data?.plan.forecastRunId;
    if(selected&&!runs.some(run=>run.id===selected))runs.unshift((await readForecast(context,selected,forecastQuerySchema.parse({limit:1}))).run);
    model={query,plans,data,runs,selected};
  }catch(error){if(error instanceof AppError&&[400,404].includes(error.status))message=error.message;else throw error;}
  if(!model)return <div className="space-y-5"><PageHeader title="Replenishment Planner" description="Review the selected plan and workspace."/><Alert tone="error">{message}</Alert><Link href="/app/replenishment" className="inline-flex min-h-11 items-center rounded-sm text-primary underline">Choose a plan</Link></div>;
  const options=model.data&&!model.plans.items.some(plan=>plan.id===model.data!.plan.id)?[model.data.plan,...model.plans.items]:model.plans.items;
  const creationForm=<PlanCreation key={model.selected??"new"} runs={model.runs} selectedRunId={model.selected} canCreate={["owner","operator"].includes(context.workspace.role)} isSample={context.workspace.is_sample}/>;
  return <div className="space-y-6"><PageHeader title="Replenishment Planner" description="Review suggested quantities and prepare a purchasing plan that fits your available cash."/>{model.data?<details className="rounded-xl border bg-card p-5"><summary className="cursor-pointer text-sm font-medium">Create another purchasing plan</summary><div className="mt-4">{creationForm}</div></details>:creationForm}
    {options.length?<section className="flex flex-wrap items-end justify-between gap-4"><form key={model.data?.plan.id??"empty"} action="/app/replenishment" className="flex min-w-0 flex-wrap items-end gap-3"><div className="min-w-0"><label htmlFor="saved-plan" className="mb-2 block text-xs font-medium">Saved plans</label><Select id="saved-plan" name="planId" defaultValue={model.data?.plan.id??options[0].id}>{options.map(plan=><option key={plan.id} value={plan.id}>{plan.snapshotDate} · {plan.status} · rev {plan.revision} · {plan.id.slice(0,8)}</option>)}</Select></div><Button type="submit" variant="outline">Open saved plan</Button></form><div className="flex gap-4 text-xs"><Link href="/app/replenishment" className="inline-flex min-h-11 items-center rounded-sm text-primary underline">Latest plans</Link>{model.plans.nextCursor?<Link href={`/app/replenishment?plansCursor=${model.plans.nextCursor}`} className="inline-flex min-h-11 items-center rounded-sm text-primary underline">Older plans →</Link>:null}</div></section>:null}
    {model.data?<PlannerEditor key={`${model.data.plan.id}:${model.data.plan.revision}:${model.data.plan.stale}:${model.query.cursor??"first"}`} initialData={model.data} query={model.query} canEdit={["owner","operator"].includes(context.workspace.role)}/>:<section className="rounded-xl border bg-card p-8"><h2 className="text-lg font-semibold">Choose inputs before planning</h2><p className="mt-3 text-sm leading-6 text-muted-foreground">{context.workspace.is_sample?"Load the labeled sample plan above to explore approvals, budgets and supplier-delay scenarios.":"Choose a sufficient completed forecast above. Products with missing demand, stock, valid costs or reorder risk cannot receive invented purchase quantities."}</p><Link href="/app/forecasts" className={buttonVariants({variant:"outline",className:"mt-5"})}>Review forecast evidence</Link></section>}
  </div>;
}
