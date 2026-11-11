import type { NextRequest } from "next/server";
import { requireWorkspace } from "@/server/auth/context";
import { endpoint,readJson } from "@/server/http";
import { editPlanSchema } from "@/lib/planning/contracts";
import { editPlan,planningQuery,readPlan } from "@/server/services/planning";
export async function GET(request:NextRequest,{params}:RouteContext<"/api/plans/[id]">) {
  return endpoint(async req=>{const context=await requireWorkspace({workspaceId:req.headers.get("X-Workspace-Id")}),{nextCursor,...data}=await readPlan(context,(await params).id,planningQuery(req.nextUrl.searchParams));return {data:{...data,pageInfo:{nextCursor}},isSample:context.workspace.is_sample};})(request);
}
export async function PATCH(request:NextRequest,{params}:RouteContext<"/api/plans/[id]">) {
  return endpoint(async req=>{const context=await requireWorkspace({workspaceId:req.headers.get("X-Workspace-Id"),roles:["owner","operator"]}),{nextCursor,...data}=await editPlan(context,(await params).id,await readJson(req,editPlanSchema,16384),planningQuery(req.nextUrl.searchParams));return {data:{...data,pageInfo:{nextCursor}},isSample:context.workspace.is_sample};},true)(request);
}
