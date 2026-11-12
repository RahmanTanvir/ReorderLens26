import type { AssistantContext,Intent } from "@/lib/assistant/contracts";
export function resolveIntent(message:string,context:AssistantContext):Intent{
  const q=message.toLowerCase();
  if(/ignore.{0,30}(instructions|previous|system)|system prompt|api.?key|password|secret|jailbreak|\b(select|drop|truncate|insert|update|delete)\s+.*\b(from|table|into|set)\b|\b(sql|javascript|weather|football|poem|joke|legal|tax|investment|politics)\b/.test(q))return "refusal";
  if(/\b(place|send|dispatch|pay|cancel|delete|approve|create|convert)\b.{0,35}\b(order|draft|payment|product|plan|supplier|record)\b|\b(change|edit|update)\b.{0,25}\b(budget|quantity|quantities|stock|price)\b|\b(run|generate)\b.{0,20}\b(forecast|plan)\b/.test(q))return "refusal";
  if(/\b(delay|scenario|late|delayed)\b/.test(q))return "scenario";
  if(/\b(draft|orders?|purchase.order|sent|receipt|payment)\b/.test(q)&&context.screen==="orders")return "order";
  if(/\b(quantity|quantities|replenish|recommend\w*|budget|allocation|pack|suggest\w*|purchasing)\b/.test(q))return "quantity";
  if(/\b(forecast|estimate|history|eligible|accuracy|demand|stockout days)\b/.test(q))return "forecast";
  if(/\b(find|lookup|look up)\b/.test(q))return "lookup";
  if(/\b(stock|inventory|cover|risk|attention|run out|on.hand|product|sku)\b/.test(q))return "stock";
  if(/^(explain( this)?|why|why this|what about this)[? .!]*$/.test(q))return context.screen==="planner"?"quantity":context.screen==="scenario"?"scenario":context.screen==="forecasts"?"forecast":context.screen==="orders"?"order":"stock";
  if(/what can|help|how do i|what does/.test(q))return "help";
  return "refusal";
}
export function productSearch(message:string){
  const sku=message.match(/\b[A-Za-z][A-Za-z0-9]*-[A-Za-z0-9-]{1,60}\b/);if(sku)return sku[0];
  const stop=new Set("why is are was were this that the a an my our at risk stock inventory cover day days units on hand before arrival today find lookup look up explain me for of does do what which product products need attention demand forecast estimate history insufficient please how much have has will run out saved available and can you tell about accuracy mean means stockout recent weekday estimated many".split(" "));
  return message.toLowerCase().replace(/[^\p{L}\p{N}.\- ]/gu," ").split(/\s+/).filter(word=>word&&!stop.has(word)).join(" ").slice(0,100);
}
