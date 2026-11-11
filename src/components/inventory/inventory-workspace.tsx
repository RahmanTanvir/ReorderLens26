import Link from "next/link";
import { PackageOpen,Search,ShoppingCart,Upload } from "lucide-react";
import { InventoryTable } from "@/components/inventory/inventory-table";
import { EmptyState } from "@/components/shared/empty-state";
import { MetricStrip } from "@/components/shared/metric-strip";
import { PageHeader } from "@/components/shared/page-header";
import { Alert } from "@/components/ui/alert";
import { Button,buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { inventoryHref,type InventoryList,type InventoryQuery } from "@/lib/inventory/contracts";

export function InventorySummary({data}:{data:InventoryList}) {return <div><MetricStrip items={[{label:"Total products",value:String(data.summary.total)},{label:"At risk",value:String(data.summary.at_risk)},{label:"Reorder attention",value:String(data.summary.reorder_soon)},{label:"Healthy stock",value:String(data.summary.healthy)}]}/><p className="mt-3 text-xs text-muted-foreground">Workspace totals · {data.summary.unknown} with insufficient data{data.summary.stale?` · ${data.summary.stale} with stale sources`:""}</p></div>;}
export function InventoryWarnings({data}:{data:InventoryList}) {
  return <>{data.summary.unknown>0?<Alert>{data.summary.unknown} product{data.summary.unknown===1?" needs":"s need"} a saved stock snapshot and sufficient demand evidence. Insufficient data is not zero demand. <Link href="/app/forecasts" className="rounded-sm text-primary underline">Open Forecasts</Link> to generate and inspect saved demand evidence.</Alert>:null}{data.summary.stale>0?<Alert>{data.summary.stale} product{data.summary.stale===1?" has":"s have"} stale inputs. Estimates remain visible with warnings; refresh the source data before purchasing decisions.</Alert>:null}</>;
}
export function InventoryWorkspace({data,query}:{data:InventoryList;query:InventoryQuery}) {
  const back=inventoryHref(query,query.cursor);
  return <div className="space-y-6"><PageHeader title="Inventory" description="Monitor stock levels, coverage, and inventory risks across your products." actions={<><Link href="/app/data" className={buttonVariants({variant:"outline"})}><Upload aria-hidden="true"/>Import Data</Link><Button disabled title="Replenishment planning becomes available in P6" aria-describedby="planner-unavailable"><ShoppingCart aria-hidden="true"/>Open Replenishment Planner</Button></>}/><p id="planner-unavailable" className="sr-only">Replenishment planning is not available yet.</p>
    <InventorySummary data={data}/><InventoryWarnings data={data}/>
    <form action="/app/inventory" method="get" aria-label="Inventory filters" className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(200px,1fr)_180px_170px_180px_auto]">
      <div className="relative"><Search aria-hidden="true" className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"/><Input name="q" aria-label="Search inventory" placeholder="Search product name or SKU…" defaultValue={query.q} maxLength={500} className="pl-10"/></div>
      <Select name="supplierId" aria-label="Filter by supplier" defaultValue={query.supplierId??""}><option value="">All suppliers</option>{data.suppliers.map(supplier=><option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</Select>
      <Select name="status" aria-label="Filter by status" defaultValue={query.status??""}><option value="">All statuses</option><option value="at_risk">At risk</option><option value="reorder_soon">Reorder soon</option><option value="healthy">Healthy</option><option value="unknown">Insufficient data</option></Select>
      <Select name="sort" aria-label="Sort inventory" defaultValue={query.sort}><option value="cover_asc">Cover: low to high</option><option value="cover_desc">Cover: high to low</option><option value="sku_asc">SKU: A–Z</option><option value="name_asc">Product: A–Z</option><option value="risk">Risk priority</option></Select><input type="hidden" name="limit" value={query.limit}/><Button type="submit">Apply filters</Button>
    </form>
    <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground"><p>{data.matchCount.toLocaleString()} matching products · {data.items.length} shown</p>{query.q||query.status||query.supplierId||query.cursor?<Link href="/app/inventory" className="rounded-sm py-2 text-primary hover:underline">Reset filters</Link>:null}</div>
    <section aria-label="Inventory records" className="overflow-hidden rounded-lg border bg-card">{data.items.length?<InventoryTable items={data.items} back={back}/>:<EmptyState icon={<PackageOpen/>} title={data.summary.total?"No matching products":"Your inventory starts here"} description={data.summary.total?"Change your search or filters to find other products.":"Import suppliers, products, stock snapshots and daily sales to see saved inventory here."} action={<Link href={data.summary.total?"/app/inventory":"/app/data"} className={buttonVariants({variant:"outline"})}>{data.summary.total?"Reset filters":"Open Import Data"}</Link>}/>}</section>
    <footer className="flex flex-wrap items-center justify-between gap-4 text-xs text-muted-foreground"><p>As of {data.asOf} · BDT · Asia/Dhaka · Review period: 7 days</p><div className="flex gap-3">{query.cursor?<Link href={inventoryHref(query)} className={buttonVariants({variant:"outline",size:"sm"})}>First page</Link>:null}{data.nextCursor?<Link href={inventoryHref(query,data.nextCursor)} className={buttonVariants({variant:"outline",size:"sm"})}>Next page</Link>:null}</div></footer>
  </div>;
}
