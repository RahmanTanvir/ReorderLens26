import "server-only";
import { createHash } from "node:crypto";
import { z } from "@/lib/validation/zod";
import { AppError } from "@/lib/auth/errors";
import { answerSchema,type AssistantInput,type EvidencePacket,type Intent } from "@/lib/assistant/contracts";
import { inventoryQuerySchema } from "@/lib/inventory/contracts";
import { forecastQuerySchema } from "@/lib/forecast/contracts";
import { planningQuerySchema } from "@/lib/planning/contracts";
import { guidance,stockEvidence,inventoryEvidence,forecastEvidence,quantityEvidence,scenarioEvidence,orderEvidence,verifySources } from "@/domain/assistant/evidence";
import { productSearch,resolveIntent } from "@/domain/assistant/intent";
import { requireWorkspace } from "@/server/auth/context";
import { getServerEnvironment } from "@/server/config/environment";
import { databaseFailure } from "@/server/http";
import { readProduct,readInventory } from "@/server/services/inventory";
import { listForecasts,readForecast } from "@/server/services/forecasts";
import { readPlanContext,scenarioFromContext } from "@/server/services/planning";
import { readOrder } from "@/server/services/orders";
import { modelExplanation,providerGate,type ProviderConfig } from "@/server/ai/openrouter";

