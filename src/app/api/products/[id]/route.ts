import type { NextRequest } from "next/server";
import { inventoryContext,readProduct } from "@/server/services/inventory";
import { endpoint } from "@/server/http";
import { productResponse } from "@/domain/inventory/risk";
export async function GET(request:NextRequest,route:RouteContext<"/api/products/[id]">) {
  const {id}=await route.params;
  return endpoint(async request=>{const context=await inventoryContext(request);const data=await readProduct(context,id);return {data:{...productResponse(data.item),salesHistory:data.sales,forecastPoints:data.forecasts,asOf:data.asOf},isSample:context.workspace.is_sample};})(request);
}
