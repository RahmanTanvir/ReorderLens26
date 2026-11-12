import { PGlite } from "@electric-sql/pglite";
import { readFile,readdir } from "node:fs/promises";
import { createHash,randomUUID } from "node:crypto";
import { afterAll,beforeAll,expect,it } from "vitest";
import { z } from "zod";
import { parseCsv,validateFiles } from "@/domain/imports/validation";
import { compareDelay } from "@/domain/scenario/compare";
import { orderCsv } from "@/domain/orders/export";
import { fileKinds,fields,commitResultSchema,type ParsedFile,type ColumnMappings } from "@/lib/imports/contracts";
import { generationSchema,runDetailSchema } from "@/lib/forecast/contracts";
import { rawListSchema } from "@/lib/inventory/contracts";
import { planContextSchema } from "@/lib/planning/contracts";
import { conversionSchema,orderReadSchema } from "@/lib/orders/contracts";
import { quantityEvidence,orderEvidence,verifySources } from "@/domain/assistant/evidence";

let db:PGlite;
async function scalar<T=unknown>(sql:string,args:unknown[]=[]){return (await db.query<{value:T}>(sql,args)).rows[0].value;}
beforeAll(async()=>{db=new PGlite();await db.exec(await readFile("tests/security/platform.sql","utf8"));for(const file of (await readdir("supabase/migrations")).filter(f=>f.endsWith(".sql")).sort())await db.exec(await readFile("supabase/migrations/"+file,"utf8"));},60000);
afterAll(async()=>{await db?.close();});

