import type { NextRequest } from "next/server";
import { convertPlanSchema } from "@/lib/orders/contracts";
import { requireWorkspace } from "@/server/auth/context";
import { endpoint,readJson } from "@/server/http";
import { convertPlan } from "@/server/services/orders";
export async function POST(request:NextRequest,{params}:RouteContext<"/api/plans/[id]/convert">){return endpoint(async req=>{const context=await requireWorkspace({workspaceId:req.headers.get("X-Workspace-Id"),roles:["owner","operator"]});const input=await readJson(req,convertPlanSchema);const data=await convertPlan(context,(await params).id,input.expectedRevision);return {data,isSample:context.workspace.is_sample,status:data.alreadyConverted?200:201};},true)(request);}
