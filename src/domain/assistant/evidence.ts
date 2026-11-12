import { displayCover,displayGap,displayUnits,formatBDT,riskLabels } from "@/domain/inventory/risk";
import { reasonText as forecastReasons,type ForecastDetail } from "@/lib/forecast/contracts";
import { reasonText as planReasons,type Plan,type PlanLine,type ScenarioResult } from "@/lib/planning/contracts";
import type { InventoryItem,InventoryList } from "@/lib/inventory/contracts";
import type { OrderRead } from "@/lib/orders/contracts";
import type { AssistantAnswer,EvidencePacket,Fact,Intent,Source } from "@/lib/assistant/contracts";

function base(intent:Intent,subject:string,isSample:boolean):AssistantAnswer{return {kind:"deterministic_explanation",intent,subject,finding:"Saved evidence is required for this explanation.",evidence:[],sources:[],limitations:[],choices:[],isSample,stale:false,nextStep:{label:"Review inventory",href:"/app/inventory"},provider:{used:false,model:null,reason:"disabled"}};}
function finish(answer:AssistantAnswer):EvidencePacket{
  if(answer.isSample)answer.limitations.unshift("Illustrative sample data; these are not real business results.");
  answer.limitations=[...new Set(answer.limitations)].slice(0,10);
  return {answer,findings:[answer.finding,`Based on the saved evidence: ${answer.finding}`]};
}
function fact(a:AssistantAnswer,id:string,label:string,value:string|number,sourceId:string){a.evidence.push({id,label,value:String(value),sourceId});}
function source(a:AssistantAnswer,id:string,label:string,asOf:string,href:string){a.sources.push({id,label,asOf,href});}
export function guidance(intent:Intent,isSample:boolean,finding?:string):EvidencePacket{
  const a=base(intent,"ReorderLens Insight",isSample);a.kind=intent==="refusal"?"refusal":"clarification";
  a.finding=finding??(intent==="refusal"?"I can help explain your inventory and purchasing decisions, but I can't carry out actions, reveal private information or answer unrelated questions. To make a change, use the relevant page and review it there.":"I can help you understand which products need attention, why a forecast is limited, how a saved purchasing quantity was chosen, and what a supplier delay changes.\n\nTry asking “Which products need attention?” or open a product and ask “Why is this at risk?” I can explain your saved decisions, but I can't change stock or place orders.");
  a.limitations.push("Read-only explanations do not change forecasts, quantities, budgets, orders or stock.");return finish(a);
}
export function stockEvidence(item:InventoryItem,readOn?:string):EvidencePacket{
  const a=base("stock",`${item.name} · ${item.sku}`,item.isSample),href=`/app/inventory/${item.id}`;
  if(item.stock){source(a,"stock","Saved stock snapshot",item.stock.asOfDate,href);fact(a,"on_hand","On-hand units",item.stock.onHand,"stock");}
  if(item.demand.asOfDate){source(a,"demand",item.demand.method==="sample_fixture"?"Illustrative demand rate":"Completed forecast",item.demand.asOfDate,item.demand.runId?`/app/forecasts?runId=${item.demand.runId}&productId=${item.id}`:href);}
  source(a,"settings","Product/supplier settings read on",readOn??"Update timestamp not exposed",href);
  fact(a,"lead_days","Nominal supplier lead time",`${item.effectiveLeadDays} days`,"settings");
  const provenance=item.demand.asOfDate?"demand":item.stock?"stock":null;
  if(provenance)fact(a,"risk","Saved risk classification",riskLabels[item.risk.code],provenance);
  if(item.demand.quality==="sufficient"&&item.demand.dailyUnits!==null&&provenance)fact(a,"daily_units","Estimated demand",`${item.demand.dailyUnits} units/day`,provenance);
  const cover=displayCover(item),gap=displayGap(item);
  if(cover!==null&&provenance)fact(a,"cover_days","Estimated stock cover",`${cover} days`,provenance);
  if(gap!==null&&provenance)fact(a,"gap_days","Potential gap before arrival",`${gap} days`,provenance);
  const stockSummary=item.stock&&cover!==null&&item.demand.dailyUnits!==null?`You have ${item.stock.onHand} units. At the estimated ${displayUnits(item.demand.dailyUnits)} units a day, that's about ${cover} days of stock. `:"";
  a.finding=item.risk.code==="at_risk"?`${stockSummary}The nominal lead time is ${item.effectiveLeadDays} days, so you could run out before an order placed today arrives.${gap&&gap!=="0.0"?` The potential gap is about ${gap} days.`:""}`:item.risk.code==="reorder_soon"?`${stockSummary}You're within the lead-time plus review window, so it's time to review replenishment.`:item.risk.noDemand?"The saved demand estimate is zero, so there isn't a meaningful days-of-stock figure. This is recorded zero demand, rather than missing history.":item.risk.code==="healthy"?`${stockSummary}That's outside the current reorder window, so this product isn't flagged for replenishment yet.`:"I can't judge the stockout risk yet: stock or sufficient demand history is missing. That doesn't mean demand is zero or the product is safe from running out.";
  if(item.risk.code==="unknown")a.kind="insufficient_data";
  a.stale=item.warnings.includes("STALE_SNAPSHOT")||item.warnings.includes("STALE_FORECAST");
  a.limitations.push("Lead time estimates arrival only if ordered today; it is not a confirmed shipment. Draft orders do not add on-hand stock.","Saved demand is an estimate; no calibrated uncertainty or proven forecast accuracy is claimed.");
  if(a.stale)a.limitations.unshift("This explanation uses stale saved evidence. Review source dates and regenerate after changed imports.");
  if(item.warnings.includes("FUTURE_SNAPSHOT_IGNORED"))a.limitations.push("A future-dated stock snapshot was excluded.");
  a.nextStep={label:item.risk.code==="unknown"?"Review forecast evidence":"Review replenishment inputs",href:item.risk.code==="unknown"?"/app/forecasts":"/app/replenishment"};return finish(a);
}
export function inventoryEvidence(data:InventoryList,isSample:boolean):EvidencePacket{
  const a=base("stock","Workspace inventory",isSample);source(a,"inventory","Inventory evaluated on",data.asOf,"/app/inventory");
  for(const [id,label] of [["total","Tracked products"],["at_risk","At risk before arrival"],["reorder_soon","Reorder attention"],["unknown","Insufficient evidence"]] as const)fact(a,id,label,data.summary[id],"inventory");
  a.finding=data.summary.total===0?"There aren't any saved products in this workspace yet. Import your catalog and stock to get started.":data.summary.at_risk>0?`${data.summary.at_risk} of your ${data.summary.total} products could run out before new stock arrives if ordered today. Start with those in Inventory.${data.summary.unknown?` Another ${data.summary.unknown} ${data.summary.unknown===1?"product needs":"products need"} more evidence before I can judge the risk.`:""}`:data.summary.unknown===data.summary.total?"I can't assess any of your products yet because stock or demand evidence is missing. The zero at-risk count doesn't mean everything is healthy. Start by checking the missing evidence in Inventory.":`None of your ${data.summary.total} products are currently classified as at risk before arrival.${data.summary.reorder_soon?` ${data.summary.reorder_soon} still need replenishment attention.`:""}${data.summary.unknown?` ${data.summary.unknown} can't be assessed yet because evidence is missing.`:""}`;
  if(!data.summary.total||data.summary.unknown===data.summary.total)a.kind="insufficient_data";
  a.stale=data.summary.stale>0;if(a.stale)a.limitations.push("Some source records are stale; inspect product dates before making decisions.");
  a.limitations.push("Counts summarize saved records, not a live POS feed.");a.nextStep={label:"Inspect inventory evidence",href:"/app/inventory?sort=risk"};return finish(a);
}
export function forecastEvidence(data:ForecastDetail,isSample:boolean):EvidencePacket{
  const {run,selected}=data,a=base("forecast",selected?`${selected.item.name} · ${selected.item.sku}`:"Saved forecast",isSample);
  const href=`/app/forecasts?runId=${run.id}${selected?`&productId=${selected.item.productId}`:""}`;source(a,"forecast","Saved forecast cutoff",run.asOfDate,href);
  a.stale=run.staleAt!==null;
  if(!selected){a.kind="insufficient_data";a.finding="This saved run has no selected product evidence.";a.nextStep={label:"Inspect saved run",href};return finish(a);}
  const item=selected.item;fact(a,"horizon","Saved horizon",`${run.horizonDays} days`,"forecast");
  if(isSample||run.method==="sample_fixture"){
    a.finding="This is an illustrative daily rate, not a forecast fitted from history. You can use it to explore sample decisions, but it doesn't support a real forecast curve.";
    if(item.dailyUnits!==null)fact(a,"daily_units","Illustrative daily rate",`${item.dailyUnits} units/day`,"forecast");
  }else{
    fact(a,"eligible_days","Eligible recorded days",item.eligibleDays,"forecast");fact(a,"observed_days","Recorded days",item.observedDays,"forecast");fact(a,"stockout_days","Stockout days excluded",item.stockoutDays,"forecast");fact(a,"unknown_days","Unknown-availability days",item.unknownDays,"forecast");
    if(item.dailyUnits!==null)fact(a,"daily_units","Saved mean daily estimate",`${item.dailyUnits} units/day`,"forecast");
    if(item.horizonTotal!==null)fact(a,"horizon_total","Saved projected horizon total",`${item.horizonTotal} units`,"forecast");
    a.finding=item.quality==="sufficient"&&item.dailyUnits!==null?`The saved forecast estimates ${displayUnits(item.dailyUnits)} units a day${item.horizonTotal!==null?`, or ${displayUnits(item.horizonTotal)} units over ${run.horizonDays} days`:""}. It uses ${item.eligibleDays} eligible days out of ${item.observedDays} recorded days. Weekday averages are used where there's enough history; otherwise it uses the eligible-day average.`:`The run finished, but I can't give a reliable estimate for this product yet. It has ${item.eligibleDays} eligible days out of ${item.observedDays} recorded days, and needs enough eligible history plus a recent observation. The blank forecast means “not enough evidence,” not zero demand.`;
    if(item.quality!=="sufficient"||item.dailyUnits===null)a.kind="insufficient_data";
  }
  a.limitations.push(...item.reasonCodes.map(code=>forecastReasons[code]).filter(Boolean),"Missing dates remain missing; excluded stockout records do not reconstruct lost sales.","No calibrated interval, promotional effect or proven model accuracy is claimed.");
  if(a.stale)a.limitations.unshift("A later import invalidated this saved forecast; its original evidence is shown for review.");
  a.nextStep={label:"Inspect exact saved forecast evidence",href};return finish(a);
}
export function quantityEvidence(plan:Plan,items:PlanLine[],productId?:string,isSample=false):EvidencePacket{
  const line=productId?items.find(x=>x.productId===productId):null,a=base("quantity",line?`${line.name} · ${line.sku}`:"Saved purchasing plan",isSample),href=`/app/replenishment?planId=${plan.id}`;
  source(a,"plan","Saved plan input date",plan.snapshotDate,href);fact(a,"budget","Saved purchasing budget",formatBDT(plan.budget),"plan");fact(a,"approved_total","Saved approved total",formatBDT(plan.summary.approvedTotal),"plan");fact(a,"remaining","Saved budget remaining",formatBDT(plan.summary.remaining),"plan");fact(a,"revision","Saved revision",plan.revision,"plan");
  a.finding=plan.summary.overBudget?`Your saved quantities total ${formatBDT(plan.summary.approvedTotal)}, above the ${formatBDT(plan.budget)} budget. Reduce the quantities or adjust and save the budget before creating drafts.`:`Your saved plan allocates ${formatBDT(plan.summary.approvedTotal)} of the ${formatBDT(plan.budget)} budget, leaving ${formatBDT(plan.summary.remaining)}. The original suggestions prioritize stockout risk, the gap before arrival, then SKU. This is a practical allocation, not a guarantee of the best possible mix.`;
  if(line){
    fact(a,"suggested_qty","Original suggested units",line.suggestedQty,"plan");fact(a,"approved_qty","Saved approved units",line.approvedQty,"plan");fact(a,"desired_qty","Desired units before budget allocation",line.desiredQty,"plan");fact(a,"pack","Whole pack multiple",line.packMultiple,"plan");fact(a,"unit_cost","Saved unit cost",formatBDT(line.purchaseCost),"plan");fact(a,"line_total","Saved approved line total",formatBDT(line.lineTotal),"plan");fact(a,"target_days","Lead + review + safety target",`${line.leadDays+plan.reviewPeriodDays+plan.safetyDays} days`,"plan");
    a.finding=!line.eligible?"This product didn't qualify for a purchase recommendation. Check its evidence and reasons below before deciding whether anything needs changing.":line.reasonCodes.includes("BUDGET_LIMIT")?`The original budget couldn't cover all ${line.desiredQty} desired units. After prioritizing risk and whole packs, the suggestion was ${line.suggestedQty} units. Your saved approved quantity is ${line.approvedQty}; that is the quantity used in the plan total.`:`The original suggestion was ${line.suggestedQty} units: enough to cover the ${line.leadDays+plan.reviewPeriodDays+plan.safetyDays}-day lead, review and safety target after existing stock, rounded to packs of ${line.packMultiple}. Your saved approved quantity is ${line.approvedQty}.`;
    a.limitations.push(...line.reasonCodes.map(code=>planReasons[code]).filter(Boolean));
  }
  a.stale=plan.stale;if(plan.stale)a.limitations.unshift("A later import changed the inputs. Create a fresh forecast and plan before editing or conversion.");
  if(plan.method==="sample_fixture")a.finding=`This sample plan starts with predefined illustrative quantities, rather than calculated recommendations.${line?` The original suggestion is ${line.suggestedQty} units and your saved approved quantity is ${line.approvedQty}.`:""} The saved total is ${formatBDT(plan.summary.approvedTotal)} against a ${formatBDT(plan.budget)} budget.`;
  a.limitations.push("Changing the budget does not recalculate saved suggestions. Reset restores original suggestions.","Buying from the same supplier cannot prevent a shortage before that supplier could arrive. Drafts are not received stock.");
  a.nextStep={label:"Review this saved plan",href};return finish(a);
}
export function scenarioEvidence(result:ScenarioResult):EvidencePacket{
  const a=base("scenario",result.supplierName,result.isSample),href=`/app/scenarios?planId=${result.planId}`;source(a,"scenario","Saved plan input date",result.snapshotDate,href);
  fact(a,"extra_days","Simulated extra supplier delay",`${result.extraDelayDays} days`,"scenario");fact(a,"baseline_risk","At risk before delay",result.summary.baselineAtRisk,"scenario");fact(a,"delayed_risk","At risk after delay",result.summary.delayedAtRisk,"scenario");fact(a,"newly_at_risk","Newly at risk",result.summary.newlyAtRisk,"scenario");fact(a,"already_at_risk","Already at risk",result.summary.alreadyAtRisk,"scenario");
  for(const [i,row] of result.items.slice(0,3).entries()){
    fact(a,`product_${i}_lead`,`${row.sku} nominal lead change`,`${row.baselineLeadDays} → ${row.delayedLeadDays} days`,"scenario");
    if(row.coverDisplay!==null)fact(a,`product_${i}_cover`,`${row.sku} saved stock cover`,`${row.coverDisplay} days`,"scenario");
    if(row.delayedGapDisplay!==null)fact(a,`product_${i}_gap`,`${row.sku} pre-arrival gap change`,`${row.baselineGapDisplay} → ${row.delayedGapDisplay} days`,"scenario");
  }
  a.finding=result.extraDelayDays===0?"With no extra delay, the result matches your saved timing baseline. Your plan hasn't changed.":`With ${result.extraDelayDays} extra days of supplier delay, ${result.summary.delayedAtRisk} ${result.summary.delayedAtRisk===1?"product is":"products are"} at risk before arrival, compared with ${result.summary.baselineAtRisk} before.${result.summary.newlyAtRisk?` That's ${result.summary.newlyAtRisk} newly at risk.`:" No additional products become at risk in the sufficient saved data."} This is a timing comparison; it hasn't changed your plan or supplier details.`;
  a.stale=result.stale;if(a.stale)a.limitations.push("This scenario uses stale saved inputs; review a fresh plan before decisions.");
  if(result.summary.unknown)a.limitations.push("Products with insufficient evidence remain unknown, not healthy.");
  a.limitations.push("Only effective supplier lead times are simulated. Saved budgets, approvals, suppliers, stock and orders are not changed.","Lead times are nominal estimates, not confirmed delivery dates.");a.nextStep={label:"Review supplier-delay inputs",href};return finish(a);
}
export function orderEvidence(data:OrderRead):EvidencePacket{
  const {order}=data,a=base("order",order.orderNumber,order.document.isSample),href=`/app/purchase-orders/${order.id}`;
  source(a,"order","Saved draft created",order.createdAt,href);fact(a,"draft_total","Saved draft total",formatBDT(order.total),"order");fact(a,"lines","Saved product lines",order.lineCount,"order");fact(a,"units","Saved total units",order.units,"order");fact(a,"reviewed_revision","Reviewed plan revision",order.document.planRevision,"order");
  a.finding=`This is a saved draft for ${formatBDT(order.total)} across ${order.lineCount} product lines. It hasn't been sent, paid or received. The reviewed quantities and prices are fixed in this document; downloading it doesn't place the order.`;
  a.limitations.push("Additional charges are not included. Nominal lead times are not confirmed delivery dates.","Later imports do not rewrite this saved document. Draft purchases do not add on-hand stock.");a.nextStep={label:"Inspect saved draft and export",href};return finish(a);
}
export function applyModelSelection(packet:EvidencePacket,selection:{finding:string;evidence:string[];nextStep:string;limitations:string[]}):AssistantAnswer|null{
  const {answer}=packet;
  if(!packet.findings.includes(selection.finding)||selection.nextStep!=="source"||selection.evidence.length!==new Set(selection.evidence).size||selection.evidence.length!==answer.evidence.length||answer.evidence.some(f=>!selection.evidence.includes(f.id))||selection.limitations.length!==answer.limitations.length||answer.limitations.some(l=>!selection.limitations.includes(l)))return null;
  const byId=new Map(answer.evidence.map(f=>[f.id,f]));
  return {...answer,kind:"grounded_explanation",finding:selection.finding,evidence:selection.evidence.map(id=>byId.get(id)!),limitations:selection.limitations};
}
export function providerFacts(packet:EvidencePacket):{id:string;value:string}[]{return packet.answer.evidence.map(({id,value}:Fact)=>({id,value}));}
export function verifySources(answer:AssistantAnswer){const ids=new Set(answer.sources.map((s:Source)=>s.id));return answer.evidence.every(f=>ids.has(f.sourceId));}
