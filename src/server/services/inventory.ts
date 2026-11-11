import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import type { NextRequest } from "next/server";
import { inventoryItem } from "@/domain/inventory/risk";
import { AppError } from "@/lib/auth/errors";
import { budgetSchema,inventoryQuerySchema,positionSchema,rawDetailSchema,rawListSchema,type InventoryList,type InventoryOverview,type InventoryQuery,type ProductDetail } from "@/lib/inventory/contracts";
import { requireWorkspace } from "@/server/auth/context";
import { databaseFailure } from "@/server/http";

type Context=Awaited<ReturnType<typeof requireWorkspace>>;
const cursorSchema=z.object({version:z.literal(1),org:z.uuid(),filter:z.string().length(64),revision:z.string().length(32),position:positionSchema}).strict();
function filterKey(query:InventoryQuery) {return createHash("sha256").update(JSON.stringify([query.q,query.status??null,query.supplierId??null,query.sort,query.limit])).digest("hex");}
export function inventoryQuery(params:URLSearchParams|Record<string,string|string[]|undefined>) {
  const input:Record<string,unknown>={};
  if(params instanceof URLSearchParams)for(const [key,value] of params){if(key in input)throw new AppError(400,"INVALID_QUERY","Use each inventory filter once.");input[key]=value;}
  else for(const [key,value] of Object.entries(params))if(value!==undefined)input[key]=value;
  const parsed=inventoryQuerySchema.safeParse(input);
  if(!parsed.success)throw new AppError(400,"INVALID_QUERY","Check the inventory filters, sort order and page size.");
  return parsed.data;
}
export async function inventoryContext(request:NextRequest) {return requireWorkspace({workspaceId:request.headers.get("X-Workspace-Id")});}
function readFailure(error:{code?:string;message?:string}|null) {
  if(error?.message==="STALE_CURSOR")throw new AppError(409,"STALE_CURSOR","Inventory changed while you were browsing. Start again from the first page.");
  if(error?.code?.startsWith("22"))throw new AppError(400,"INVALID_QUERY","Check the inventory query and restart from the first page.");
  databaseFailure(error);
}
export async function readInventory(context:Context,query:InventoryQuery):Promise<InventoryList> {
  let cursor:z.infer<typeof cursorSchema>|undefined;
  if(query.cursor)try {
    if(!/^[A-Za-z0-9_-]+$/.test(query.cursor))throw new Error("Invalid encoding");
    cursor=cursorSchema.parse(JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(Buffer.from(query.cursor,"base64url"))));
    if(cursor.org!==context.workspace.id||cursor.filter!==filterKey(query))throw new Error("Different query");
  }catch{throw new AppError(400,"INVALID_CURSOR","This page cursor does not match the current workspace and filters. Start from the first page.");}
  const result=await context.client.rpc("read_inventory",{p_org_id:context.workspace.id,p_q:query.q,p_status:query.status,p_supplier_id:query.supplierId,p_sort:query.sort,p_limit:query.limit,p_after:cursor?.position,p_revision:cursor?.revision});readFailure(result.error);
  const raw=rawListSchema.parse(result.data);
  if(raw.items.some(row=>row.org_id!==context.workspace.id||row.is_sample!==context.workspace.is_sample))throw new AppError(503,"INVENTORY_UNAVAILABLE","Inventory could not be verified. Please try again.");
  return {items:raw.items.map(inventoryItem),summary:raw.summary,matchCount:raw.matchCount,suppliers:raw.suppliers,asOf:raw.asOf,
    nextCursor:raw.nextPosition?Buffer.from(JSON.stringify({version:1,org:context.workspace.id,filter:filterKey(query),revision:raw.revision,position:raw.nextPosition})).toString("base64url"):null};
}
export async function readProduct(context:Context,id:string):Promise<ProductDetail> {
  if(!z.uuid().safeParse(id).success)throw new AppError(404,"PRODUCT_NOT_FOUND","This product is not available in this workspace.");
  const result=await context.client.rpc("read_product",{p_org_id:context.workspace.id,p_product_id:id});readFailure(result.error);
  if(result.data===null)throw new AppError(404,"PRODUCT_NOT_FOUND","This product is not available in this workspace.");
  const raw=rawDetailSchema.parse(result.data);
  if(raw.item.org_id!==context.workspace.id||raw.item.is_sample!==context.workspace.is_sample)throw new AppError(503,"INVENTORY_UNAVAILABLE","Product data could not be verified. Please try again.");
  return {...raw,item:inventoryItem(raw.item)};
}
export async function readOverview(context:Context):Promise<InventoryOverview> {
  const [inventory,result]=await Promise.all([readInventory(context,inventoryQuerySchema.parse({sort:"risk",limit:8})),context.client.rpc("read_inventory_budget",{p_org_id:context.workspace.id})]);readFailure(result.error);
  return {inventory,budget:result.data===null?null:budgetSchema.parse(result.data)};
}
