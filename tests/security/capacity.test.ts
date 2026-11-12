import { PGlite } from "@electric-sql/pglite";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { expect, it } from "vitest";
import { parseCsv, validateFiles } from "@/domain/imports/validation";
import { fields, fileKinds, MAX_FILE_BYTES, MAX_IMPORT_ROWS, type ColumnMappings, type ParsedFile } from "@/lib/imports/contracts";
import { generationSchema } from "@/lib/forecast/contracts";
import { planContextSchema } from "@/lib/planning/contracts";
import { conversionSchema } from "@/lib/orders/contracts";

// Opt-in measurement, not a hosted throughput or forecast-accuracy claim.
it.skipIf(process.env.REORDERLENS_CAPACITY !== "1")("measures the import row boundary and a 500-product SQL workflow", async () => {
  const db = new PGlite();
  const timings: Record<string, number[]> = {};
  async function timed<T>(label: string, action: () => Promise<T>) {
    const start = performance.now(); const result = await action();
    (timings[label] ??= []).push(Number((performance.now() - start).toFixed(2))); return result;
  }
  const scalar = async <T = unknown>(sql: string, args: unknown[] = []) => (await db.query<{ value: T }>(sql, args)).rows[0].value;
  try {
    await db.exec(await readFile("tests/security/platform.sql", "utf8"));
    for (const file of (await readdir("supabase/migrations")).filter(f => f.endsWith(".sql")).sort())
      await db.exec(await readFile(`supabase/migrations/${file}`, "utf8"));
    const asOf = await scalar<string>("select (now() at time zone 'Asia/Dhaka')::date::text as value");
    const dateBefore = (days: number) => new Date(Date.parse(asOf + "T00:00:00Z") - days * 86400000).toISOString().slice(0, 10);
    const sku = (index: number) => `CAP-${index}`;
    const csv = (kind: typeof fileKinds[number], rows: (string | number)[][]) => new TextEncoder().encode([fields[kind].join(","), ...rows.map(row => row.join(","))].join("\n"));
    const files = {
      suppliers: csv("suppliers", [["FICTIONAL CAPACITY SUPPLIER", 6]]),
      products: csv("products", Array.from({ length: 100 }, (_, i) => [sku(i), `Fictional product ${i}`, "FICTIONAL CAPACITY SUPPLIER", "10.00", "", 1])),
      inventory_snapshots: csv("inventory_snapshots", Array.from({ length: 100 }, (_, i) => [sku(i), asOf, 5])),
      sales_daily: csv("sales_daily", Array.from({ length: MAX_IMPORT_ROWS - 201 }, (_, i) => [sku(i % 100), dateBefore(Math.floor(i / 100)), 5, "available", "false"])),
    };
    const mappings = Object.fromEntries(fileKinds.map(kind => [kind, Object.fromEntries(fields[kind].map(field => [field, field]))])) as ColumnMappings;
    for (let repeat = 0; repeat < 3; repeat++) {
      const parsed = await timed("csv_parse_5000_rows", async () => Object.fromEntries(fileKinds.map(kind => [kind, parseCsv(files[kind])])) as Record<typeof fileKinds[number], ParsedFile>);
      const validated = await timed("csv_validate_5000_rows", async () => validateFiles(parsed, mappings, { suppliers: [], skus: [] }, asOf));
      expect(validated.report).toMatchObject({ valid: true, rowCount: MAX_IMPORT_ROWS });
      expect(fileKinds.every(kind => files[kind].length <= MAX_FILE_BYTES)).toBe(true);
    }
    // Privileged fixture setup is confined to this fresh local emulator. The
    // 14,000 sales would require multiple real imports under the 5,000-row limit.
    const owner = randomUUID(); await db.query("insert into auth.users(id) values($1)", [owner]);
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [owner]); await db.exec("set role authenticated");
    const org = await scalar<string>("select public.create_workspace('FICTIONAL LOCAL CAPACITY TEST','Dhaka',false) as value");
    await db.exec("reset role");
    const supplier = await scalar<string>("insert into public.suppliers(org_id,name,lead_time_days) values($1,'Fictional capacity supplier',6) returning id as value", [org]);
    await db.query("insert into public.products(org_id,supplier_id,sku,name,purchase_cost) select $1,$2,'CAP-'||g,'Fictional capacity product '||g,10 from generate_series(1,500) g", [org, supplier]);
    await db.query("insert into public.inventory_snapshots(org_id,product_id,as_of_date,on_hand) select org_id,id,$2::date,5 from public.products where org_id=$1", [org, asOf]);
    await db.query("insert into public.sales_daily(org_id,product_id,sales_date,units_sold,availability_status) select p.org_id,p.id,$2::date-g,5,'available' from public.products p cross join generate_series(0,27) g where p.org_id=$1", [org, asOf]);
    await db.exec("set role authenticated");
    const run = generationSchema.parse(await timed("forecast_500_products_28_days", () => scalar("select public.generate_forecast($1,$2,28) as value", [org, asOf])));
    expect(run.status).toBe("succeeded");
    expect(await scalar("select count(*)::integer as value from public.forecast_points where org_id=$1", [org])).toBe(14000);
    for (let repeat = 0; repeat < 3; repeat++) {
      const reused = generationSchema.parse(await timed("forecast_identical_input_reuse", () => scalar("select public.generate_forecast($1,$2,28) as value", [org, asOf])));
      expect(reused.runId).toBe(run.runId); expect(reused.reused).toBe(true);
      await timed("inventory_first_page_500_products", () => scalar("select public.read_inventory($1) as value", [org]));
    }
    const plan = randomUUID();
    await timed("plan_create_500_products", () => db.query("select public.create_replenishment_plan($1,$2,$3,1000000,7,2)", [org, plan, run.runId]));
    const detail = planContextSchema.parse(await timed("plan_read_500_lines", () => scalar("select public.read_plan_context($1,$2) as value", [org, plan])));
    expect(detail.items).toHaveLength(500); expect(detail.plan.summary.approvedTotal).toBe("350000.00");
    const converted = conversionSchema.parse(await timed("draft_convert_500_lines", () => scalar("select public.convert_plan_to_drafts($1,$2,0) as value", [org, plan])));
    expect(converted.purchaseOrderIds).toHaveLength(1);
    const replay = conversionSchema.parse(await timed("draft_conversion_replay", () => scalar("select public.convert_plan_to_drafts($1,$2,0) as value", [org, plan])));
    expect(replay.purchaseOrderIds).toEqual(converted.purchaseOrderIds);
    const result = {
      completed: true, dataset: { csvCombinedRows: 5000, products: 500, salesRows: 14000, forecastPoints: 14000, planLines: 500 },
      timingsMs: timings,
      scope: "Fresh local PGlite with real migrations/Auth-Storage facade; SQL fixture seeding. No HTTP/upload/hosting/concurrent-load/SLO/accuracy proof.",
    };
    await mkdir("artifacts", { recursive: true }); await writeFile("artifacts/production-capacity.json", JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result, null, 2));
  } finally { await db.close(); }
}, 120000);
