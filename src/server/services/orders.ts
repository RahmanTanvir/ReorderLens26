import "server-only";
import { z } from "@/lib/validation/zod";
import { AppError } from "@/lib/auth/errors";
import { conversionSchema,orderListSchema,orderQuerySchema,orderReadSchema,type OrderQuery } from "@/lib/orders/contracts";
import { requireWorkspace } from "@/server/auth/context";
import { databaseFailure } from "@/server/http";

type Context=Awaited<ReturnType<typeof requireWorkspace>>;
const messages:Record<string,[number,string]>={
  PLAN_NOT_FOUND:[404,"This plan is not available in this workspace."],STALE_REVISION:[409,"This plan changed after review. Reload and review the saved quantities before saving drafts."],
  STALE_INPUTS:[409,"A later import changed these inputs. Generate a fresh forecast and plan before saving drafts."],
  PLAN_READ_ONLY:[409,"Only a current saved draft plan can be converted."],EMPTY_PLAN:[422,"Select positive quantities in the planner before review."],
  OVER_BUDGET:[422,"Save a plan within its budget before creating drafts."],INVALID_ORDER_LINES:[422,"The saved lines cannot be converted. Review demand, cost, supplier and pack multiples in the planner."],
  ORDER_SNAPSHOT_UNAVAILABLE:[409,"This older converted plan has no supported document snapshot. Contact your administrator."],
};
function failure(error:{code?:string;message?:string}|null){if(!error)return;const known=messages[error.message??""];if(known)throw new AppError(known[0],error.message!,known[1]);if(error.code?.startsWith("22"))throw new AppError(400,"INVALID_ORDER_INPUT","Check the selected dates, page and plan revision.");databaseFailure(error);}
function id(value:string){if(!z.uuid().safeParse(value).success)throw new AppError(404,"NOT_FOUND","This saved document is not available in this workspace.");return value;}
export function orderQuery(params:URLSearchParams|Record<string,string|string[]|undefined>):OrderQuery {
  const input:Record<string,unknown>={},seen=new Set<string>();
  const fields=new Set(["supplierId","from","to","planId","limit","cursor"]);
  const entries=params instanceof URLSearchParams?[...params]:Object.entries(params);
  for(const [key,value] of entries){if(!fields.has(key)||seen.has(key))throw new AppError(400,"INVALID_QUERY","Use supported filters once each.");seen.add(key);if(value!==undefined&&value!=="")input[key]=value;}
  const parsed=orderQuerySchema.safeParse(input);if(!parsed.success)throw new AppError(400,"INVALID_QUERY","Check the supplier, date range, plan and page filters.");return parsed.data;
}
export async function convertPlan(context:Context,planId:string,expectedRevision:number){
  if(!["owner","operator"].includes(context.workspace.role))throw new AppError(403,"FORBIDDEN","Only owners and operators can save draft orders.");
  const result=await context.client.rpc("convert_plan_to_drafts",{p_org_id:context.workspace.id,p_plan_id:id(planId),p_expected_revision:expectedRevision});failure(result.error);return conversionSchema.parse(result.data);
}
export async function readOrder(context:Context,orderId:string){const result=await context.client.rpc("read_purchase_order",{p_org_id:context.workspace.id,p_order_id:id(orderId)});failure(result.error);if(result.data===null)throw new AppError(404,"ORDER_NOT_FOUND","This draft is not available in this workspace.");return orderReadSchema.parse(result.data);}
export async function listOrders(context:Context,query:OrderQuery){const result=await context.client.rpc("list_purchase_orders",{p_org_id:context.workspace.id,p_supplier_id:query.supplierId,p_from:query.from,p_to:query.to,p_plan_id:query.planId,p_limit:query.limit,p_before:query.cursor});failure(result.error);return orderListSchema.parse(result.data);}
