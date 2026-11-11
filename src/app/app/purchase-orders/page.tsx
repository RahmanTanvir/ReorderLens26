import Link from "next/link";
import { OrderListView } from "@/components/orders/order-list";
import { Alert } from "@/components/ui/alert";
import { AppError } from "@/lib/auth/errors";
import { requirePageWorkspace } from "@/server/auth/context";
import { listOrders,orderQuery } from "@/server/services/orders";
export const metadata={title:"Purchase Orders — ReorderLens"};
export default async function PurchaseOrdersPage({searchParams}:PageProps<"/app/purchase-orders">){
  const context=await requirePageWorkspace();
  const model=await(async()=>{try{const query=orderQuery(await searchParams);return {query,data:await listOrders(context,query)};}catch(error){if(error instanceof AppError&&error.status===400)return {error:error.message};throw error;}})();
  if(model.error)return <div className="space-y-4"><h1 className="text-2xl font-bold">Purchase Orders</h1><Alert tone="error">{model.error}</Alert><Link href="/app/purchase-orders" className="inline-flex min-h-11 items-center text-primary underline">Reset filters</Link></div>;
  return <OrderListView data={model.data!} query={model.query!} isSample={context.workspace.is_sample}/>;
}
