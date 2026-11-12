import type { NextRequest } from "next/server";
import { z } from "@/lib/validation/zod";
import { AppError } from "@/lib/auth/errors";
import { requireWorkspace } from "@/server/auth/context";
import { endpoint,readJson } from "@/server/http";
import { editQuantitySchema } from "@/lib/planning/contracts";
import { editPlan,planningQuery } from "@/server/services/planning";
export async function PATCH(request:NextRequest,{params}:RouteContext<"/api/plans/[id]/lines/[lineId]">) {
  return endpoint(async req=>{const context=await requireWorkspace({workspaceId:req.headers.get("X-Workspace-Id"),roles:["owner","operator"]}),{id,lineId}=await params;
    if(!z.uuid().safeParse(lineId).success)throw new AppError(404,"PLAN_LINE_NOT_FOUND","This plan line is not available in this workspace.");
    const input=await readJson(req,editQuantitySchema),{nextCursor,...data}=await editPlan(context,id,{expectedRevision:input.expectedRevision,quantities:[{lineId,approvedQty:input.approvedQty}]},planningQuery(req.nextUrl.searchParams));return {data:{...data,pageInfo:{nextCursor}},isSample:context.workspace.is_sample};},true)(request);
}
