import { PGlite } from "@electric-sql/pglite";
import { readFile,readdir } from "node:fs/promises";
import { afterAll,afterEach,beforeAll,beforeEach,describe,expect,it } from "vitest";
import { rawDetailSchema,rawListSchema } from "@/lib/inventory/contracts";
import { classifyStock } from "@/domain/inventory/risk";

let db:PGlite,org:string,foreign:string,sample:string,today:string,inTest=false;
const uid=(n:number)=>`50000000-0000-4000-8000-${n.toString().padStart(12,"0")}`;
const a=uid(1),b=uid(2),viewer=uid(3),supplier=uid(10),product=uid(11),run=uid(12);
async function query<T=Record<string,unknown>>(sql:string,args:unknown[]=[]) {
  if(!inTest)return db.query<T>(sql,args);
  await db.exec("savepoint test_statement");try{const result=await db.query<T>(sql,args);await db.exec("release savepoint test_statement");return result;}catch(error){await db.exec("rollback to savepoint test_statement;release savepoint test_statement");throw error;}
}
async function scalar<T>(sql:string,args:unknown[]=[]) {return (await query<{value:T}>(sql,args)).rows[0].value;}
async function as(user:string|null,role="authenticated") {await db.exec("reset role");await query("select set_config('request.jwt.claim.sub',$1,false)",[user??""]);await db.exec(`set role ${role}`);}
async function inventory(args:{org?:string;q?:string;status?:string;supplier?:string;sort?:string;limit?:number;after?:unknown;revision?:string}={}) {
  return rawListSchema.parse(await scalar("select public.read_inventory($1,$2,$3,$4,$5,$6,$7::jsonb,$8) as value",[args.org??org,args.q??"",args.status??null,args.supplier??null,args.sort??"cover_asc",args.limit??25,args.after?JSON.stringify(args.after):null,args.revision??null]));
}
beforeAll(async()=>{
  db=new PGlite();await db.exec(await readFile("tests/security/platform.sql","utf8"));
  for(const file of (await readdir("supabase/migrations")).filter(name=>name.endsWith(".sql")).sort())await db.exec(await readFile(`supabase/migrations/${file}`,"utf8"));
  for(const id of [a,b,viewer])await query("insert into auth.users(id) values($1)",[id]);
  await as(a);org=await scalar<string>("select public.create_workspace('Inventory A','Dhaka',false) as value");sample=await scalar<string>("select public.create_sample_workspace() as value");
  await as(b);foreign=await scalar<string>("select public.create_workspace('Inventory B','Dhaka',false) as value");
  await db.exec("reset role");await query("insert into public.organization_members(org_id,user_id,role) values($1,$2,'viewer')",[org,viewer]);
  today=await scalar<string>("select (now() at time zone 'Asia/Dhaka')::date::text as value");
},60000);
beforeEach(async()=>{
  await db.exec("reset role;begin");inTest=true;
  await query("insert into public.suppliers(id,org_id,name,lead_time_days) values($1,$2,'Supplier',6)",[supplier,org]);
  await query("insert into public.products(id,org_id,supplier_id,sku,name,purchase_cost) values($1,$2,$3,'OIL','Oil',210)",[product,org,supplier]);
  await query("insert into public.inventory_snapshots(org_id,product_id,as_of_date,on_hand) values($1,$2,$3,38)",[org,product,today]);
  await as(a);
});
afterEach(async()=>{inTest=false;await db.exec("rollback;reset role");});
afterAll(async()=>{await db?.close();});
async function forecast(quality="sufficient",rate:string|null="7.0000") {
  await db.exec("reset role");
  await query("insert into public.forecast_runs(id,org_id,created_by,method,status,as_of_date,horizon_days,finished_at) values($1,$2,$3,'seasonal_baseline','succeeded',$4,7,now())",[run,org,a,today]);
  await query("insert into public.forecast_product_results(org_id,run_id,product_id,estimated_daily_units,quality,eligible_history_days) values($1,$2,$3,$4,$5,14)",[org,run,product,rate,quality]);
  await as(a);
}
describe("inventory read model and pure risk parity",()=>{
  it("keeps imported real inventory unknown until saved sufficient demand exists",async()=>{
    const data=await inventory();expect(data.items[0]).toMatchObject({sku:"OIL",purchase_cost:"210.00",on_hand:38,risk_code:"unknown",forecast_run_id:null});expect(data.summary.unknown).toBe(1);
  });
  it("uses exact sample rates only in isolated sample organizations",async()=>{
    const data=await inventory({org:sample});expect(data.summary).toMatchObject({total:8,at_risk:1,reorder_soon:3,healthy:4,unknown:0});
    const oil=data.items.find(item=>item.sku==="RL-102")!;expect(oil).toMatchObject({on_hand:38,estimated_daily_units:"7.0000",lead_days:6,method:"sample_fixture",is_sample:true});
    for(const row of data.items)expect(classifyStock(row.on_hand,row.estimated_daily_units,row.quality,row.lead_days).code).toBe(row.risk_code);
    expect((await inventory()).items[0].method).toBeNull();
  });
  it("selects latest eligible snapshot and ignores future inventory",async()=>{
    await db.exec("reset role");await query("insert into public.inventory_snapshots(org_id,product_id,as_of_date,on_hand) values($1,$2,$3::date-1,1),($1,$2,$3::date+1,999)",[org,product,today]);await as(a);
    expect((await inventory()).items[0]).toMatchObject({on_hand:38,future_snapshot:true});
  });
  it("does not use failed, incomplete or insufficient runs, or older sufficient results",async()=>{
    await forecast();await db.exec("reset role");
    await query("insert into public.forecast_runs(org_id,created_by,method,status,as_of_date,horizon_days,finished_at) values($1,$2,'seasonal_baseline','failed',$3,7,now()+interval '1 second')",[org,a,today]);await as(a);expect((await inventory()).items[0].risk_code).toBe("at_risk");
    await db.exec("reset role");const newer=await scalar<string>("insert into public.forecast_runs(org_id,created_by,method,status,as_of_date,horizon_days,finished_at) values($1,$2,'seasonal_baseline','succeeded',$3,7,now()+interval '2 second') returning id as value",[org,a,today]);
    await query("insert into public.forecast_product_results(org_id,run_id,product_id,quality) values($1,$2,$3,'insufficient')",[org,newer,product]);await as(a);expect((await inventory()).items[0].risk_code).toBe("unknown");
  });
  it("labels stale snapshots and forecasts without silently treating them as fresh",async()=>{
    await forecast();await db.exec("reset role");await query("update public.inventory_snapshots set as_of_date=$1::date-8 where org_id=$2",[today,org]);await query("update public.forecast_runs set stale_at=now() where id=$1",[run]);await as(a);
    expect((await inventory()).items[0]).toMatchObject({risk_code:"at_risk",snapshot_stale:true,forecast_stale:true});
  });
  it("does not consume sample-fixture demand rows in a real workspace",async()=>{
    await db.exec("reset role");const fixture=await scalar<string>("insert into public.forecast_runs(org_id,created_by,method,status,as_of_date,horizon_days,finished_at) values($1,$2,'sample_fixture','succeeded',$3,7,now()) returning id as value",[org,a,today]);
    await query("insert into public.forecast_product_results(org_id,run_id,product_id,quality,estimated_daily_units) values($1,$2,$3,'sufficient',999)",[org,fixture,product]);await as(a);expect((await inventory()).items[0].risk_code).toBe("unknown");
  });
  it("reads an actual draft budget from immutable line prices and hides stale plans",async()=>{
    await forecast();await db.exec("reset role");const plan=await scalar<string>("insert into public.replenishment_plans(org_id,created_by,forecast_run_id,status,budget) values($1,$2,$3,'draft',50000) returning id as value",[org,a,run]);
    await query("insert into public.plan_lines(org_id,plan_id,product_id,supplier_id,suggested_qty,approved_qty,purchase_cost_snapshot,pack_multiple_snapshot,on_hand_snapshot,estimated_daily_snapshot,lead_time_days_snapshot,risk_class) values($1,$2,$3,$4,65,65,210,1,38,7,6,'at_risk')",[org,plan,product,supplier]);await as(a);
    expect(await scalar("select public.read_inventory_budget($1) as value",[org])).toMatchObject({budget:"50000.00",approvedTotal:"13650.00",remaining:"36350.00",lineCount:1});
    await db.exec("reset role");await query("update public.products set purchase_cost=999 where id=$1",[product]);await as(a);expect(await scalar("select public.read_inventory_budget($1) as value",[org])).toMatchObject({approvedTotal:"13650.00"});
    await db.exec("reset role");await query("update public.replenishment_plans set stale_at=now() where id=$1",[plan]);await as(a);expect(await scalar("select public.read_inventory_budget($1) as value",[org])).toBeNull();
  });
  it("honors SKU lead overrides and exact risk threshold boundaries",async()=>{
    await forecast();await db.exec("reset role");await query("update public.products set lead_time_days_override=3 where id=$1",[product]);await as(a);expect((await inventory()).items[0]).toMatchObject({lead_days:3,risk_code:"reorder_soon"});
    for(const [h,d,l] of [[0,"1.0000",0],[0,"0.0000",0],[6,"1.0000",6],[13,"1.0000",6],[14,"1.0000",6],[6,"1.0001",6]] as const){
      await db.exec("reset role");await query("update public.inventory_snapshots set on_hand=$1 where org_id=$2",[h,org]);await query("update public.products set lead_time_days_override=$1 where id=$2",[l,product]);await query("update public.forecast_product_results set estimated_daily_units=$1 where run_id=$2",[d,run]);await as(a);
      const row=(await inventory()).items[0];expect(row.risk_code).toBe(classifyStock(h,d,"sufficient",l).code);
    }
  });
  it("searches literals, filters by supplier/status, and retains whole-workspace totals",async()=>{
    await forecast();expect((await inventory({q:"oiL",status:"at_risk",supplier})).matchCount).toBe(1);
    expect((await inventory({q:"%"})).matchCount).toBe(0);const empty=await inventory({q:"missing"});expect(empty.items).toHaveLength(0);expect(empty.summary.total).toBe(1);
  });
  it.each(["cover_asc","cover_desc","sku_asc","name_asc","risk"])("paginates %s stably without duplicates",async sort=>{
    let page=await inventory({org:sample,sort,limit:3});const ids=page.items.map(item=>item.id);
    while(page.nextPosition){page=await inventory({org:sample,sort,limit:3,after:page.nextPosition,revision:page.revision});ids.push(...page.items.map(item=>item.id));}
    expect(ids).toHaveLength(8);expect(new Set(ids).size).toBe(8);
  });
  it("rejects stale cursors after an import/source change and invalid query options",async()=>{
    const page=await inventory({org:sample,limit:2});await db.exec("reset role");await query("update public.products set updated_at=now()+interval '1 second' where org_id=$1",[sample]);await as(a);
    await expect(inventory({org:sample,limit:2,after:page.nextPosition,revision:page.revision})).rejects.toMatchObject({message:"STALE_CURSOR"});
    await expect(inventory({limit:101})).rejects.toMatchObject({code:"22023"});
  });
  it("returns only recorded sales dates and stored forecast points for the requested product",async()=>{
    await forecast();await db.exec("reset role");
    await query("insert into public.sales_daily(org_id,product_id,sales_date,units_sold,availability_status) values($1,$2,$3::date-1,0,'stockout'),($1,$2,$3::date-3,7,'unknown'),($1,$2,$3::date+1,99,'available')",[org,product,today]);
    await query("insert into public.forecast_points(org_id,result_id,forecast_date,projected_units) select $1,id,$2::date+1,7 from public.forecast_product_results where run_id=$3",[org,today,run]);await as(a);
    const detail=rawDetailSchema.parse(await scalar("select public.read_product($1,$2) as value",[org,product]));expect(detail.sales).toHaveLength(2);expect(detail.sales[1]).toMatchObject({units:0,availability:"stockout"});expect(detail.forecasts).toHaveLength(1);
  });
});
describe("inventory authorization",()=>{
  it("retains RLS on direct view reads and rejects another tenant's RPC IDs",async()=>{
    await as(b);expect((await query("select * from public.inventory_source_rows where org_id=$1",[org])).rows).toHaveLength(0);
    await expect(inventory()).rejects.toMatchObject({code:"42501"});expect(await scalar("select public.read_product($1,$2) as value",[foreign,product])).toBeNull();
  });
  it("allows viewer reads but no direct writes, anonymous access or privileged read definer",async()=>{
    await as(viewer);expect((await inventory()).items).toHaveLength(1);await expect(query("update public.products set name='forged' where id=$1",[product])).rejects.toMatchObject({code:"42501"});
    await as(null,"anon");await expect(inventory()).rejects.toMatchObject({code:"42501"});await expect(query("select * from public.inventory_source_rows")).rejects.toMatchObject({code:"42501"});
    await db.exec("reset role");expect((await query<{prosecdef:boolean}>("select prosecdef from pg_proc where proname in ('read_inventory','read_product','read_inventory_budget')")).rows.every(row=>row.prosecdef===false)).toBe(true);
  });
});
