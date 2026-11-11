import Link from "next/link";
import { ForecastWorkspace } from "@/components/forecasts/forecast-workspace";
import { PageHeader } from "@/components/shared/page-header";
import { Alert } from "@/components/ui/alert";
import { AppError } from "@/lib/auth/errors";
import { requirePageWorkspace } from "@/server/auth/context";
import { dhakaDate,forecastQuery,listForecasts,readForecast } from "@/server/services/forecasts";
export const metadata={title:"Demand forecasts — ReorderLens"};
export default async function ForecastPage({searchParams}:PageProps<"/app/forecasts">) {
  const context=await requirePageWorkspace();
  let model=null;let message="This forecast selection could not be loaded.";
  try {
    const query=forecastQuery(await searchParams),list=await listForecasts(context,25,query.runsCursor),id=query.runId??list.items[0]?.id;
    model={query,list,detail:id?await readForecast(context,id,query):null};
  }catch(error){if(error instanceof AppError&&[400,404].includes(error.status))message=error.message;else throw error;}
  if(!model)return <div className="space-y-5"><PageHeader title="Demand forecasts" description="Review the saved run and product selection."/><Alert tone="error">{message}</Alert><Link className="inline-flex min-h-11 items-center rounded-sm text-primary underline" href="/app/forecasts">Open latest saved runs</Link></div>;
  return <ForecastWorkspace today={dhakaDate()} isSample={context.workspace.is_sample} canGenerate={!context.workspace.is_sample&&["owner","operator"].includes(context.workspace.role)} runs={model.list.items} runsCursor={model.list.nextCursor} query={model.query} detail={model.detail}/>;
}