type Context=Awaited<ReturnType<typeof requireWorkspace>>;
function failure(error:{code?:string;message?:string}|null){if(error?.message==="ASSISTANT_REQUEST_CONFLICT")throw new AppError(409,"ASSISTANT_REQUEST_CONFLICT","This retry belongs to different inputs. Start a new question.");if(error?.message==="ASSISTANT_REQUEST_NOT_FOUND")throw new AppError(404,"ASSISTANT_REQUEST_NOT_FOUND","This request is not available.");databaseFailure(error);}
async function product(context:Context,input:AssistantInput,intent:Intent):Promise<{id:string}|EvidencePacket>{
  if(input.context.productId)return {id:input.context.productId};
  const q=productSearch(input.message),data=await readInventory(context,inventoryQuerySchema.parse({q,limit:5,sort:"risk"}));
  if(!q&&intent==="stock")return inventoryEvidence(data,context.workspace.is_sample);
  if(data.matchCount===1)return {id:data.items[0].id};
  const packet=guidance(intent,context.workspace.is_sample,data.matchCount?"Choose which saved product you mean; no product was selected automatically.":"No saved product matches that lookup. Check the SKU or choose an inventory record.");
  packet.answer.choices=data.items.map(item=>({label:`${item.name} · ${item.sku}`,message:intent==="forecast"?"Explain this forecast estimate":"Why is this product at risk?",context:{screen:"product",productId:item.id}}));return packet;
}
export async function retrieveEvidence(context:Context,input:AssistantInput):Promise<EvidencePacket>{
  const intent=resolveIntent(input.message,input.context),c=input.context,sample=context.workspace.is_sample;
  // IDs are always resolved under membership/RLS, even when the question is a refusal.
  let plan:Awaited<ReturnType<typeof readPlanContext>>|undefined;
  if(c.planId){plan=await readPlanContext(context,c.planId);if(c.productId&&!plan.items.some(l=>l.productId===c.productId))throw new AppError(404,"PRODUCT_NOT_FOUND","This product is not part of the selected saved plan.");}
  if(c.orderId){const order=await readOrder(context,c.orderId);if(intent==="order")return orderEvidence(order);}
  if(c.runId){const run=await readForecast(context,c.runId,forecastQuerySchema.parse({productId:c.productId,limit:1}));if(intent==="forecast")return forecastEvidence(run,sample);}
  if(c.productId&&!plan&&!c.runId){const row=await readProduct(context,c.productId);if(intent==="stock"||intent==="lookup")return stockEvidence(row.item,row.asOf);}
  if(intent==="refusal"||intent==="help")return guidance(intent,sample);
  if(intent==="quantity"){
    if(!plan)return guidance(intent,sample,"Open a specific saved purchasing plan to explain its quantities and budget. Unsaved edits are not used as evidence.");
    if(!c.productId&&plan.items.length>1&&!/budget|allocation|priority/i.test(input.message)){
      const packet=guidance(intent,sample,"Choose the saved product line whose quantity you want explained.");packet.answer.nextStep={label:"Review saved plan",href:`/app/replenishment?planId=${plan.plan.id}`};packet.answer.choices=plan.items.filter(l=>l.approvedQty>0).slice(0,5).map(l=>({label:`${l.name} · ${l.sku}`,message:"Explain this purchasing quantity",context:{screen:"planner",planId:plan!.plan.id,productId:l.productId}}));return packet;
    }
    return quantityEvidence(plan.plan,plan.items,c.productId,sample);
  }
  if(intent==="scenario")return plan&&c.scenario?scenarioEvidence(scenarioFromContext(plan,sample,{planId:plan.plan.id,...c.scenario},planningQuerySchema.parse({limit:100}))):guidance(intent,sample,"Run or select the supplier-delay result, then choose Explain change. The explanation needs its saved plan, supplier and actual extra-delay value.");
  if(intent==="order")return guidance(intent,sample,"Open a saved purchase-order draft to inspect its immutable reviewed evidence. No draft is created by this explanation.");
  if(intent==="forecast"){
    let runId=c.runId,productId=c.productId;
    if(!productId&&productSearch(input.message)){
      const target=await product(context,input,intent);if("answer" in target)return target;productId=target.id;
    }
    if(!productId&&c.screen!=="forecasts")return guidance(intent,sample,"Choose a product or open a saved forecast before explaining its demand evidence.");
    if(!runId&&productId)runId=(await readProduct(context,productId)).item.demand.runId??undefined;
    if(!runId)runId=(await listForecasts(context,25)).items.find(r=>r.status==="succeeded")?.id;
    return runId?forecastEvidence(await readForecast(context,runId,forecastQuerySchema.parse({productId,limit:1})),sample):guidance(intent,sample,"No completed forecast evidence is saved. Generate a baseline in Forecasts; missing history will remain insufficient data.");
  }
  const resolved=await product(context,input,intent);if("answer" in resolved)return resolved;
  const row=await readProduct(context,resolved.id);return stockEvidence(row.item,row.asOf);
}
export async function explain(context:Context,input:AssistantInput,signal?:AbortSignal,providerConfig?:ProviderConfig){
  const digest=createHash("sha256").update(JSON.stringify({message:input.message,context:input.context,history:input.history})).digest("hex");
  const reserved=await context.client.rpc("reserve_assistant_request",{p_org_id:context.workspace.id,p_request_id:input.requestId,p_context_hash:digest});failure(reserved.error);
  const reservation=z.object({allowed:z.boolean(),reused:z.boolean(),retryAt:z.string().nullable()}).parse(reserved.data);
  if(!reservation.allowed)throw new AppError(429,"ASSISTANT_LIMIT",`Insight is limited to 10 questions per user/hour and 40 per workspace/day. Try after ${reservation.retryAt??"the quota resets"}.`);
  const packet=await retrieveEvidence(context,input);if(!verifySources(packet.answer))throw new AppError(503,"EVIDENCE_UNAVAILABLE","Saved evidence could not be verified.");
  const env=providerConfig?null:getServerEnvironment(),config=providerConfig??{...env!.openRouter,enabled:env!.externalAiEnabled};
  let answer=packet.answer;const gate=providerGate(config,context.workspace.is_sample);
  let metrics:{latency:number;tokensIn?:number;tokensOut?:number}={latency:0};
  if(gate==="verified"&&answer.kind==="deterministic_explanation"&&answer.evidence.length&&!answer.stale&&!signal?.aborted&&!reservation.reused){
    const claimed=await context.client.rpc("reserve_assistant_provider",{p_org_id:context.workspace.id,p_request_id:input.requestId,p_slots:config.models.length});failure(claimed.error);
    if(claimed.data===true){const result=await modelExplanation(packet,config,signal);answer=result.answer;metrics=result;}else answer={...answer,provider:{used:false,model:null,reason:"quota"}};
  }else answer={...answer,provider:{used:false,model:null,reason:signal?.aborted?"cancelled":gate==="verified"?"no_evidence":gate}};
  const completed=await context.client.rpc("complete_assistant_request",{p_org_id:context.workspace.id,p_request_id:input.requestId,p_kind:answer.kind,p_model:answer.provider.model??undefined,p_latency:metrics.latency,p_tokens_in:metrics.tokensIn,p_tokens_out:metrics.tokensOut});failure(completed.error);
  if(process.env.NODE_ENV==="production")console.info("Insight outcome",{requestId:input.requestId,kind:answer.kind,model:answer.provider.model,reason:answer.provider.reason,latencyMs:metrics.latency,tokensIn:metrics.tokensIn,tokensOut:metrics.tokensOut});
  return answerSchema.parse(answer);
}

