import type { NextRequest } from "next/server";
import { requireWorkspace } from "@/server/auth/context";
import { endpoint } from "@/server/http";
import { readOrder } from "@/server/services/orders";
export async function GET(request:NextRequest,{params}:RouteContext<"/api/purchase-orders/[id]">){return endpoint(async req=>{const context=await requireWorkspace({workspaceId:req.headers.get("X-Workspace-Id")});return {data:await readOrder(context,(await params).id),isSample:context.workspace.is_sample};})(request);}
