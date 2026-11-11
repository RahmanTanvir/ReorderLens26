import { NextRequest } from "next/server";
import { requireWorkspace } from "@/server/auth/context";
import { endpoint } from "@/server/http";
import { forecastQuery,readForecast } from "@/server/services/forecasts";

export async function GET(request:NextRequest,{params}:RouteContext<"/api/forecasts/runs/[id]">) {
  return endpoint(async req=>{
    const context=await requireWorkspace({workspaceId:req.headers.get("X-Workspace-Id")});
    const {nextCursor,...data}=await readForecast(context,(await params).id,forecastQuery(req.nextUrl.searchParams));
    return {data:{...data,pageInfo:{nextCursor}},isSample:context.workspace.is_sample};
  })(request);
}
