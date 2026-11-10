import { Info, PackageOpen, Search, ShoppingCart, Upload } from "lucide-react";

import { ComponentPreview } from "@/components/preview/component-preview";
import { EmptyState } from "@/components/shared/empty-state";
import { MetricStrip } from "@/components/shared/metric-strip";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const unavailable = "Connect a workspace and import records before using inventory actions";

export function InventoryPreview() {
  return (
    <div className="space-y-6">
      <PageHeader title="Inventory" description="Monitor stock levels, coverage, and inventory risks across your products." actions={<>
        <Button variant="outline" disabled title={unavailable} aria-describedby="preview-note"><Upload aria-hidden="true" />Import Data</Button>
        <Button disabled title={unavailable} aria-describedby="preview-note"><ShoppingCart aria-hidden="true" />Open Replenishment Planner</Button>
      </>} />

      <section aria-label="Visual preview notice" className="flex flex-col justify-between gap-4 rounded-lg border border-primary/20 bg-primary/[0.035] px-4 py-3 sm:flex-row sm:items-center">
        <div className="flex items-start gap-3"><Info aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" /><div><p className="text-sm font-semibold text-primary">Visual preview</p><p id="preview-note" className="mt-1 text-xs leading-5 text-secondary-foreground">No workspace is connected. Data actions and Insight are unavailable.</p></div></div>
        <div className="shrink-0"><ComponentPreview /></div>
      </section>

      <MetricStrip items={[{ label: "Total products", value: null }, { label: "At risk", value: null }, { label: "Reorder attention", value: null }, { label: "Healthy stock", value: null }]} />

      <div role="group" className="grid grid-cols-1 items-center gap-3 md:grid-cols-[minmax(200px,1fr)_170px_160px] xl:grid-cols-[minmax(200px,1fr)_170px_160px_220px]" aria-label="Inventory filters">
        <div className="relative"><Search aria-hidden="true" className="absolute top-1/2 left-3 size-[18px] -translate-y-1/2 text-muted-foreground" /><Input aria-label="Search inventory" aria-describedby="preview-note" disabled placeholder="Search by product name or SKU…" className="pl-10" /></div>
        <Select aria-label="Filter by supplier" aria-describedby="preview-note" disabled><option>All suppliers</option></Select>
        <Select aria-label="Filter by status" aria-describedby="preview-note" disabled><option>All statuses</option></Select>
        <div className="md:col-span-3 xl:col-span-1"><Select aria-label="Sort inventory" aria-describedby="preview-note" disabled><option>Sort: Days of cover (asc)</option></Select></div>
      </div>

      <section aria-label="Inventory records" className="overflow-hidden rounded-lg border bg-card">
        <Table scrollLabel="Inventory table; scroll horizontally to see all columns" className="min-w-[900px]">
          <caption className="sr-only">Inventory preview. No workspace or product records are connected.</caption>
          <TableHeader><TableRow>
            <TableHead className="w-[25%]">PRODUCT (SKU)</TableHead><TableHead className="w-[19%]">SUPPLIER</TableHead><TableHead className="text-right">ON HAND</TableHead><TableHead className="text-right">DAILY DEMAND</TableHead><TableHead className="text-right">STOCK COVER</TableHead><TableHead className="text-right">LEAD TIME</TableHead><TableHead>STATUS</TableHead>
          </TableRow></TableHeader>
          <TableBody />
        </Table>
        <EmptyState icon={<PackageOpen />} title="Your inventory starts here" description="Once you connect a workspace and import your records, products, stock coverage, and risks will appear here." />
      </section>
      <footer className="flex flex-wrap justify-between gap-3 text-xs text-muted-foreground"><p>No inventory loaded <span aria-hidden="true" className="mx-2">·</span> Visual preview only</p><p>BDT <span aria-hidden="true" className="mx-1">·</span> Asia/Dhaka</p></footer>
    </div>
  );
}
