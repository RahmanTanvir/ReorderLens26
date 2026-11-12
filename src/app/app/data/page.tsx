import Link from "next/link";
import { ImportWizard } from "@/components/imports/import-wizard";
import { PageHeader } from "@/components/shared/page-header";
import { Alert } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { Table,TableBody,TableCell,TableHead,TableHeader,TableRow } from "@/components/ui/table";
import { requirePageWorkspace } from "@/server/auth/context";
import { jobView,readJob } from "@/server/services/imports";
import { databaseFailure } from "@/server/http";

export const metadata={title:"Import data — ReorderLens"};
export default async function DataPage({searchParams}:{searchParams:Promise<{jobId?:string}>}) {
  const context=await requirePageWorkspace();
  if(context.workspace.is_sample) {
    const [products,snapshots]=await Promise.all([
      context.client.from("products").select("id,sku,name,purchase_cost").eq("org_id",context.workspace.id).order("sku"),
      context.client.from("inventory_snapshots").select("product_id,as_of_date,on_hand").eq("org_id",context.workspace.id).order("as_of_date",{ascending:false}),
    ]);databaseFailure(products.error);databaseFailure(snapshots.error);
    return <div className="space-y-6"><PageHeader title="Sample data" description="Documented fictional Northgate Market records, stored in this isolated sample workspace."/><Alert>Business CSV uploads are blocked here. Create a separate real workspace for your own records.</Alert><section className="rounded-xl border bg-card"><Table scrollLabel="Saved sample catalog"><TableHeader><TableRow><TableHead>SKU</TableHead><TableHead>Product</TableHead><TableHead className="text-right">Purchase cost (BDT)</TableHead><TableHead className="text-right">On hand</TableHead><TableHead>Snapshot date</TableHead></TableRow></TableHeader><TableBody>{(products.data??[]).map(product=>{const stock=snapshots.data?.find(row=>row.product_id===product.id);return <TableRow key={product.id}><TableCell>{product.sku}</TableCell><TableCell className="min-w-48">{product.name}</TableCell><TableCell className="text-right tabular-nums">{Number(product.purchase_cost).toFixed(2)}</TableCell><TableCell className="text-right tabular-nums">{stock?.on_hand??"Unavailable"}</TableCell><TableCell>{stock?.as_of_date??"Unavailable"}</TableCell></TableRow>;})}</TableBody></Table></section><p className="text-xs leading-6 text-muted-foreground">Sales history is limited to documented illustrative records. Inventory uses labeled sample rates and plans start from predefined quantities. Purchase-order drafts are saved only after explicit review; they are never sent automatically.</p><Link href="/app/inventory" className={buttonVariants({variant:"outline"})}>Review sample inventory</Link><Link href="/setup?new=1" className="ml-4 inline-flex min-h-11 items-center rounded-sm text-sm text-primary underline">Create a real workspace</Link></div>;
  }
  const {jobId}=await searchParams;
  const job=jobId?await readJob(context,jobId):null;
  const history=await context.client.from("import_jobs").select("id,status,created_at").eq("org_id",context.workspace.id).order("created_at",{ascending:false}).limit(10);databaseFailure(history.error);
  const canUpload=["owner","operator"].includes(context.workspace.role);
  return <div className="space-y-7"><PageHeader title="Import data" description="Upload records, review mappings, and resolve issues before using inventory intelligence."/>
    <ImportWizard key={job?.id??"new"} initialJob={job?jobView(job):null} canUpload={canUpload} canManageJob={canUpload&&job?.created_by===context.user.id}/>
    {history.data?.length?<section className="rounded-xl border bg-card p-5 sm:p-6"><h2 className="text-sm font-semibold">Recent imports</h2><p className="mt-2 text-xs text-muted-foreground">Open a saved job to review its report or resume your mapping and validation.</p><ul className="mt-4 divide-y">{history.data.map(item=><li key={item.id}><a href={`/app/data?jobId=${item.id}`} className="flex min-h-12 flex-wrap items-center justify-between gap-2 rounded-md py-3 text-sm hover:text-primary"><span>{new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Dhaka",dateStyle:"medium",timeStyle:"short"}).format(new Date(item.created_at))} · Asia/Dhaka</span><span className="text-xs capitalize">{item.status}</span><span className="sr-only">Import {item.id}</span></a></li>)}</ul></section>:null}
  </div>;
}
