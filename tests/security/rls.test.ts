import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const uid = (n: number) => `00000000-0000-4000-8000-${n.toString().padStart(12, "0")}`;
const users = { a: uid(1), b: uid(2), viewer: uid(3), operator: uid(4) };
let db: PGlite;
let orgA: string;
let orgB: string;
const tenantTables = ["suppliers", "products", "inventory_snapshots", "sales_daily", "import_jobs", "forecast_runs", "forecast_product_results", "forecast_points", "replenishment_plans", "plan_lines", "purchase_orders", "purchase_order_lines"];

async function as(user: string | null, role = "authenticated") {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [user ?? ""]);
  await db.exec(`set role ${role}`);
}

function fixture(org: string, creator: string, offset: number) {
  const ids = Array.from({ length: 12 }, (_, index) => uid(offset + index));
  return `
    insert into public.suppliers(id,org_id,name,lead_time_days) values('${ids[0]}','${org}','Test supplier',3);
    insert into public.products(id,org_id,supplier_id,sku,name,purchase_cost) values('${ids[1]}','${org}','${ids[0]}','TEST-1','Test product',10);
    insert into public.inventory_snapshots(id,org_id,product_id,as_of_date,on_hand) values('${ids[2]}','${org}','${ids[1]}','2026-11-09',1);
    insert into public.sales_daily(id,org_id,product_id,sales_date,units_sold) values('${ids[3]}','${org}','${ids[1]}','2026-11-09',1);
    insert into public.import_jobs(id,org_id,created_by,storage_prefix,file_manifest) values('${ids[4]}','${org}','${creator}','${org}/${ids[4]}','[{"kind":"suppliers"}]');
    insert into public.forecast_runs(id,org_id,created_by,method,status,as_of_date,horizon_days) values('${ids[5]}','${org}','${creator}','seasonal_baseline','succeeded','2026-11-09',7);
    insert into public.forecast_product_results(id,org_id,run_id,product_id,estimated_daily_units,quality) values('${ids[6]}','${org}','${ids[5]}','${ids[1]}',1,'sufficient');
    insert into public.forecast_points(org_id,result_id,forecast_date,projected_units) values('${org}','${ids[6]}','2026-11-10',1);
    insert into public.replenishment_plans(id,org_id,created_by,forecast_run_id,status,budget) values('${ids[7]}','${org}','${creator}','${ids[5]}','draft',100);
    insert into public.plan_lines(id,org_id,plan_id,product_id,supplier_id,suggested_qty,approved_qty,purchase_cost_snapshot,pack_multiple_snapshot,on_hand_snapshot,estimated_daily_snapshot,lead_time_days_snapshot,risk_class) values('${ids[8]}','${org}','${ids[7]}','${ids[1]}','${ids[0]}',1,1,10,1,1,1,3,'at_risk');
    insert into public.purchase_orders(id,org_id,plan_id,supplier_id,order_number,total_cost,created_by) values('${ids[9]}','${org}','${ids[7]}','${ids[0]}','TEST-PO',10,'${creator}');
    insert into public.purchase_order_lines(org_id,purchase_order_id,product_id,sku_snapshot,product_name_snapshot,qty,purchase_cost_snapshot) values('${org}','${ids[9]}','${ids[1]}','TEST-1','Test product',1,10);
    insert into public.ai_usage_events(org_id,user_id,status) values('${org}','${creator}','accepted');
    insert into storage.objects(bucket_id,name) values('retail-imports','${org}/${ids[4]}/source.csv');
  `;
}

