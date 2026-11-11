import { classifyStock,scaledRate } from "@/domain/inventory/risk";
import { planningInputSchema,type PlanningInput } from "@/lib/planning/contracts";

export function moneyMinor(value:string) {
  if(!/^-?\d{1,30}(\.\d{1,2})?$/.test(value))throw new Error("Invalid money");
  const negative=value.startsWith("-"),[whole,cents=""]=value.replace(/^-/ ,"").split(".");const result=BigInt(whole)*100n+BigInt(cents.padEnd(2,"0"));return negative?-result:result;
}
export function moneyString(value:bigint) {const negative=value<0n,n=negative?-value:value;return `${negative?"-":""}${n/100n}.${(n%100n).toString().padStart(2,"0")}`;}
const ceil=(n:bigint,d:bigint)=>(n+d-1n)/d;
const tier={at_risk:0,reorder_soon:1,healthy:2,unknown:3};
const ordinal=(a:string,b:string)=>{const left=Array.from(a),right=Array.from(b);for(let i=0;i<Math.min(left.length,right.length);i++){const difference=left[i].codePointAt(0)!-right[i].codePointAt(0)!;if(difference)return difference;}return left.length-right.length;};
export function buildPlan(inputs:PlanningInput[],budget:string,review=7,safety=2) {
  const funds=moneyMinor(budget);if(funds<0n||!Number.isInteger(review)||review<1||review>30||!Number.isInteger(safety)||safety<0||safety>30)throw new Error("Invalid plan assumptions");
  if(new Set(inputs.map(row=>row.productId)).size!==inputs.length)throw new Error("Duplicate product");
  let remaining=funds;
  const prepared=inputs.map(value=>{
    const input=planningInputSchema.parse(value),risk=classifyStock(input.onHand,input.dailyUnits,input.quality,input.leadDays,review);
    const rate=input.dailyUnits===null?0n:scaledRate(input.dailyUnits),cost=moneyMinor(input.purchaseCost),reasonCodes=[...input.warnings];
    const eligible=risk.code!=="unknown"&&risk.code!=="healthy"&&rate>0n&&cost>0n&&input.supplierActive;
    if(input.onHand===null)reasonCodes.push("MISSING_STOCK");
    if(input.quality!=="sufficient"||input.dailyUnits===null)reasonCodes.push("INSUFFICIENT_DEMAND");
    else if(rate===0n)reasonCodes.push("NO_RECENT_DEMAND");
    else if(risk.code==="healthy")reasonCodes.push("HEALTHY_STOCK");
    if(cost<=0n)reasonCodes.push("INVALID_COST");if(!input.supplierActive)reasonCodes.push("INACTIVE_SUPPLIER");
    let desired=0n;
    if(eligible){
      reasonCodes.push(risk.code==="at_risk"?"AT_RISK_BEFORE_ARRIVAL":"REORDER_WINDOW");
      const shortfall=rate*BigInt(input.leadDays+review+safety)-BigInt(input.onHand!)*10000n;
      const raw=shortfall>0n?ceil(shortfall,10000n):0n;desired=ceil(raw,BigInt(input.packMultiple))*BigInt(input.packMultiple);
      if(desired>2147483647n)throw new Error("QUANTITY_LIMIT");
      if(desired!==raw)reasonCodes.push("PACK_ROUNDING");
      if(input.leadDays+review+safety>input.forecastHorizon)reasonCodes.push("EXTRAPOLATED_RATE");
    }
    const gap=rate*BigInt(input.leadDays)-BigInt(input.onHand??0)*10000n;
    return {input,risk:risk.code,eligible,desired,cost,rate,gap:gap>0n&&rate>0n?gap:0n,reasonCodes};
  }).sort((a,b)=>{
    const priority=tier[a.risk]-tier[b.risk];if(priority)return priority;
    const left=a.gap*(b.rate||1n),right=b.gap*(a.rate||1n);
    return left!==right?left>right?-1:1:ordinal(a.input.sku,b.input.sku)||ordinal(a.input.productId,b.input.productId);
  });
  const lines=prepared.map((row,index)=>{
    const {input,cost}=row,pack=BigInt(input.packMultiple);
    const affordable=cost>0n?(remaining/(cost*pack))*pack:0n,allocated=row.eligible?(row.desired<affordable?row.desired:affordable):0n;
    if(allocated<row.desired)row.reasonCodes.push("BUDGET_LIMIT");remaining-=allocated*cost;
    return {...input,rank:index+1,risk:row.risk,eligible:row.eligible,desiredQty:Number(row.desired),suggestedQty:Number(allocated),approvedQty:Number(allocated),reasonCodes:row.reasonCodes,suggestedTotal:moneyString(allocated*cost),lineTotal:moneyString(allocated*cost)};
  });
  return {lines,suggestedTotal:moneyString(funds-remaining),remaining:moneyString(remaining)};
}
export function approvedTotals(lines:{approvedQty:number;purchaseCost:string;supplierId:string}[],budget:string) {
  let total=0n,units=0n,selected=0;for(const line of lines){if(!Number.isInteger(line.approvedQty)||line.approvedQty<0||line.approvedQty>2147483647)throw new Error("Invalid quantity");total+=BigInt(line.approvedQty)*moneyMinor(line.purchaseCost);units+=BigInt(line.approvedQty);if(line.approvedQty>0)selected++;}
  const remaining=moneyMinor(budget)-total;
  return {approvedTotal:moneyString(total),remaining:moneyString(remaining),overBudget:remaining<0n,overage:moneyString(remaining<0n?-remaining:0n),units:units.toString(),selectedCount:selected};
}
