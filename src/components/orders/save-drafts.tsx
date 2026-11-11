"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { Button,buttonVariants } from "@/components/ui/button";
import { requestJson } from "@/lib/client/request";
import { useMutation } from "@/lib/client/use-mutation";
import { conversionSchema } from "@/lib/orders/contracts";

export function SaveDrafts({planId,revision,count,enabled}:{planId:string;revision:number;count:number;enabled:boolean}){
  const mutation=useMutation(),router=useRouter(),[ids,setIds]=useState<string[]|null>(null);
  async function save(){const result=await mutation.run(()=>requestJson(`/api/plans/${planId}/convert`,"POST",{expectedRevision:revision},conversionSchema));if(result.ok)setIds(result.data.purchaseOrderIds);}
  if(ids)return <div className="space-y-3"><Alert tone="success">Drafts saved. No orders have been sent.</Alert><Link href={`/app/purchase-orders?planId=${planId}`} className={buttonVariants({className:"w-full"})}>View saved drafts</Link>{ids.map((id,index)=><Link key={id} href={`/app/purchase-orders/${id}`} className="block rounded-sm py-2 text-xs text-primary underline">Open draft {index+1}</Link>)}</div>;
  return <div className="space-y-3">{mutation.error?<><Alert tone="error">{mutation.error.message}</Alert><Button type="button" variant="outline" onClick={()=>router.refresh()}>Reload review</Button></>:null}<Button type="button" className="w-full" disabled={!enabled||mutation.busy} onClick={()=>void save()}>{mutation.busy?"Saving drafts…":`Save ${count} draft ${count===1?"order":"orders"}`}</Button><p className="text-center text-xs leading-5 text-muted-foreground">Saving drafts does not send orders to suppliers.</p></div>;
}
