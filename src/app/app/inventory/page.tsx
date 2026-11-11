import Link from "next/link";
import { InventoryWorkspace } from "@/components/inventory/inventory-workspace";
import { Alert } from "@/components/ui/alert";
import { PageHeader } from "@/components/shared/page-header";
import { AppError } from "@/lib/auth/errors";
import { requirePageWorkspace } from "@/server/auth/context";
import { inventoryQuery,readInventory } from "@/server/services/inventory";
import type { InventoryList,InventoryQuery } from "@/lib/inventory/contracts";

export const metadata={title:"Inventory — ReorderLens"};
export default async function InventoryPage({searchParams}:PageProps<"/app/inventory">) {
  const context=await requirePageWorkspace();
  let model:{query:InventoryQuery;data:InventoryList}|null=null;let message="Inventory could not be loaded.";
  try {const query=inventoryQuery(await searchParams);model={query,data:await readInventory(context,query)};}
  catch(error){if(error instanceof AppError&&[400,409].includes(error.status))message=error.message;else throw error;}
  if(!model)return <div className="space-y-5"><PageHeader title="Inventory" description="Review the current query before continuing."/><Alert tone="error">{message}</Alert><Link href="/app/inventory" className="inline-flex min-h-11 items-center rounded-sm text-primary underline">Reset filters and start again</Link></div>;
  return <InventoryWorkspace query={model.query} data={model.data}/>;
}
