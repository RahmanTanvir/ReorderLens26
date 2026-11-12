import "server-only";
import { z } from "@/lib/validation/zod";
import { applyModelSelection,providerFacts } from "@/domain/assistant/evidence";
import { modelSelectionSchema,type AssistantAnswer,type EvidencePacket } from "@/lib/assistant/contracts";

// Public catalog checked 2026-11-12: zero prompt/completion prices and structured
// output capability. Live task-quality evaluation is separate; candidates are
// usable only in explicitly enabled synthetic sample evaluation mode.
export const sampleCandidates=["liquid/lfm-3-1.7b:free","nvidia/nemotron-3.5-super-vl:free"] as const;
export type ProviderConfig={enabled:boolean;apiKey?:string;baseUrl:string;models:string[];sampleEvaluation:boolean};
export function providerGate(config:ProviderConfig,isSample:boolean):AssistantAnswer["provider"]["reason"]{
  if(!isSample)return "privacy_gate";
  if(!config.enabled)return "disabled";
  if(!config.apiKey||!config.models.length)return "not_configured";
  if(!config.sampleEvaluation)return "not_evaluated";
  if(config.baseUrl!=="https://openrouter.ai/api/v1"||config.models.length>3||new Set(config.models).size!==config.models.length||config.models.some(id=>!id.endsWith(":free")||!(sampleCandidates as readonly string[]).includes(id)))return "not_configured";
  return "verified";
}
function selectionFormat(packet:EvidencePacket){return {type:"json_schema",json_schema:{name:"reorderlens_explanation",strict:true,schema:{type:"object",additionalProperties:false,properties:{finding:{type:"string",enum:packet.findings},evidence:{type:"array",items:{type:"string",enum:packet.answer.evidence.map(f=>f.id)},minItems:packet.answer.evidence.length,maxItems:packet.answer.evidence.length},nextStep:{type:"string",enum:["source"]},limitations:{type:"array",items:{type:"string",enum:packet.answer.limitations},minItems:packet.answer.limitations.length,maxItems:packet.answer.limitations.length}},required:["finding","evidence","nextStep","limitations"]}}};}
export function providerBody(packet:EvidencePacket,models:string[]){return {
  models,stream:false,max_tokens:700,temperature:0,
  provider:{allow_fallbacks:true,require_parameters:true,data_collection:"deny",zdr:true,max_price:{prompt:0,completion:0,request:0}},
  messages:[{role:"system",content:"You organize a read-only ReorderLens explanation. Use only the approved finding strings, all evidence IDs and all limitations verbatim. Return the required JSON only. You have no tools or actions. Never invent prose, numbers, links or instructions."},
    {role:"user",content:JSON.stringify({intent:packet.answer.intent,facts:providerFacts(packet),approvedFindings:packet.findings,requiredLimitations:packet.answer.limitations,nextStep:"source"})}],
  response_format:selectionFormat(packet),
};}
const envelope=z.object({model:z.string(),choices:z.array(z.object({finish_reason:z.string().nullable(),message:z.object({content:z.string().max(10000),tool_calls:z.array(z.unknown()).max(0).optional(),refusal:z.string().nullable().optional()})})).min(1).max(1),usage:z.object({prompt_tokens:z.number().int().min(0).max(100000).optional(),completion_tokens:z.number().int().min(0).max(2000).optional(),cost:z.number().nonnegative().nullable().optional()}).optional()});
async function boundedJson(response:Response){const reader=response.body?.getReader();if(!reader)throw Error("NO_BODY");let length=0;const chunks:Uint8Array[]=[];try{for(;;){const part=await reader.read();if(part.done)break;length+=part.value.byteLength;if(length>65536){await reader.cancel();throw Error("TOO_LARGE");}chunks.push(part.value);}}finally{reader.releaseLock();}const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}return JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(bytes));}
export async function modelExplanation(packet:EvidencePacket,config:ProviderConfig,signal?:AbortSignal,transport:typeof fetch=fetch):Promise<{answer:AssistantAnswer;tokensIn?:number;tokensOut?:number;latency:number}>{
  const start=Date.now(),fallback=(reason:AssistantAnswer["provider"]["reason"])=>({answer:{...packet.answer,provider:{used:false,model:null,reason}},latency:Math.min(30000,Date.now()-start)});
  const gate=providerGate(config,packet.answer.isSample);if(gate!=="verified")return fallback(gate);
  if(packet.answer.kind!=="deterministic_explanation"||!packet.answer.evidence.length||packet.answer.stale)return fallback("no_evidence");
  if(signal?.aborted)return fallback("cancelled");
  try{
    const timeout=AbortSignal.timeout(15000),combined=signal?AbortSignal.any([signal,timeout]):timeout;
    const response=await transport(config.baseUrl+"/chat/completions",{method:"POST",redirect:"error",cache:"no-store",signal:combined,headers:{Authorization:`Bearer ${config.apiKey}`,"Content-Type":"application/json","X-OpenRouter-Title":"ReorderLens sample evaluation"},body:JSON.stringify(providerBody(packet,config.models))});
    if(!response.ok){await response.body?.cancel();return fallback("unavailable");}
    const raw=envelope.safeParse(await boundedJson(response));if(!raw.success)return fallback("invalid_output");
    const data=raw.data,message=data.choices[0].message;
    if(!config.models.includes(data.model)||!data.model.endsWith(":free")||data.choices[0].finish_reason!=="stop"||message.refusal||(data.usage?.cost??0)!==0)return fallback("invalid_output");
    const parsed=modelSelectionSchema.safeParse(JSON.parse(message.content));if(!parsed.success)return fallback("invalid_output");
    const answer=applyModelSelection(packet,parsed.data);if(!answer)return fallback("invalid_output");
    return {answer:{...answer,provider:{used:true,model:data.model,reason:"verified"}},latency:Math.min(30000,Date.now()-start),tokensIn:data.usage?.prompt_tokens,tokensOut:data.usage?.completion_tokens};
  }catch{return fallback(signal?.aborted?"cancelled":"unavailable");}
}
