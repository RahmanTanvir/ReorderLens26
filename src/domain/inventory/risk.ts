import type { InventoryItem,RawInventoryRow,RiskResult } from "@/lib/inventory/contracts";

export function scaledRate(value:string) {
  if(!/^\d+(\.\d{1,4})?$/.test(value))throw new Error("Invalid stored daily rate");
  const [whole,fraction=""]=value.split(".");return BigInt(whole)*10000n+BigInt(fraction.padEnd(4,"0"));
}
export function fractionString(numerator:bigint,denominator:bigint,places:number) {
  if(denominator<=0n||numerator<0n)throw new Error("Invalid ratio");
  const scale=10n**BigInt(places),rounded=(numerator*scale*2n+denominator)/(denominator*2n);
  return `${rounded/scale}${places?"."+(rounded%scale).toString().padStart(places,"0"):""}`;
}
export function classifyStock(onHand:number|null,daily:string|null,quality:string|null,lead:number|null,review=7):RiskResult {
  if(onHand===null||!Number.isInteger(onHand)||onHand<0||daily===null||quality!=="sufficient"||lead===null||!Number.isInteger(lead)||lead<0||!Number.isInteger(review)||review<0)return {code:"unknown",coverDays:null,gapDays:null,noDemand:false};
  const demand=scaledRate(daily);
  if(demand===0n)return {code:"healthy",coverDays:null,gapDays:null,noDemand:true};
  const stock=BigInt(onHand)*10000n;
  const code=onHand===0||stock<BigInt(lead)*demand?"at_risk":stock<=BigInt(lead+review)*demand?"reorder_soon":"healthy";
  const gap=BigInt(lead)*demand-stock;
  return {code,coverDays:fractionString(stock,demand,4),gapDays:fractionString(gap>0n?gap:0n,demand,4),noDemand:false};
}
export function inventoryItem(row:RawInventoryRow):InventoryItem {
  const risk=classifyStock(row.on_hand,row.estimated_daily_units,row.quality,row.lead_days);
  if(risk.code!==row.risk_code)throw new Error("Inventory risk contract mismatch");
  const warnings:string[]=[];
  if(row.is_sample)warnings.push("ILLUSTRATIVE_SAMPLE");
  if(row.snapshot_stale)warnings.push("STALE_SNAPSHOT");
  if(row.forecast_stale)warnings.push("STALE_FORECAST");
  if(row.future_snapshot)warnings.push("FUTURE_SNAPSHOT_IGNORED");
  if(!row.supplier_active)warnings.push("INACTIVE_SUPPLIER");
  return {id:row.id,sku:row.sku,name:row.name,purchaseCost:row.purchase_cost,packMultiple:row.pack_multiple,
    supplier:{id:row.supplier_id,name:row.supplier_name,active:row.supplier_active,defaultLeadDays:row.default_lead_time_days,overrideLeadDays:row.lead_time_days_override},
    stock:row.on_hand!==null&&row.as_of_date?{onHand:row.on_hand,asOfDate:row.as_of_date}:null,
    demand:{dailyUnits:row.estimated_daily_units,quality:row.quality,method:row.method,runId:row.forecast_run_id,asOfDate:row.forecast_as_of,eligibleHistoryDays:row.eligible_history_days,availabilityUsed:row.availability_used,limitation:row.limitation},
    effectiveLeadDays:row.lead_days,risk,warnings,isSample:row.is_sample};
}
export function oneDecimal(value:string) {return fractionString(scaledRate(value),10000n,1);}
export function displayCover(item:InventoryItem) {
  if(item.risk.coverDays===null||!item.stock||item.demand.dailyUnits===null)return null;
  return fractionString(BigInt(item.stock.onHand)*10000n,scaledRate(item.demand.dailyUnits),1);
}
export function displayGap(item:InventoryItem) {
  if(item.risk.gapDays===null||!item.stock||item.demand.dailyUnits===null)return null;
  const demand=scaledRate(item.demand.dailyUnits),gap=BigInt(item.effectiveLeadDays)*demand-BigInt(item.stock.onHand)*10000n;
  return fractionString(gap>0n?gap:0n,demand,1);
}
export function formatBDT(value:string) {
  if(!/^-?\d+(\.\d{1,2})?$/.test(value))throw new Error("Invalid BDT value");
  const negative=value.startsWith("-");const [whole,cents=""]=value.replace(/^-/ ,"").split(".");
  return `${negative?"−":""}৳${new Intl.NumberFormat("en-BD").format(BigInt(whole))}.${cents.padEnd(2,"0")}`;
}
export const riskLabels={at_risk:"At risk",reorder_soon:"Reorder soon",healthy:"Healthy",unknown:"Insufficient data"} as const;
export function displayUnits(value:string) {return value.includes(".")?value.replace(/0+$/,"").replace(/\.$/,""):value;}
// Public API field names follow API_SPECIFICATION; UI uses the checked domain DTO.
export function productResponse(item:InventoryItem) {
  return {id:item.id,sku:item.sku,name:item.name,purchaseCost:item.purchaseCost,packMultiple:item.packMultiple,
    supplier:{id:item.supplier.id,name:item.supplier.name,defaultLeadTimeDays:item.supplier.defaultLeadDays,active:item.supplier.active},
    effectiveLeadTimeDays:item.effectiveLeadDays,stock:item.stock,
    demand:{estimatedDailyUnits:item.demand.dailyUnits,forecastRunId:item.demand.runId,quality:item.demand.quality,method:item.demand.method,asOfDate:item.demand.asOfDate,limitation:item.demand.limitation},
    coverDays:item.risk.coverDays,risk:{code:item.risk.code,gapBeforeArrivalDays:item.risk.gapDays,noRecentDemand:item.risk.noDemand},dataWarnings:item.warnings};
}
