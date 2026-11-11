import { inventoryContext,readOverview } from "@/server/services/inventory";
import { endpoint } from "@/server/http";
import { productResponse } from "@/domain/inventory/risk";
export const GET=endpoint(async request=>{const context=await inventoryContext(request);const data=await readOverview(context);return {data:{summary:data.inventory.summary,attention:data.inventory.items.filter(item=>["at_risk","reorder_soon"].includes(item.risk.code)).map(productResponse),budget:data.budget,asOf:data.inventory.asOf},isSample:context.workspace.is_sample};});
