import { notFound } from "next/navigation";
import { OrderDocument } from "@/components/orders/order-document";
import { AppError } from "@/lib/auth/errors";
import { requirePageWorkspace } from "@/server/auth/context";
import { readOrder } from "@/server/services/orders";
export const metadata={title:"Purchase Order Draft — ReorderLens"};
export default async function OrderPage({params}:PageProps<"/app/purchase-orders/[id]">){
  const context=await requirePageWorkspace();let data;
  try{data=await readOrder(context,(await params).id);}catch(error){if(error instanceof AppError&&error.status===404)notFound();throw error;}
  return <OrderDocument data={data}/>;
}
