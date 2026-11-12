import Link from "next/link";
import { OrderReview } from "@/components/orders/order-review";
import { Alert } from "@/components/ui/alert";
import { AppError } from "@/lib/auth/errors";
import { requirePageWorkspace } from "@/server/auth/context";
import { readPlanContext } from "@/server/services/planning";
import { z } from "@/lib/validation/zod";
export const metadata={title:"Review Purchase Orders — ReorderLens"};
export default async function ReviewPage({searchParams}:PageProps<"/app/purchase-orders/review">){
  const context=await requirePageWorkspace();
  const model=await(async()=>{try{const query=z.object({planId:z.uuid()}).strict().safeParse(await searchParams);if(!query.success)throw new AppError(400,"PLAN_REQUIRED","Select a saved plan in Replenishment before reviewing supplier orders.");return {data:await readPlanContext(context,query.data.planId)};}catch(error){if(error instanceof AppError&&[400,404].includes(error.status))return {error:error.message};throw error;}})();
  if(model.error)return <div className="space-y-5"><h1 className="text-2xl font-bold">Review Purchase Orders</h1><Alert tone="error">{model.error}</Alert><Link href="/app/replenishment" className="inline-flex min-h-11 items-center text-primary underline">Open Replenishment Planner</Link></div>;
  return <OrderReview {...model.data!} canSave={["owner","operator"].includes(context.workspace.role)} isSample={context.workspace.is_sample}/>;
}
