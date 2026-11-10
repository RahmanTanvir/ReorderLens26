import { PGlite } from "@electric-sql/pglite";
import { readFile,readdir } from "node:fs/promises";
import { afterAll,afterEach,beforeAll,beforeEach,describe,expect,it } from "vitest";
import type { ImportBatch } from "@/lib/imports/contracts";

let db:PGlite;let orgA:string;let orgB:string;let sample:string;let nextJob=100;
let inTest=false;
const validationTokens=new Map<string,string>();
// Expected SQL failures must not poison the transaction isolating each test.
async function query<T=Record<string,unknown>>(sql:string,args:unknown[]=[]) {
  if(!inTest)return db.query<T>(sql,args);
  await db.exec("savepoint test_statement");
  try {const result=await db.query<T>(sql,args);await db.exec("release savepoint test_statement");return result;}
  catch(error){await db.exec("rollback to savepoint test_statement;release savepoint test_statement");throw error;}
}
const uid=(n:number)=>`10000000-0000-4000-8000-${n.toString().padStart(12,"0")}`;
const users={a:uid(1),b:uid(2),viewer:uid(3),operator:uid(4)};
const kinds=["suppliers","products","inventory_snapshots","sales_daily"];
const manifest=kinds.map(kind=>({kind,filename:`${kind}.csv`,size:1,sha256:"0".repeat(64),headers:["name"]}));
const input=():ImportBatch=>({suppliers:[{name:"Import Supplier",lead_time_days:6}],products:[{sku:"IMPORT-1",name:"Imported product",supplier_name:"Import Supplier",purchase_cost:"210.00",lead_time_days_override:3,pack_multiple:1}],inventory_snapshots:[{sku:"IMPORT-1",as_of_date:"2026-11-09",on_hand:38}],sales_daily:[{sku:"IMPORT-1",sales_date:"2026-11-08",units_sold:7,availability_status:"unknown",promo_active:false}]});
const report={valid:true,rowCount:4,errorCount:0,errors:[],preview:[],mappingVersion:1};
async function as(user:string|null,role="authenticated") {await db.exec("reset role");await query("select set_config('request.jwt.claim.sub',$1,false)",[user??""]);await db.exec(`set role ${role}`);}
async function scalar<T>(sql:string,args:unknown[]=[]) {return (await query<{value:T}>(sql,args)).rows[0].value;}
async function begin(org=orgA,user=users.a) {
  await as(user);const job=uid(nextJob++);
  await query("select public.begin_import($1,$2,$3::jsonb)",[org,job,JSON.stringify(manifest)]);
  for(const kind of kinds)await query("insert into storage.objects(bucket_id,name) values('retail-imports',$1)",[`${org}/${job}/${kind}.csv`]);
  return job;
}
async function validate(job:string,data=input()) {const result=await scalar<Record<string,unknown>>("select public.validate_import($1,$2,'{}'::jsonb,$3::jsonb,$4::jsonb) as value",[orgA,job,JSON.stringify(data),JSON.stringify(report)]);validationTokens.set(job,result.validationToken as string);return result;}
async function commit(job:string,data=input(),confirm=false,token=validationTokens.get(job)??null) {return scalar<{alreadyCommitted:boolean;counts:Record<string,{inserted:number;updated:number}>}>("select public.commit_import($1,$2,$3::jsonb,$4,$5) as value",[orgA,job,JSON.stringify(data),confirm,token]);}
beforeAll(async()=>{
  db=new PGlite();await db.exec(await readFile("tests/security/platform.sql","utf8"));
  for(const file of (await readdir("supabase/migrations")).filter(name=>name.endsWith(".sql")).sort())await db.exec(await readFile(`supabase/migrations/${file}`,"utf8"));
  for(const user of Object.values(users))await query("insert into auth.users(id) values($1)",[user]);
  await as(users.a);orgA=await scalar<string>("select public.create_workspace('Import A','Dhaka',false) as value");sample=await scalar<string>("select public.create_sample_workspace() as value");
  await as(users.b);orgB=await scalar<string>("select public.create_workspace('Import B','Dhaka',false) as value");
  await db.exec("reset role");await query("insert into public.organization_members(org_id,user_id,role) values($1,$2,'viewer'),($1,$3,'operator')",[orgA,users.viewer,users.operator]);
},60000);
beforeEach(async()=>{await db.exec("reset role;begin");inTest=true;await as(users.a);});
afterEach(async()=>{inTest=false;await db.exec("rollback");await db.exec("reset role");});
afterAll(async()=>{await db?.close();});