beforeAll(async () => {
  db = new PGlite();
  // Supabase-owned schemas/roles are a minimal test harness, not production DDL.
  // RLS itself is executed by the real PostgreSQL engine under non-bypass roles.
  await db.exec(`
    create role anon nologin; create role authenticated nologin;
    grant usage on schema public to anon,authenticated;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth to anon,authenticated; grant execute on function auth.uid() to anon,authenticated;
    create schema storage;
    create table storage.buckets(id text primary key,name text not null,public boolean not null,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets(id),name text not null);
    alter table storage.objects enable row level security;
    grant usage on schema storage to anon,authenticated;
    grant select on storage.objects to anon;
    grant select,insert,update,delete on storage.objects to authenticated;
  `);
  for (const filename of (await readdir("supabase/migrations")).filter((name) => name.endsWith(".sql")).sort()) {
    await db.exec(await readFile(`supabase/migrations/${filename}`, "utf8"));
  }
  for (const id of Object.values(users)) await db.query("insert into auth.users(id) values($1)", [id]);
  await as(users.a);
  orgA = (await db.query<{ id: string }>("select public.create_workspace('Test A','Dhaka',false) as id")).rows[0].id;
  await as(users.b);
  orgB = (await db.query<{ id: string }>("select public.create_workspace('Test B','Dhaka',false) as id")).rows[0].id;
  await db.exec("reset role");
  await db.query("insert into public.organization_members(org_id,user_id,role) values($1,$2,'viewer'),($1,$3,'operator')", [orgA, users.viewer, users.operator]);
  await db.exec(fixture(orgA, users.a, 100));
  await db.exec(fixture(orgB, users.b, 200));
  await db.query("insert into public.replenishment_plans(id,org_id,created_by,forecast_run_id,status,budget) values($1,$2,$3,$4,'building',100)", [uid(300), orgA, users.operator, uid(105)]);
  await db.query("insert into public.plan_lines(org_id,plan_id,product_id,supplier_id,suggested_qty,approved_qty,purchase_cost_snapshot,pack_multiple_snapshot,on_hand_snapshot,lead_time_days_snapshot,risk_class) values($1,$2,$3,$4,1,1,10,1,1,3,'unknown')", [orgA, uid(300), uid(101), uid(100)]);
}, 60000);

afterAll(async () => { await db?.close(); });

describe("PostgreSQL tenant isolation", () => {
  it("runs authenticated checks as a role that cannot bypass RLS", async () => {
    await as(users.a);
    const result = await db.query<{ current_user: string; rolsuper: boolean; rolbypassrls: boolean }>("select current_user,rolsuper,rolbypassrls from pg_roles where rolname=current_user");
    expect(result.rows[0]).toEqual({ current_user: "authenticated", rolsuper: false, rolbypassrls: false });
  });

  it.each(tenantTables)("allows A's records and rejects B's records in %s", async (table) => {
    await as(users.a);
    expect((await db.query(`select * from public.${table} where org_id=$1`, [orgA])).rows).toHaveLength(1);
    expect((await db.query(`select * from public.${table} where org_id=$1`, [orgB])).rows).toHaveLength(0);
    await as(users.b);
    expect((await db.query(`select * from public.${table} where org_id=$1`, [orgA])).rows).toHaveLength(0);
  });

  it("limits organization, membership and profile reads", async () => {
    await as(users.a);
    expect((await db.query("select * from public.organizations where id=$1", [orgB])).rows).toHaveLength(0);
    expect((await db.query("select * from public.organization_members where org_id=$1", [orgB])).rows).toHaveLength(0);
    expect((await db.query("select * from public.profiles where user_id=$1", [users.b])).rows).toHaveLength(0);
    expect((await db.query("select * from public.profiles where user_id=$1", [users.a])).rows).toHaveLength(1);
  });

  it.each(["organizations", "organization_members", "profiles", ...tenantTables, "ai_usage_events"])("denies anonymous reads of %s", async (table) => {
    await as(null, "anon");
    await expect(db.query(`select * from public.${table}`)).rejects.toMatchObject({ code: "42501" });
  });

  it("hides building plans/lines from other members until ready", async () => {
    await as(users.a);
    expect((await db.query("select * from public.replenishment_plans where id=$1", [uid(300)])).rows).toHaveLength(0);
    await as(users.operator);
    expect((await db.query("select * from public.replenishment_plans where id=$1", [uid(300)])).rows).toHaveLength(1);
    expect((await db.query("select * from public.plan_lines where plan_id=$1", [uid(300)])).rows).toHaveLength(1);
  });

  it("denies membership escalation and direct business writes", async () => {
    await as(users.a);
    await expect(db.query("insert into public.organization_members(org_id,user_id,role) values($1,$2,'owner')", [orgB, users.a])).rejects.toMatchObject({ code: "42501" });
    for (const table of tenantTables) {
      const privileges = await db.query<{ allowed: boolean }>("select has_table_privilege('authenticated',$1,'INSERT,UPDATE,DELETE') as allowed", [`public.${table}`]);
      expect(privileges.rows[0].allowed).toBe(false);
    }
    await expect(db.query("update public.purchase_orders set total_cost=0 where org_id=$1", [orgA])).rejects.toMatchObject({ code: "42501" });
    await expect(db.query("select * from public.ai_usage_events")).rejects.toMatchObject({ code: "42501" });
  });

  it("allows own display-name updates without exposing identity columns", async () => {
    await as(users.a);
    await db.query("update public.profiles set display_name='Owner A' where user_id=$1", [users.a]);
    expect((await db.query<{ display_name: string }>("select display_name from public.profiles")).rows[0].display_name).toBe("Owner A");
    await expect(db.query("update public.profiles set user_id=$1 where user_id=$2", [users.b, users.a])).rejects.toMatchObject({ code: "42501" });
  });

  it("allows only the owner to update workspace settings", async () => {
    for (const user of [users.b, users.viewer, users.operator]) {
      await as(user);
      await expect(db.query("select * from public.update_workspace_settings($1,'Changed','Dhaka')", [orgA])).rejects.toMatchObject({ code: "42501" });
    }
    await as(users.a);
    const result = await db.query<{ name: string }>("select * from public.update_workspace_settings($1,'Updated A','Dhaka')", [orgA]);
    expect(result.rows[0].name).toBe("Updated A");
  });

  it("checks composite tenant FKs even for privileged writes", async () => {
    await db.exec("reset role");
    await expect(db.query("insert into public.products(org_id,supplier_id,sku,name,purchase_cost) values($1,$2,'INVALID','Invalid',1)", [orgA, uid(200)])).rejects.toMatchObject({ code: "23503" });
  });

  it("enforces the pack snapshot and multiple constraints", async () => {
    await db.exec("reset role");
    await expect(db.query("update public.plan_lines set pack_multiple_snapshot=6 where id=$1", [uid(108)])).rejects.toMatchObject({ code: "23514" });
  });

  it("creates owner membership atomically and rejects unsupported sample setup", async () => {
    await as(users.a);
    await expect(db.query("select public.create_workspace('x','Dhaka',false)")).rejects.toMatchObject({ code: "22023" });
    await expect(db.query("select public.create_workspace('Sample','Dhaka',true)")).rejects.toMatchObject({ code: "0A000" });
    const result = await db.query<{ id: string }>("select public.create_workspace('Another A','Dhaka',false) as id");
    const membership = await db.query<{ role: string }>("select role from public.organization_members where org_id=$1 and user_id=$2", [result.rows[0].id, users.a]);
    expect(membership.rows[0].role).toBe("owner");
  });

  it("enforces the durable creation limit without orphan memberships", async () => {
    await as(users.a);
    for (let index = 0; index < 3; index++) await db.query("select public.create_workspace($1,'Dhaka',false)", [`Limited ${index}`]);
    await expect(db.query("select public.create_workspace('Excess','Dhaka',false)")).rejects.toMatchObject({ code: "P0001" });
    expect((await db.query("select * from public.organizations where name='Excess'")).rows).toHaveLength(0);
  });
});

