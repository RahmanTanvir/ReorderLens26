import { notFound } from "next/navigation";
import { ProductDetails } from "@/components/inventory/product-detail";
import { AppError } from "@/lib/auth/errors";
import { requirePageWorkspace } from "@/server/auth/context";
import { readProduct } from "@/server/services/inventory";
import type { ProductDetail } from "@/lib/inventory/contracts";
export const metadata={title:"Product details — ReorderLens"};
export default async function ProductPage({params,searchParams}:PageProps<"/app/inventory/[id]">) {
  const context=await requirePageWorkspace();const {id}=await params;const search=await searchParams;
  let data:ProductDetail;
  try{data=await readProduct(context,id);}
  catch(error){if(error instanceof AppError&&error.status===404)notFound();throw error;}
  return <ProductDetails data={data} back={typeof search.back==="string"?search.back:undefined}/>;
}