describe("guarded import transaction",()=>{
  it("uploads and validates without writing business rows, then commits all four datasets",async()=>{
    const job=await begin();const preview=await validate(job);expect(preview.counts).toMatchObject({products:{inserted:1,updated:0}});
    expect(await scalar<number>("select count(*)::integer as value from public.products where org_id=$1",[orgA])).toBe(0);
    const saved=await commit(job);expect(saved.alreadyCommitted).toBe(false);expect(saved.counts.products).toEqual({inserted:1,updated:0});
    for(const table of ["suppliers","products","inventory_snapshots","sales_daily"])expect(await scalar<number>(`select count(*)::integer as value from public.${table} where org_id=$1`,[orgA])).toBe(1);
  });
  it("replays confirmations without duplicate records or changed timestamps",async()=>{
    const job=await begin();await validate(job);await commit(job);const time=await scalar<string>("select committed_at::text as value from public.import_jobs where id=$1",[job]);
    const repeats=[await commit(job),await commit(job)];expect(repeats.every(item=>item.alreadyCommitted)).toBe(true);
    expect(await scalar<number>("select count(*)::integer as value from public.sales_daily where org_id=$1",[orgA])).toBe(1);
    expect(await scalar<string>("select committed_at::text as value from public.import_jobs where id=$1",[job])).toBe(time);
  });
  it("requires explicit confirmation before upserting matching records",async()=>{
    const first=await begin();await validate(first);await commit(first);
    const changed=input();changed.sales_daily[0].units_sold=9;const second=await begin();const preview=await validate(second,changed);
    expect(preview.counts).toMatchObject({sales_daily:{inserted:0,updated:1}});
    await expect(commit(second,changed)).rejects.toMatchObject({message:"CONFLICT_REQUIRES_CONFIRMATION"});
    expect(await scalar<number>("select units_sold as value from public.sales_daily where org_id=$1",[orgA])).toBe(7);
    expect((await commit(second,changed,true)).counts.sales_daily.updated).toBe(1);
    expect(await scalar<number>("select units_sold as value from public.sales_daily where org_id=$1",[orgA])).toBe(9);
  });
  it("rechecks update conflicts created by another job after the preview",async()=>{
    const first=await begin(),second=await begin();await validate(first);await validate(second);await commit(first);
    await expect(commit(second)).rejects.toMatchObject({message:"CONFLICT_REQUIRES_CONFIRMATION"});
  });
  it("rejects tampered payloads, missing validation and missing source objects",async()=>{
    const job=await begin();await expect(commit(job)).rejects.toMatchObject({message:"IMPORT_STALE_FILE"});await validate(job);
    const tampered=input();tampered.products[0].purchase_cost="1.00";await expect(commit(job,tampered)).rejects.toMatchObject({message:"IMPORT_STALE_FILE"});
    const missing=uid(nextJob++);await query("select public.begin_import($1,$2,$3::jsonb)",[orgA,missing,JSON.stringify(manifest)]);await expect(validate(missing)).rejects.toMatchObject({message:"IMPORT_FILES_MISSING"});
  });
  it("rejects confirmation of a preview replaced by another validation",async()=>{
    const job=await begin();await validate(job);const old=validationTokens.get(job)!;await validate(job);
    await expect(commit(job,input(),true,old)).rejects.toMatchObject({message:"IMPORT_STALE_FILE"});
    expect((await commit(job)).alreadyCommitted).toBe(false);
  });
  it("rejects invalid rows/duplicates and leaves the whole catalog unchanged",async()=>{
    const job=await begin();const bad=input();bad.products[0].purchase_cost="-2";await expect(validate(job,bad)).rejects.toMatchObject({code:"22023"});
    const duplicates=input();duplicates.products.push({...duplicates.products[0]});await expect(validate(job,duplicates)).rejects.toMatchObject({message:"DUPLICATE_KEY"});
    const orphan=input();orphan.sales_daily[0].sku="FOREIGN";await expect(validate(job,orphan)).rejects.toMatchObject({message:"UNKNOWN_SKU"});
    expect(await scalar<number>("select count(*)::integer as value from public.products where org_id=$1",[orgA])).toBe(0);
  });
  it("rolls back earlier table writes if a later write fails",async()=>{
    const job=await begin();await validate(job);await db.exec("reset role");
    await db.exec("create function public.test_failure() returns trigger language plpgsql as $$begin raise exception 'TEST_FAILURE';end$$;create trigger fail_sales before insert on public.sales_daily for each row execute function public.test_failure();");
    await as(users.a);await expect(commit(job)).rejects.toMatchObject({message:"TEST_FAILURE"});
    for(const table of ["suppliers","products","inventory_snapshots","sales_daily"])expect(await scalar<number>(`select count(*)::integer as value from public.${table} where org_id=$1`,[orgA])).toBe(0);
    expect(await scalar<string>("select status as value from public.import_jobs where id=$1",[job])).toBe("validated");
  });
  it("allows mapping correction after a failed validation without business changes",async()=>{
    const job=await begin();await query("select public.validate_import($1,$2,'{}'::jsonb,null,$3::jsonb)",[orgA,job,JSON.stringify({...report,valid:false,errorCount:1})]);
    expect(await scalar<string>("select status as value from public.import_jobs where id=$1",[job])).toBe("failed");
    await validate(job);expect(await scalar<string>("select status as value from public.import_jobs where id=$1",[job])).toBe("validated");
  });
  it("marks projections stale while leaving saved PO snapshots untouched",async()=>{
    const job=await begin();await validate(job);await commit(job);await db.exec("reset role");
    const product=await scalar<string>("select id as value from public.products where org_id=$1",[orgA]);const supplier=await scalar<string>("select supplier_id as value from public.products where id=$1",[product]);
    const forecast=await scalar<string>("insert into public.forecast_runs(org_id,created_by,method,status,as_of_date,horizon_days) values($1,$2,'seasonal_baseline','succeeded','2026-11-09',7) returning id as value",[orgA,users.a]);
    const plan=await scalar<string>("insert into public.replenishment_plans(org_id,created_by,forecast_run_id,status,budget) values($1,$2,$3,'draft',50000) returning id as value",[orgA,users.a,forecast]);
    const order=await scalar<string>("insert into public.purchase_orders(org_id,plan_id,supplier_id,order_number,total_cost,created_by) values($1,$2,$3,'TEST',210,$4) returning id as value",[orgA,plan,supplier,users.a]);
    await query("insert into public.purchase_order_lines(org_id,purchase_order_id,product_id,sku_snapshot,product_name_snapshot,qty,purchase_cost_snapshot) values($1,$2,$3,'IMPORT-1','Original',1,210)",[orgA,order,product]);
    const next=await begin();await validate(next);await commit(next,input(),true);
    expect(await scalar<boolean>("select stale_at is not null as value from public.forecast_runs where id=$1",[forecast])).toBe(true);
    expect(await scalar<boolean>("select stale_at is not null as value from public.replenishment_plans where id=$1",[plan])).toBe(true);
    expect(await scalar<string>("select product_name_snapshot as value from public.purchase_order_lines where purchase_order_id=$1",[order])).toBe("Original");
  });
});

