import { classifyStock,fractionString,scaledRate } from "@/domain/inventory/risk";
import type { PlanLine } from "@/lib/planning/contracts";

export function compareDelay(lines:PlanLine[],supplierId:string,delay:number,review=7) {
  if(!Number.isInteger(delay)||delay<0||delay>30)throw new Error("Invalid delay");
  if(!lines.some(line=>line.supplierId===supplierId))throw new Error("Supplier is not in this plan");
  const items=lines.map(line=>{
    const affected=line.supplierId===supplierId,delayedLeadDays=line.leadDays+(affected?delay:0);
    const baseline=classifyStock(line.onHand,line.dailyUnits,line.quality,line.leadDays,review),changed=classifyStock(line.onHand,line.dailyUnits,line.quality,delayedLeadDays,review);
    const rate=line.dailyUnits===null?0n:scaledRate(line.dailyUnits),gap=(lead:number,places=4)=>{const n=BigInt(lead)*rate-BigInt(line.onHand??0)*10000n;return rate>0n&&baseline.code!=="unknown"?fractionString(n>0n?n:0n,rate,places):null;};
    const coverDisplay=rate>0n&&baseline.code!=="unknown"?fractionString(BigInt(line.onHand!)*10000n,rate,1):null;
    return {productId:line.productId,sku:line.sku,name:line.name,supplierId:line.supplierId,affected,coverDays:baseline.coverDays,coverDisplay,baselineLeadDays:line.leadDays,delayedLeadDays,baselineGapDays:gap(line.leadDays),delayedGapDays:gap(delayedLeadDays),baselineGapDisplay:gap(line.leadDays,1),delayedGapDisplay:gap(delayedLeadDays,1),baselineRisk:baseline.code,delayedRisk:changed.code,newlyAtRisk:baseline.code!=="at_risk"&&changed.code==="at_risk",alreadyAtRisk:baseline.code==="at_risk",quality:line.quality,reasonCodes:line.reasonCodes};
  });
  const affected=items.filter(item=>item.affected);
  return {items,summary:{baselineAtRisk:affected.filter(item=>item.baselineRisk==="at_risk").length,delayedAtRisk:affected.filter(item=>item.delayedRisk==="at_risk").length,newlyAtRisk:affected.filter(item=>item.newlyAtRisk).length,alreadyAtRisk:affected.filter(item=>item.alreadyAtRisk).length,affectedCount:affected.length,unknown:affected.filter(item=>item.delayedRisk==="unknown").length}};
}
