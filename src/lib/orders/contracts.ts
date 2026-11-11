import { z } from "zod";
import { moneySchema,revisionSchema } from "@/lib/planning/contracts";

const amount=z.string().regex(/^\d+(\.\d{1,2})?$/);
export const convertPlanSchema=z.object({expectedRevision:revisionSchema}).strict();
export const conversionSchema=z.object({purchaseOrderIds:z.array(z.uuid()).min(1).max(500),alreadyConverted:z.boolean()});
export const orderQuerySchema=z.object({supplierId:z.uuid().optional(),from:z.iso.date().optional(),to:z.iso.date().optional(),planId:z.uuid().optional(),limit:z.coerce.number().int().min(1).max(100).default(25),cursor:z.uuid().optional()}).strict().refine(q=>!q.from||!q.to||q.from<=q.to,{message:"The start date must precede the end date."});
export type OrderQuery=z.infer<typeof orderQuerySchema>;
export const orderHeaderSchema=z.object({id:z.uuid(),planId:z.uuid(),supplierId:z.uuid(),orderNumber:z.string(),status:z.literal("draft"),total:moneySchema,createdAt:z.string(),lineCount:z.number().int().min(1).max(500),units:z.string().regex(/^\d+$/),document:z.object({version:z.literal(1),workspaceName:z.string(),workspaceLocation:z.string(),currency:z.literal("BDT"),timezone:z.literal("Asia/Dhaka"),isSample:z.boolean(),supplierName:z.string(),planRevision:revisionSchema,inputSnapshotAt:z.string(),sourceDate:z.iso.date(),method:z.enum(["reorder_v1","sample_fixture"])})});
export type OrderHeader=z.infer<typeof orderHeaderSchema>;
export const orderLineSchema=z.object({id:z.uuid(),productId:z.uuid(),sku:z.string(),name:z.string(),quantity:z.number().int().min(1).max(2147483647),unitCost:moneySchema,lineTotal:moneySchema,leadDays:z.number().int().min(0).max(365),packMultiple:z.number().int().min(1).max(10000)});
export const orderReadSchema=z.object({order:orderHeaderSchema,items:z.array(orderLineSchema).min(1).max(500)});
export type OrderRead=z.infer<typeof orderReadSchema>;
export const orderListSchema=z.object({items:z.array(orderHeaderSchema).max(100),nextCursor:z.uuid().nullable(),summary:z.object({count:z.number().int(),total:amount,suppliers:z.number().int()}),suppliers:z.array(z.object({id:z.uuid(),name:z.string()}))});
export type OrderList=z.infer<typeof orderListSchema>;

export function ordersHref(query:Partial<OrderQuery>={}) {const params=new URLSearchParams();for(const [key,value] of Object.entries(query))if(value!==undefined&&value!=="")params.set(key,String(value));return `/app/purchase-orders${params.size?`?${params}`:""}`;}
export function orderDate(value:string){return new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Dhaka",dateStyle:"medium"}).format(new Date(value));}
