import { z } from "@/lib/validation/zod";

export const assistantContextSchema=z.object({
  screen:z.enum(["overview","inventory","product","forecasts","planner","scenario","orders","workspace"]),
  productId:z.uuid().optional(),planId:z.uuid().optional(),runId:z.uuid().optional(),orderId:z.uuid().optional(),
  scenario:z.object({supplierId:z.uuid(),extraDelayDays:z.number().int().min(0).max(30)}).strict().optional(),
}).strict().superRefine((v,c)=>{
  if(v.scenario&&(v.screen!=="scenario"||!v.planId))c.addIssue({code:"custom",message:"A scenario needs its selected saved plan.",path:["scenario"]});
  if(v.orderId&&v.screen!=="orders")c.addIssue({code:"custom",message:"Select the order screen.",path:["orderId"]});
  if(v.planId&&!["planner","scenario","orders"].includes(v.screen))c.addIssue({code:"custom",message:"Select the saved plan screen.",path:["planId"]});
  if(v.runId&&v.screen!=="forecasts")c.addIssue({code:"custom",message:"Select the forecast screen.",path:["runId"]});
});
export type AssistantContext=z.infer<typeof assistantContextSchema>;
export const assistantInputSchema=z.object({requestId:z.uuid(),message:z.string().trim().min(1).max(500),context:assistantContextSchema,
  history:z.array(z.object({role:z.enum(["user","assistant"]),content:z.string().max(1000)}).strict()).max(4).default([]),
}).strict();
export type AssistantInput=z.infer<typeof assistantInputSchema>;
export const intents=["stock","lookup","forecast","quantity","scenario","order","help","refusal"] as const;
export type Intent=typeof intents[number];
export const assistantHref=z.string().max(1000).refine(value=>{
  if(/[\\\u0000-\u0020]/.test(value)||!value.startsWith("/app/"))return false;
  const url=new URL(value,"https://reorderlens.invalid");return url.origin==="https://reorderlens.invalid"&&/^\/app\/(overview|inventory(?:\/[a-f0-9-]{36})?|forecasts|replenishment|scenarios|purchase-orders(?:\/[a-f0-9-]{36})?|data|settings)$/.test(url.pathname);
});
export const factSchema=z.object({id:z.string().regex(/^[a-z][a-z0-9_]{0,50}$/),label:z.string().max(160),value:z.string().max(160),sourceId:z.string()});
export type Fact=z.infer<typeof factSchema>;
export const sourceSchema=z.object({id:z.string(),label:z.string().max(120),asOf:z.string().max(80),href:assistantHref});
export type Source=z.infer<typeof sourceSchema>;
export const answerSchema=z.object({
  kind:z.enum(["grounded_explanation","deterministic_explanation","insufficient_data","clarification","refusal"]),
  intent:z.enum(intents),finding:z.string().max(1000),subject:z.string().max(500),
  evidence:z.array(factSchema).max(20),sources:z.array(sourceSchema).max(6),limitations:z.array(z.string().max(500)).max(10),
  nextStep:z.object({label:z.string().max(120),href:assistantHref}),
  choices:z.array(z.object({label:z.string().max(300),message:z.string().max(500),context:assistantContextSchema})).max(5),
  isSample:z.boolean(),stale:z.boolean(),provider:z.object({used:z.boolean(),model:z.string().max(150).nullable(),reason:z.enum(["disabled","privacy_gate","not_configured","not_evaluated","no_evidence","quota","unavailable","invalid_output","cancelled","verified"])}),
});
export type AssistantAnswer=z.infer<typeof answerSchema>;
// The model may select approved wording and evidence; it cannot invent prose,
// numbers, actions or links. The server always renders the authoritative facts.
export const modelSelectionSchema=z.object({finding:z.string().max(1000),evidence:z.array(z.string()).min(1).max(20),nextStep:z.literal("source"),limitations:z.array(z.string()).max(10)}).strict();
export type ModelSelection=z.infer<typeof modelSelectionSchema>;
export type EvidencePacket={answer:AssistantAnswer;findings:string[]};

export function routeContext(path:string,search=""):AssistantContext{
  const q=new URLSearchParams(search),uuid=(name:string)=>z.uuid().safeParse(q.get(name)).success?q.get(name)!:undefined;
  const product=path.match(/^\/app\/inventory\/([a-f0-9-]+)$/),order=path.match(/^\/app\/purchase-orders\/([a-f0-9-]+)$/);
  if(product&&z.uuid().safeParse(product[1]).success)return {screen:"product",productId:product[1]};
  if(order&&z.uuid().safeParse(order[1]).success)return {screen:"orders",orderId:order[1]};
  if(path==="/app/forecasts")return {screen:"forecasts",runId:uuid("runId"),productId:uuid("productId")};
  if(path==="/app/replenishment")return {screen:"planner",planId:uuid("planId")};
  if(path==="/app/scenarios")return {screen:"scenario",planId:uuid("planId")};
  if(path.startsWith("/app/purchase-orders"))return {screen:path.endsWith("/review")?"planner":"orders",planId:uuid("planId")};
  return {screen:path==="/app/overview"?"overview":path==="/app/inventory"?"inventory":"workspace"};
}
export const suggestions:Record<AssistantContext["screen"],string[]>={overview:["Which products need attention?","What does stockout risk mean?"],inventory:["Which products are at risk?","Find Oil"],product:["Why is this product at risk?","Explain this demand estimate"],forecasts:["Explain this forecast estimate","Why is history insufficient?"],planner:["Explain this purchasing quantity","How does this budget affect the plan?"],scenario:["Explain this supplier delay","Does this scenario change my saved plan?"],orders:["Explain this purchase-order draft","Are these orders sent?"],workspace:["What can ReorderLens Insight explain?","How do I review stock risk?"]};