describe("private import storage", () => {
  it("keeps the bucket private and raw files tenant scoped", async () => {
    await db.exec("reset role");
    expect((await db.query<{ public: boolean }>("select public from storage.buckets where id='retail-imports'")).rows[0].public).toBe(false);
    await as(users.a);
    expect((await db.query("select * from storage.objects where name like $1", [`${orgA}/%`])).rows).toHaveLength(1);
    expect((await db.query("select * from storage.objects where name like $1", [`${orgB}/%`])).rows).toHaveLength(0);
    await as(null, "anon");
    expect((await db.query("select * from storage.objects")).rows).toHaveLength(0);
  });

  it("rejects cross-tenant, orphaned-job and traversal paths", async () => {
    await as(users.a);
    for (const path of [`${orgB}/${uid(204)}/new.csv`, `${orgA}/${uid(204)}/new.csv`, `${orgA}/${uid(104)}/../new.csv`]) {
      await expect(db.query("insert into storage.objects(bucket_id,name) values('retail-imports',$1)", [path])).rejects.toMatchObject({ code: "42501" });
    }
    await db.query("insert into storage.objects(bucket_id,name) values('retail-imports',$1)", [`${orgA}/${uid(104)}/suppliers.csv`]);
    await as(users.viewer);
    await expect(db.query("insert into storage.objects(bucket_id,name) values('retail-imports',$1)", [`${orgA}/${uid(104)}/viewer.csv`])).rejects.toMatchObject({ code: "42501" });
  });
});
