import { inventoryContext,inventoryQuery,readInventory } from "@/server/services/inventory";
import { endpoint } from "@/server/http";
import { productResponse } from "@/domain/inventory/risk";
export const GET=endpoint(async request=>{
  const context=await inventoryContext(request);
  const data=await readInventory(context,inventoryQuery(request.nextUrl.searchParams));
  const {nextCursor,items,...rest}=data;
  return {data:{...rest,items:items.map(productResponse),pageInfo:{nextCursor}},isSample:context.workspace.is_sample};
});
