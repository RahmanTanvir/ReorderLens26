// Explicit fictional test fixtures; never imported by production modules.
import type { RawInventoryRow,InventoryList,ProductDetail } from "@/lib/inventory/contracts";
import { inventoryItem } from "@/domain/inventory/risk";
export const orgId="60000000-0000-4000-8000-000000000001";
export const productId="60000000-0000-4000-8000-000000000002";
export const rawRow:RawInventoryRow={id:productId,org_id:orgId,sku:"QA-OIL",name:"Fictional QA Oil",purchase_cost:"210.00",pack_multiple:1,supplier_id:"60000000-0000-4000-8000-000000000003",supplier_name:"Fictional QA supplier",supplier_active:true,default_lead_time_days:6,lead_time_days_override:null,on_hand:38,as_of_date:"2026-11-09",future_snapshot:false,estimated_daily_units:"7.0000",quality:"sufficient",forecast_run_id:"60000000-0000-4000-8000-000000000004",method:"seasonal_baseline",forecast_as_of:"2026-11-09",forecast_created_at:"2026-11-09T10:00:00Z",forecast_stale:false,eligible_history_days:14,availability_used:false,limitation:"Fictional test evidence",lead_days:6,risk_code:"at_risk",snapshot_stale:false,is_sample:false};
export const rawList={items:[rawRow],summary:{total:1,at_risk:1,reorder_soon:0,healthy:0,unknown:0,stale:0},matchCount:1,suppliers:[{id:rawRow.supplier_id,name:rawRow.supplier_name}],asOf:"2026-11-11",revision:"0".repeat(32),nextPosition:null};
export const list:InventoryList={...rawList,items:[inventoryItem(rawRow)],nextCursor:null};
export const detail:ProductDetail={item:list.items[0],asOf:list.asOf,sales:[{date:"2026-11-07",units:7,availability:"unknown",promo:false},{date:"2026-11-09",units:0,availability:"stockout",promo:false}],forecasts:[]};
