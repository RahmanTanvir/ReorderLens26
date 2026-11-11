import "server-only";
import { z } from "zod";
import { AppError } from "@/lib/auth/errors";
import { compareDelay } from "@/domain/scenario/compare";
import { createdPlanSchema,planContextSchema,planListSchema,planningQuerySchema,scenarioResultSchema,type CreatePlan,type PlanningQuery } from "@/lib/planning/contracts";
import { requireWorkspace } from "@/server/auth/context";
import { databaseFailure } from "@/server/http";

type Context=Awaited<ReturnType<typeof requireWorkspace>>;
export function planningQuery(params:URLSearchParams|Record<string,string|string[]|undefined>):PlanningQuery {
  const input:Record<string,unknown>={};if(params instanceof URLSearchParams)for(const [key,value] of params){if(key in input)throw new AppError(400,"INVALID_QUERY","Use each planner query field once.");input[key]=value;}
  else for(const [key,value] of Object.entries(params))if(value!==undefined)input[key]=value;
  const parsed=planningQuerySchema.safeParse(input);if(!parsed.success)throw new AppError(400,"INVALID_QUERY","Check the selected plan, forecast and page.");return parsed.data;
}
const messages:Record<string,[number,string]>={
  PLAN_NOT_FOUND:[404,"This plan is not available in this workspace."],PLAN_LINE_NOT_FOUND:[404,"This plan line is not available in this workspace."],
  FORECAST_NOT_FOUND:[404,"Choose a completed forecast from this workspace."],STALE_REVISION:[409,"Another edit changed this plan. Reload the saved plan before editing again; your changes were not applied."],
  STALE_INPUTS:[409,"A later import changed these inputs. Generate a fresh forecast and plan; this version remains available for review."],
  PLAN_READ_ONLY:[409,"Only a current draft plan can be edited."],IDEMPOTENCY_CONFLICT:[409,"This creation request belongs to different inputs. Start a new plan request."],
  NO_ELIGIBLE_PRODUCTS:[422,"No products have the sufficient demand, stock, positive cost and reorder risk required for a recommendation. Review Inventory and Forecasts."],
  PLAN_SIZE_LIMIT:[422,"The initial planner supports up to 500 active products. This workspace exceeds that tested planning size."],
  PLAN_LIMIT:[429,"This workspace has reached 20 new plans in an hour. Open a saved plan or try later."],
  SAMPLE_PLAN_DEFAULTS:[400,"Load the documented sample with BDT 50,000, seven review days and two safety days. Its saved budget and approvals can then be edited."],
  INVALID_PACK_OR_ELIGIBILITY:[400,"Use whole pack multiples on eligible products. Ineligible products must remain at zero."],
  QUANTITY_LIMIT:[422,"The calculated quantity exceeds the supported whole-unit range. Review demand, stock and lead-time inputs."],
};
function failure(error:{code?:string;message?:string}|null) {
  if(!error)return;const known=messages[error.message??""];if(known)throw new AppError(known[0],error.message!,known[1]);
  if(error.code?.startsWith("22"))throw new AppError(400,"INVALID_PLAN_INPUT","Check the budget, whole-unit quantities, pack multiples and plan assumptions.");
  databaseFailure(error);
}
function editor(context:Context){if(!["owner","operator"].includes(context.workspace.role))throw new AppError(403,"FORBIDDEN","Only owners and operators can save purchasing plans.");}
export async function createPlan(context:Context,input:CreatePlan) {
  editor(context);const result=await context.client.rpc("create_replenishment_plan",{p_org_id:context.workspace.id,p_plan_id:input.planId,p_forecast_run_id:input.forecastRunId,p_budget:input.budget,p_review:input.reviewPeriodDays,p_safety:input.safetyDays});failure(result.error);return createdPlanSchema.parse(result.data);
}
export async function listPlans(context:Context,limit=25,before?:string) {
  const result=await context.client.rpc("list_replenishment_plans",{p_org_id:context.workspace.id,p_limit:limit,p_before:before});failure(result.error);return planListSchema.parse(result.data);
}
export async function readPlanContext(context:Context,id:string) {
  if(!z.uuid().safeParse(id).success)throw new AppError(404,"PLAN_NOT_FOUND",messages.PLAN_NOT_FOUND[1]);
  const result=await context.client.rpc("read_plan_context",{p_org_id:context.workspace.id,p_plan_id:id});failure(result.error);if(result.data===null)throw new AppError(404,"PLAN_NOT_FOUND",messages.PLAN_NOT_FOUND[1]);return planContextSchema.parse(result.data);
}
function page<T extends {id:string}>(items:T[],query:PlanningQuery) {
  const index=query.cursor?items.findIndex(row=>row.id===query.cursor):-1;if(query.cursor&&index<0)throw new AppError(400,"INVALID_CURSOR","This page is not part of the selected plan. Open its first page.");
  const rows=items.slice(index+1,index+1+query.limit);return {items:rows,nextCursor:index+1+query.limit<items.length?rows.at(-1)!.id:null};
}
export async function readPlan(context:Context,id:string,query:PlanningQuery) {const data=await readPlanContext(context,id);return {plan:data.plan,...page(data.items,query)};}
export async function editPlan(context:Context,id:string,input:{expectedRevision:number;budget?:string;quantities?:{lineId:string;approvedQty:number}[];resetQuantities?:true},query:PlanningQuery) {
  editor(context);if(!z.uuid().safeParse(id).success)throw new AppError(404,"PLAN_NOT_FOUND",messages.PLAN_NOT_FOUND[1]);
  const result=await context.client.rpc("edit_replenishment_plan",{p_org_id:context.workspace.id,p_plan_id:id,p_expected_revision:input.expectedRevision,p_budget:input.budget,p_quantities:input.quantities,p_reset:input.resetQuantities??false});failure(result.error);return readPlan(context,id,query);
}
export async function compareScenario(context:Context,input:{planId:string;supplierId:string;extraDelayDays:number},query:PlanningQuery) {
  const data=await readPlanContext(context,input.planId);return scenarioFromContext(data,context.workspace.is_sample,input,query);
}
export function scenarioFromContext(data:z.infer<typeof planContextSchema>,isSample:boolean,input:{planId:string;supplierId:string;extraDelayDays:number},query:PlanningQuery) {
  const supplier=data.items.find(row=>row.supplierId===input.supplierId);
  if(!supplier)throw new AppError(404,"SUPPLIER_NOT_FOUND","This supplier has no saved products in the selected plan.");
  const result=compareDelay(data.items,input.supplierId,input.extraDelayDays,data.plan.reviewPeriodDays),affected=result.items.filter(row=>row.affected);
  const sliced=page(affected.map(row=>({...row,id:row.productId})),query);
  return scenarioResultSchema.parse({planId:input.planId,revision:data.plan.revision,supplierId:input.supplierId,supplierName:supplier.supplierName,extraDelayDays:input.extraDelayDays,stale:data.plan.stale,snapshotDate:data.plan.snapshotDate,isSample,items:sliced.items,nextCursor:sliced.nextCursor,summary:{...result.summary,unaffectedCount:data.items.length-affected.length}});
}
