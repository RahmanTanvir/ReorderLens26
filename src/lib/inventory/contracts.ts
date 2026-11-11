import { z } from "zod";

export const riskCodes=["at_risk","reorder_soon","healthy","unknown"] as const;
export const sorts=["cover_asc","cover_desc","sku_asc","name_asc","risk"] as const;
const decimal=z.string().regex(/^\d+(\.\d+)?$/);
const date=z.iso.date();
const optionalFilter=z.string().transform(value=>value||undefined).optional();
export const inventoryQuerySchema=z.object({
  q:z.string().trim().max(500).default(""),status:optionalFilter.pipe(z.enum(riskCodes).optional()),
  supplierId:optionalFilter.pipe(z.uuid().optional()),sort:z.enum(sorts).default("cover_asc"),
  limit:z.coerce.number().int().min(1).max(100).default(25),cursor:z.string().min(1).max(4096).optional(),
}).strict();
export type InventoryQuery=z.infer<typeof inventoryQuerySchema>;
export const positionSchema=z.object({missing:z.boolean(),number:z.string().regex(/^-?\d+(\.\d+)?$/).max(100),text:z.string().max(250),id:z.uuid()}).strict();
export const rawRowSchema=z.object({
  id:z.uuid(),org_id:z.uuid(),sku:z.string(),name:z.string(),purchase_cost:decimal,pack_multiple:z.number().int(),
  supplier_id:z.uuid(),supplier_name:z.string(),supplier_active:z.boolean(),default_lead_time_days:z.number().int(),lead_time_days_override:z.number().int().nullable(),
  on_hand:z.number().int().nonnegative().nullable(),as_of_date:date.nullable(),future_snapshot:z.boolean(),
  estimated_daily_units:decimal.nullable(),quality:z.enum(["sufficient","insufficient","unavailable"]).nullable(),
  forecast_run_id:z.uuid().nullable(),method:z.enum(["seasonal_baseline","sample_fixture"]).nullable(),
  forecast_as_of:date.nullable(),forecast_created_at:z.string().nullable(),forecast_stale:z.boolean(),eligible_history_days:z.number().int().nullable(),availability_used:z.boolean().nullable(),limitation:z.string().nullable(),
  lead_days:z.number().int(),risk_code:z.enum(riskCodes),snapshot_stale:z.boolean(),is_sample:z.boolean(),
});
export type RawInventoryRow=z.infer<typeof rawRowSchema>;
export const summarySchema=z.object({total:z.number().int(),at_risk:z.number().int(),reorder_soon:z.number().int(),healthy:z.number().int(),unknown:z.number().int(),stale:z.number().int()});
export const rawListSchema=z.object({items:z.array(rawRowSchema),summary:summarySchema,matchCount:z.number().int(),suppliers:z.array(z.object({id:z.uuid(),name:z.string()})),asOf:date,revision:z.string(),nextPosition:positionSchema.nullable()});
export const rawDetailSchema=z.object({item:rawRowSchema,asOf:date,
  sales:z.array(z.object({date,units:z.number().int(),availability:z.enum(["available","stockout","unknown"]),promo:z.boolean()})),
  forecasts:z.array(z.object({date,units:decimal})),
});
export type RiskResult={code:typeof riskCodes[number];coverDays:string|null;gapDays:string|null;noDemand:boolean};
export type InventoryItem={id:string;sku:string;name:string;purchaseCost:string;packMultiple:number;supplier:{id:string;name:string;active:boolean;defaultLeadDays:number;overrideLeadDays:number|null};stock:{onHand:number;asOfDate:string}|null;demand:{dailyUnits:string|null;quality:RawInventoryRow["quality"];method:RawInventoryRow["method"];runId:string|null;asOfDate:string|null;eligibleHistoryDays:number|null;availabilityUsed:boolean|null;limitation:string|null};effectiveLeadDays:number;risk:RiskResult;warnings:string[];isSample:boolean};
export type InventoryList={items:InventoryItem[];summary:z.infer<typeof summarySchema>;matchCount:number;suppliers:z.infer<typeof rawListSchema>["suppliers"];asOf:string;nextCursor:string|null};
export type ProductDetail={item:InventoryItem;asOf:string;sales:z.infer<typeof rawDetailSchema>["sales"];forecasts:z.infer<typeof rawDetailSchema>["forecasts"]};
export const budgetSchema=z.object({planId:z.uuid(),budget:decimal,approvedTotal:decimal,remaining:z.string().regex(/^-?\d+(\.\d+)?$/),lineCount:z.number().int()});
export type InventoryOverview={inventory:InventoryList;budget:z.infer<typeof budgetSchema>|null};
export function inventoryHref(query:Partial<InventoryQuery>={},cursor?:string|null) {
  const params=new URLSearchParams();
  for(const key of ["q","status","supplierId","sort","limit"] as const)if(query[key]!==undefined&&query[key]!=="")params.set(key,String(query[key]));
  if(cursor)params.set("cursor",cursor);
  return `/app/inventory${params.size?`?${params}`:""}`;
}
export function inventoryBack(value:string|undefined) {
  try {const url=new URL(value??"/app/inventory","https://reorderlens.invalid");if(url.origin!=="https://reorderlens.invalid"||url.pathname!=="/app/inventory")return "/app/inventory";return url.pathname+url.search;}catch{return "/app/inventory";}
}
