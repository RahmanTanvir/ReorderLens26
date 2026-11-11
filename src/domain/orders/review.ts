import type { PlanLine } from "@/lib/planning/contracts";
import { moneyMinor,moneyString } from "@/domain/planning/planner";

export function groupApprovedLines(lines:PlanLine[]) {
  const groups=new Map<string,{id:string;name:string;items:PlanLine[];minor:bigint}>();
  for(const line of lines)if(line.approvedQty>0){const group=groups.get(line.supplierId)??{id:line.supplierId,name:line.supplierName,items:[],minor:0n};group.items.push(line);group.minor+=BigInt(line.approvedQty)*moneyMinor(line.purchaseCost);groups.set(group.id,group);}
  return [...groups.values()].sort((a,b)=>a.name<b.name?-1:a.name>b.name?1:a.id<b.id?-1:1).map(({minor,...group})=>({...group,total:moneyString(minor)}));
}
