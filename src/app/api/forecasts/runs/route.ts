import { generateForecastSchema } from "@/lib/forecast/contracts";
import { requireWorkspace } from "@/server/auth/context";
import { endpoint,readJson } from "@/server/http";
import { forecastQuery,generateForecast,listForecasts } from "@/server/services/forecasts";

export const GET=endpoint(async request=>{
  const context=await requireWorkspace({workspaceId:request.headers.get("X-Workspace-Id")});
  const query=forecastQuery(request.nextUrl.searchParams);
  const {items,nextCursor}=await listForecasts(context,query.limit,query.runsCursor);
  return {data:{items,pageInfo:{nextCursor}},isSample:context.workspace.is_sample};
});
export const POST=endpoint(async request=>{
  const context=await requireWorkspace({workspaceId:request.headers.get("X-Workspace-Id"),roles:["owner","operator"]});
  const data=await generateForecast(context,await readJson(request,generateForecastSchema));
  return {data,isSample:context.workspace.is_sample,status:data.reused?200:201};
},true);
