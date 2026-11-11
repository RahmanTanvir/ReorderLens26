import { PGlite } from "@electric-sql/pglite";
import { readFile,readdir } from "node:fs/promises";
import { afterAll,afterEach,beforeAll,beforeEach,describe,expect,it } from "vitest";
import { forecastProduct,shiftDate } from "@/domain/forecast/baseline";
import { generationSchema,runDetailSchema,runListSchema,type Observation } from "@/lib/forecast/contracts";
let db:PGlite,org:string,foreign:string,sample:string,today:string,inTest=false;
const uid=(n:number)=>`60000000-0000-4000-8000-${n.toString().padStart(12,"0")}`;
const owner=uid(1),outsider=uid(2),viewer=uid(3),operator=uid(4),supplier=uid(10),product=uid(11);
async function query<T=Record<string,unknown>>(sql:string,args:unknown[]=[]) {
  if(!inTest)return db.query<T>(sql,args);
  await db.exec("savepoint test_statement");try{const result=await db.query<T>(sql,args);await db.exec("release savepoint test_statement");return result;}catch(error){await db.exec("rollback to savepoint test_statement;release savepoint test_statement");throw error;}
}
async function scalar<T>(sql:string,args:unknown[]=[]) {return (await query<{value:T}>(sql,args)).rows[0].value;}
async function as(user:string|null,role="authenticated") {await db.exec("reset role");await query("select set_config('request.jwt.claim.sub',$1,false)",[user??""]);await db.exec(`set role ${role}`);}
async function generate(horizon=7,date=today,workspace=org) {return generationSchema.parse(await scalar("select public.generate_forecast($1,$2,$3) as value",[workspace,date,horizon]));}
async function read(id:string,workspace=org,limit=25,after:string|null=null,selected:string|null=null) {return runDetailSchema.parse(await scalar("select public.read_forecast_run($1,$2,$3,$4,$5) as value",[workspace,id,limit,after,selected]));}
async function seed(rows:Observation[],pid=product) {await db.exec("reset role");for(const row of rows)await query("insert into public.sales_daily(org_id,product_id,sales_date,units_sold,availability_status,promo_active) values($1,$2,$3,$4,$5,$6)",[org,pid,row.date,row.units,row.availability,row.promo]);await as(owner);}
function history(n=28):Observation[]{return Array.from({length:n},(_,i)=>({date:shiftDate(today,-i),units:i%11,availability:"available",promo:false}));}
beforeAll(async()=>{
  db=new PGlite();await db.exec(await readFile("tests/security/platform.sql","utf8"));
  for(const file of (await readdir("supabase/migrations")).filter(name=>name.endsWith(".sql")).sort())await db.exec(await readFile(`supabase/migrations/${file}`,"utf8"));
  for(const id of [owner,outsider,viewer,operator])await query("insert into auth.users(id) values($1)",[id]);
  await as(owner);org=await scalar<string>("select public.create_workspace('Forecast A','Dhaka',false) as value");sample=await scalar<string>("select public.create_sample_workspace() as value");
  await as(outsider);foreign=await scalar<string>("select public.create_workspace('Forecast B','Dhaka',false) as value");
  await db.exec("reset role");await query("insert into public.organization_members(org_id,user_id,role) values($1,$2,'viewer'),($1,$3,'operator')",[org,viewer,operator]);
  today=await scalar<string>("select (now() at time zone 'Asia/Dhaka')::date::text as value");
},60000);
beforeEach(async()=>{
  await db.exec("reset role;begin");inTest=true;
  await query("insert into public.suppliers(id,org_id,name,lead_time_days) values($1,$2,'Supplier',6)",[supplier,org]);
  await query("insert into public.products(id,org_id,supplier_id,sku,name,purchase_cost) values($1,$2,$3,'OIL','Oil',210)",[product,org,supplier]);await as(owner);
});
afterEach(async()=>{inTest=false;await db.exec("rollback;reset role");});afterAll(async()=>{await db?.close();});
describe("forecast calculation and persistence",()=>{
  it.each([7,14,28])("matches exact TypeScript baseline for %i days and survives re-reading",async horizon=>{
    const rows=history();rows[2].availability="stockout";rows[4].availability="unknown";rows[5].promo=true;await seed(rows);
    const expected=forecastProduct(rows,today,horizon as 7|14|28),created=await generate(horizon);expect(created.status).toBe("succeeded");
    const detail=await read(created.runId);expect(detail.selected?.item).toMatchObject({dailyUnits:expected.dailyUnits,eligibleDays:expected.eligibleDays,quality:expected.quality,
      observedDays:28,stockoutDays:1,unknownDays:1,promoDays:1,availabilityUsed:true,reasonCodes:expected.reasonCodes});
    expect(detail.selected?.history).toEqual(expected.history);expect(detail.selected?.points).toEqual(expected.points);
    expect(detail.run).toMatchObject({version:expected.version,historyStart:expected.historyStart,historyEnd:today,status:"succeeded",summary:{total:1,sufficient:1,insufficient:0}});
    expect(await generate(horizon)).toMatchObject({runId:created.runId,reused:true});
  });
  it.each([0,13,14])("persists %i recorded days without inventing missing dates",async count=>{
    await seed(history(count));const result=await read((await generate()).runId);
    expect(result.selected?.item.quality).toBe(count>=14?"sufficient":"insufficient");expect(result.selected?.history).toHaveLength(count);expect(result.selected?.points).toHaveLength(count>=14?7:0);
    if(count<14)expect(result.selected?.item).toMatchObject({dailyUnits:null,horizonTotal:null,reasonCodes:expect.arrayContaining(["INSUFFICIENT_HISTORY"])});
  });
  it("gates sufficient but old history and excludes observations beyond cutoff/window",async()=>{
    await seed([...history(14).map(row=>({...row,date:shiftDate(row.date,-7)})),{date:shiftDate(today,1),units:999,availability:"available",promo:false},{date:shiftDate(today,-28),units:999,availability:"available",promo:false}]);
    const detail=await read((await generate()).runId);expect(detail.selected?.item).toMatchObject({eligibleDays:14,quality:"insufficient",reasonCodes:["NO_RECENT_OBSERVATION","BASELINE_LIMITS"]});expect(detail.selected?.points).toEqual([]);
  });
  it("keeps zero demand sufficient and never divides by zero",async()=>{
    await seed(history(14).map(row=>({...row,units:0})));const detail=await read((await generate(28)).runId);
    expect(detail.selected?.item).toMatchObject({quality:"sufficient",dailyUnits:"0.0000",horizonTotal:"0.0000"});expect(detail.selected?.points).toHaveLength(28);
  });
  it("uses weekday fallback and does not average rounded persisted points for D7",async()=>{
    const rows=history(17).filter((_,i)=>![2,9,16].includes(i)).map((row,i)=>({...row,units:i===0?1:0}));await seed(rows);
    const expected=forecastProduct(rows,today,28),detail=await read((await generate(28)).runId);expect(detail.selected?.item.dailyUnits).toBe(expected.dailyUnits);expect(detail.selected?.points).toEqual(expected.points);
    expect(await scalar("select private.forecast_round4(1,20000)::text as value").catch(()=>"private")).toBe("private");
    await db.exec("reset role");expect(await scalar("select private.forecast_round4(1,20000)::numeric(14,4)::text as value")).toBe("0.0001");
  });
  it("freezes catalog/history/points and creates a new version after source changes",async()=>{
    await seed(history());const first=await generate(),saved=await read(first.runId);
    await db.exec("reset role");await query("update public.sales_daily set units_sold=999 where org_id=$1 and sales_date=$2",[org,today]);await query("update public.products set name='Renamed' where id=$1",[product]);await as(owner);
    expect(await read(first.runId)).toEqual(saved);const second=await generate();expect(second.runId).not.toBe(first.runId);expect((await read(second.runId)).selected?.item.name).toBe("Renamed");
  });
  it("matches exact pre-rounding D7 on fractional thirds",async()=>{
    const rows:Observation[]=[];
    for(let weekday=0;weekday<7;weekday++)rows.push(...history().filter(row=>new Date(`${row.date}T00:00:00Z`).getUTCDay()===weekday).slice(0,weekday<3?3:2).map((row,i)=>({...row,units:weekday<3&&i===0?1:0})));
    await seed(rows);const detail=await read((await generate()).runId);expect(detail.selected?.item.dailyUnits).toBe("0.1429");expect(detail.selected?.points).toEqual(forecastProduct(rows,today,7).points);
  });
  it("feeds the latest completed baseline into inventory risk without fallback",async()=>{
    await seed(history(14).map(row=>({...row,units:7})));await db.exec("reset role");await query("insert into public.inventory_snapshots(org_id,product_id,as_of_date,on_hand) values($1,$2,$3,38)",[org,product,today]);await as(owner);
    const first=await generate();const inventory=await scalar<{items:{forecast_run_id:string;estimated_daily_units:string;risk_code:string}[]}>("select public.read_inventory($1) as value",[org]);expect(inventory.items[0]).toMatchObject({forecast_run_id:first.runId,estimated_daily_units:"7.0000",risk_code:"at_risk"});
    await db.exec("reset role");await query("delete from public.sales_daily where org_id=$1 and sales_date=$2",[org,today]);await as(owner);const second=await generate();expect(second.runId).not.toBe(first.runId);
    expect((await scalar<typeof inventory>("select public.read_inventory($1) as value",[org])).items[0]).toMatchObject({forecast_run_id:second.runId,estimated_daily_units:null,risk_code:"unknown"});
  });
  it("marks saved runs stale after later imports without modifying their results",async()=>{
    await seed(history());const first=await generate();await db.exec("reset role");await query("insert into public.import_jobs(org_id,created_by,status,storage_prefix,committed_at) values($1,$2,'committed','test',now()+interval '1 second')",[org,owner]);await as(owner);
    expect((await read(first.runId)).run.staleAt).not.toBeNull();expect((await generate()).runId).not.toBe(first.runId);
  });
  it("rolls back partial output and persists only a safe failed-run status",async()=>{
    await seed(history());await db.exec("reset role");await db.exec("create function private.fail_point() returns trigger language plpgsql as $$begin raise exception 'SECRET INTERNAL FAILURE';end$$;create trigger test_fail_point before insert on public.forecast_points for each row execute function private.fail_point();");await as(owner);
    const result=await generate();expect(result).toMatchObject({status:"failed",errorCode:"BASELINE_FAILED",reused:false});const detail=await read(result.runId);expect(detail.items).toHaveLength(0);expect(detail.run.summary.total).toBe(0);expect(JSON.stringify(detail)).not.toContain("SECRET");
  });
  it("enforces durable new-run limits and permits successful idempotent retries",async()=>{
    await seed(history());const first=await generate();await db.exec("reset role");await query("insert into public.forecast_runs(org_id,created_by,method,status,as_of_date,horizon_days) select $1,$2,'seasonal_baseline','failed',$3,7 from generate_series(1,9)",[org,owner,today]);await as(owner);
    expect((await generate()).runId).toBe(first.runId);await expect(generate(14)).rejects.toMatchObject({message:"FORECAST_LIMIT"});
  });
  it("reads immutable results with stable pages and product selection",async()=>{
    await db.exec("reset role");for(let i=20;i<26;i++)await query("insert into public.products(id,org_id,supplier_id,sku,name,purchase_cost) values($1,$2,$3,$4,'Extra',1)",[uid(i),org,supplier,`SKU-${i}`]);await as(owner);
    const first=await generate();let page=await read(first.runId,org,2);const ids=page.items.map(row=>row.id);while(page.nextCursor){page=await read(first.runId,org,2,page.nextCursor);ids.push(...page.items.map(row=>row.id));}
    expect(ids).toHaveLength(7);expect(new Set(ids).size).toBe(7);expect((await read(first.runId,org,2,null,uid(25))).selected?.item.productId).toBe(uid(25));
    await generate(14);await generate(28);const runs=runListSchema.parse(await scalar("select public.list_forecast_runs($1,2) as value",[org]));expect(runs.items).toHaveLength(2);expect(runs.nextCursor).not.toBeNull();
    const older=runListSchema.parse(await scalar("select public.list_forecast_runs($1,2,$2) as value",[org,runs.nextCursor]));expect(older.items).toHaveLength(1);expect(new Set([...runs.items,...older.items].map(row=>row.id)).size).toBe(3);
  });
});
describe("forecast authorization",()=>{
  it("denies foreign org/run/product IDs and keeps direct result RLS",async()=>{
    const first=await generate();await as(outsider);await expect(generate()).rejects.toMatchObject({code:"42501"});await expect(read(first.runId)).rejects.toMatchObject({code:"42501"});
    expect(await scalar("select public.read_forecast_run($1,$2) as value",[foreign,first.runId])).toBeNull();expect((await query("select * from public.forecast_runs where org_id=$1",[org])).rows).toHaveLength(0);
    await as(owner);expect(await scalar("select public.read_forecast_run($1,$2,25,null,$3) as value",[org,first.runId,uid(99)])).toBeNull();
  });
  it("allows viewer reads, operator generation, and prevents direct writes/helper execution",async()=>{
    await as(operator);const first=await generate();await as(viewer);expect((await read(first.runId)).total).toBe(1);await expect(generate()).rejects.toMatchObject({code:"42501"});
    for(const table of ["forecast_runs","forecast_product_results","forecast_points"])await expect(query(`delete from public.${table} where org_id=$1`,[org])).rejects.toMatchObject({code:"42501"});
    await expect(query("select private.forecast_baseline($1,$2,$3,7)",[org,product,today])).rejects.toMatchObject({code:"42501"});
    await as(null,"anon");await expect(generate()).rejects.toMatchObject({code:"42501"});await expect(read(first.runId)).rejects.toMatchObject({code:"42501"});
  });
  it("preserves sample rates without fabricating series or enabling sample mutation",async()=>{
    await expect(generate(7,today,sample)).rejects.toMatchObject({message:"SAMPLE_READ_ONLY"});
    const list=runListSchema.parse(await scalar("select public.list_forecast_runs($1) as value",[sample]));expect(list.items).toHaveLength(1);const detail=await read(list.items[0].id,sample);
    expect(detail.items).toHaveLength(8);expect(detail.selected?.points).toHaveLength(0);expect(detail.selected?.item.horizonTotal).toBeNull();expect(detail.selected?.item.reasonCodes).toEqual(["ILLUSTRATIVE_SAMPLE"]);
  });
  it("rejects future/invalid horizons, empty catalogs and unrelated cursors",async()=>{
    await expect(generate(8)).rejects.toMatchObject({code:"22023"});await expect(generate(7,shiftDate(today,1))).rejects.toMatchObject({code:"22023"});const first=await generate();
    await expect(read(first.runId,org,101)).rejects.toMatchObject({code:"22023"});await expect(read(first.runId,org,2,uid(99))).rejects.toMatchObject({code:"22023"});
    await as(outsider);await expect(generate(7,today,foreign)).rejects.toMatchObject({message:"EMPTY_CATALOG"});
  });
});
