import type { NextRequest } from "next/server";
import { AppError } from "@/lib/auth/errors";
import { orderCsv } from "@/domain/orders/export";
import { requireWorkspace } from "@/server/auth/context";
import { endpoint } from "@/server/http";
import { readOrder } from "@/server/services/orders";
export async function GET(request:NextRequest,{params}:RouteContext<"/api/purchase-orders/[id]/export">){return endpoint(async req=>{
  const context=await requireWorkspace({workspaceId:req.headers.get("X-Workspace-Id")});
  const pairs=[...req.nextUrl.searchParams];if(pairs.length!==1||pairs[0][0]!=="format"||pairs[0][1]!=="csv")throw new AppError(400,"INVALID_FORMAT","Choose CSV export; use Print for a PDF.");
  const data=await readOrder(context,(await params).id);
  return {response:new Response(orderCsv(data),{headers:{"Content-Type":"text/csv; charset=utf-8","Content-Disposition":`attachment; filename="ReorderLens-draft-${data.order.id}.csv"`,"X-Content-Type-Options":"nosniff"}})};
})(request);}