describe("import permissions and source privacy",()=>{
  it.each(["b","viewer"] as const)("denies %s beginning or confirming another workspace import",async key=>{
    const job=await begin();await validate(job);await as(users[key]);
    await expect(query("select public.begin_import($1,$2,$3::jsonb)",[orgA,uid(nextJob++),JSON.stringify(manifest)])).rejects.toMatchObject({code:"42501"});
    await expect(commit(job)).rejects.toMatchObject({code:"42501"});
  });
  it("operator may start own job but cannot hijack another editor's job",async()=>{
    const job=await begin();await as(users.operator);await expect(commit(job)).rejects.toMatchObject({code:"42501"});
    expect(await begin(orgA,users.operator)).toBeTruthy();
  });
  it("denies anonymous RPC calls and direct catalog/job writes",async()=>{
    await as(null,"anon");await expect(query("select public.create_sample_workspace()")).rejects.toMatchObject({code:"42501"});await expect(query("select public.begin_import($1,$2,$3::jsonb)",[orgA,uid(nextJob++),JSON.stringify(manifest)])).rejects.toMatchObject({code:"42501"});
    await as(users.a);await expect(query("insert into public.import_jobs(org_id,created_by,storage_prefix) values($1,$2,'forged')",[orgA,users.a])).rejects.toMatchObject({code:"42501"});
  });
  it("reuses an exact upload ID but rejects changed manifest and foreign IDs",async()=>{
    const job=await begin();expect(await scalar<string>("select public.begin_import($1,$2,$3::jsonb) as value",[orgA,job,JSON.stringify(manifest)])).toBe(job);
    const changed=structuredClone(manifest);changed[0].sha256="a".repeat(64);await expect(query("select public.begin_import($1,$2,$3::jsonb)",[orgA,job,JSON.stringify(changed)])).rejects.toMatchObject({message:"IMPORT_STALE_FILE"});
    await as(users.b);await expect(query("select public.begin_import($1,$2,$3::jsonb)",[orgB,job,JSON.stringify(manifest)])).rejects.toMatchObject({code:"42501"});
  });
  it("denies source overwrites/deletions and undeclared object names",async()=>{
    const job=await begin();await validate(job);
    expect((await query("update storage.objects set name=name where name=$1 returning id",[`${orgA}/${job}/suppliers.csv`])).rows).toHaveLength(0);
    expect((await query("delete from storage.objects where name=$1 returning id",[`${orgA}/${job}/suppliers.csv`])).rows).toHaveLength(0);
    await expect(query("insert into storage.objects(bucket_id,name) values('retail-imports',$1)",[`${orgA}/${job}/extra.csv`])).rejects.toMatchObject({code:"42501"});
    await as(users.b);expect((await query("select * from storage.objects where name=$1",[`${orgA}/${job}/suppliers.csv`])).rows).toHaveLength(0);
  });
  it("limits import creation durably per workspace",async()=>{
    for(let index=0;index<20;index++)await begin();await expect(begin()).rejects.toMatchObject({message:"IMPORT_RATE_LIMIT"});
  });
});
describe("isolated sample seed",()=>{
  it("is idempotent, seeds only approved catalog/history and never forecast/PO output",async()=>{
    expect(await scalar<string>("select public.create_sample_workspace() as value")).toBe(sample);
    expect(await scalar<number>("select count(*)::integer as value from public.products where org_id=$1",[sample])).toBe(8);
    expect(await scalar<number>("select count(*)::integer as value from public.sales_daily where org_id=$1",[sample])).toBe(9);
    expect(await scalar<number>("select count(*)::integer as value from public.forecast_runs where org_id=$1",[sample])).toBe(0);
    expect(await scalar<number>("select on_hand as value from public.inventory_snapshots s join public.products p on p.org_id=s.org_id and p.id=s.product_id where p.org_id=$1 and p.sku='RL-102'",[sample])).toBe(38);
    await as(users.b);expect((await query("select * from public.products where org_id=$1",[sample])).rows).toHaveLength(0);
  });
  it("blocks live imports into sample workspaces and leaves real workspaces empty",async()=>{
    await expect(query("select public.begin_import($1,$2,$3::jsonb)",[sample,uid(nextJob++),JSON.stringify(manifest)])).rejects.toMatchObject({code:"42501"});
    expect(await scalar<number>("select count(*)::integer as value from public.products where org_id=$1",[orgA])).toBe(0);
  });
});
