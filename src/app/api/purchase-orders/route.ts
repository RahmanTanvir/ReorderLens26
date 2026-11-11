import type { NextRequest } from "next/server";
import { requireWorkspace } from "@/server/auth/context";
import { endpoint } from "@/server/http";
import { listOrders,orderQuery } from "@/server/services/orders";
export const GET=endpoint(async(request:NextRequest)=>{const context=await requireWorkspace({workspaceId:request.headers.get("X-Workspace-Id")});const {nextCursor,...data}=await listOrders(context,orderQuery(request.nextUrl.searchParams));return {data:{...data,pageInfo:{nextCursor}},isSample:context.workspace.is_sample};});