it("rehearses actual CSV → forecast → edited plan → scenario → immutable drafts, with safe retries and isolation",async()=>{
  const audit=await db.exec(await readFile("supabase/verify-release.sql","utf8")),catalog=z.object({summary:z.record(z.string(),z.unknown()),tables:z.array(z.record(z.string(),z.unknown()))}).parse(audit[0].rows[0].release_audit);expect(catalog.summary).toEqual({table_count:16,tables_protected:true,functions_deny_anonymous:true,definer_search_paths_safe:true,private_import_bucket:true});expect(catalog.tables).toHaveLength(16);
  const user=randomUUID(),otherUser=randomUUID();await db.query("insert into auth.users(id) values($1),($2)",[user,otherUser]);await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user]);await db.exec("set role authenticated");
  const org=await scalar<string>("select public.create_workspace('P9 SYNTHETIC TEST ONLY','Dhaka',false) as value"),asOf=await scalar<string>("select (now() at time zone 'Asia/Dhaka')::date::text as value");
  const shift=(date:string)=>new Date(Date.parse(date+"T00:00:00Z")+Date.parse(asOf+"T00:00:00Z")-Date.parse("2026-11-11T00:00:00Z")).toISOString().slice(0,10);
  const files={} as Record<typeof fileKinds[number],ParsedFile>,manifest:{kind:typeof fileKinds[number];filename:string;size:number;sha256:string;headers:string[]}[]=[];
  for(const kind of fileKinds){const text=(await readFile(`tests/fixtures/synthetic-import/${kind}.csv`,"utf8")).replace(/2026-\d{2}-\d{2}/g,shift),bytes=new TextEncoder().encode(text);files[kind]=parseCsv(bytes);manifest.push({kind,filename:kind+".csv",size:bytes.length,sha256:createHash("sha256").update(bytes).digest("hex"),headers:files[kind].headers});}
  const mappings=Object.fromEntries(fileKinds.map(kind=>[kind,Object.fromEntries(fields[kind].map(field=>[field,field]))])) as ColumnMappings;
  const validated=validateFiles(files,mappings,{suppliers:[],skus:[]},asOf);expect(validated.report.valid).toBe(true);expect(validated.report.rowCount).toBe(418);
  async function upload(confirm=false){const job=randomUUID();await db.query("select public.begin_import($1,$2,$3::jsonb)",[org,job,JSON.stringify(manifest)]);for(const kind of fileKinds)await db.query("insert into storage.objects(bucket_id,name) values('retail-imports',$1)",[`${org}/${job}/${kind}.csv`]);const report=z.object({validationToken:z.uuid()}).parse(await scalar("select public.validate_import($1,$2,$3::jsonb,$4::jsonb,$5::jsonb) as value",[org,job,JSON.stringify(mappings),JSON.stringify(validated.batch),JSON.stringify(validated.report)]));const args=[org,job,JSON.stringify(validated.batch),confirm,report.validationToken];return {args,result:commitResultSchema.parse(await scalar("select public.commit_import($1,$2,$3::jsonb,$4,$5) as value",args))};}
  const imported=await upload();expect(imported.result.counts.sales_daily.inserted).toBe(399);expect(commitResultSchema.parse(await scalar("select public.commit_import($1,$2,$3::jsonb,$4,$5) as value",imported.args)).alreadyCommitted).toBe(true);
  let firstRun="";for(const horizon of [7,14,28]){const run=generationSchema.parse(await scalar("select public.generate_forecast($1,$2,$3) as value",[org,asOf,horizon]));expect(run.status).toBe("succeeded");if(horizon===7)firstRun=run.runId;const detail=runDetailSchema.parse(await scalar("select public.read_forecast_run($1,$2) as value",[org,run.runId]));expect(detail.run.summary).toEqual({total:8,sufficient:7,insufficient:1});expect(await scalar("select count(*)::integer as value from public.forecast_points p join public.forecast_product_results r on r.id=p.result_id and r.org_id=p.org_id where r.run_id=$1",[run.runId])).toBe(7*horizon);expect(generationSchema.parse(await scalar("select public.generate_forecast($1,$2,$3) as value",[org,asOf,horizon])).runId).toBe(run.runId);}
  const inventory=rawListSchema.parse(await scalar("select public.read_inventory($1) as value",[org]));expect(inventory.summary).toMatchObject({total:8,at_risk:1,reorder_soon:3,healthy:3,unknown:1});
  const planId=randomUUID();await db.query("select public.create_replenishment_plan($1,$2,$3,50000,7,2)",[org,planId,firstRun]);const readPlan=async()=>planContextSchema.parse(await scalar("select public.read_plan_context($1,$2) as value",[org,planId]));const initial=await readPlan(),oil=initial.items.find(row=>row.sku==="QA-102")!;expect(initial.plan.summary.approvedTotal).toBe("49930.00");
  const baseline=JSON.stringify(initial),scenario=compareDelay(initial.items,oil.supplierId,3);expect(scenario.summary.newlyAtRisk).toBe(1);expect(JSON.stringify(await readPlan())).toBe(baseline);
  await db.query("select public.set_plan_line_quantity($1,$2,$3,65,0)",[org,planId,oil.id]);const edited=await readPlan();expect(edited.plan.summary.approvedTotal).toBe("48880.00");expect(quantityEvidence(edited.plan,edited.items,oil.productId).answer.finding).toContain("65");await expect(db.query("select public.set_plan_budget($1,$2,1,0)",[org,planId])).rejects.toMatchObject({message:"STALE_REVISION"});
  const converted=conversionSchema.parse(await scalar("select public.convert_plan_to_drafts($1,$2,1) as value",[org,planId]));expect(converted.purchaseOrderIds).toHaveLength(2);expect(conversionSchema.parse(await scalar("select public.convert_plan_to_drafts($1,$2,1) as value",[org,planId])).purchaseOrderIds).toEqual(converted.purchaseOrderIds);
  const readOrders=async()=>Promise.all(converted.purchaseOrderIds.map(async id=>orderReadSchema.parse(await scalar("select public.read_purchase_order($1,$2) as value",[org,id]))));const orders=await readOrders();expect(orders.map(o=>o.order.total).sort()).toEqual(["14510.00","34370.00"]);for(const order of orders){expect(orderCsv(order)).toContain(order.order.total);expect(orderEvidence(order).answer.finding).toContain("hasn't been sent");expect(verifySources(orderEvidence(order).answer)).toBe(true);}
  const repeated=await upload(true);expect(repeated.result.counts.sales_daily.updated).toBe(399);expect(await scalar("select count(*)::integer as value from public.sales_daily where org_id=$1",[org])).toBe(399);expect(await readOrders()).toEqual(orders);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[otherUser]);const otherOrg=await scalar<string>("select public.create_workspace('P9 OTHER SYNTHETIC TEST','Dhaka',false) as value");expect(await scalar("select public.read_purchase_order($1,$2) as value",[otherOrg,orders[0].order.id])).toBeNull();await expect(scalar("select public.read_plan_context($1,$2) as value",[org,planId])).rejects.toMatchObject({code:"42501"});
},30000);
