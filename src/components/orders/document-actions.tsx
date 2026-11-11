"use client";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { useMutation } from "@/lib/client/use-mutation";
import { RequestError } from "@/lib/client/request";
export function DocumentActions({orderId}:{orderId:string}){
  const mutation=useMutation();
  async function download(){await mutation.run(async()=>{
    const response=await fetch(`/api/purchase-orders/${orderId}/export?format=csv`,{credentials:"same-origin",cache:"no-store",signal:AbortSignal.timeout(30000)});
    if(!response.ok){let message="The export could not be downloaded. Try again.";try{const body=await response.json();if(typeof body?.error?.message==="string")message=body.error.message;}catch{/* Safe fallback for non-JSON failures. */}throw new RequestError(message,"EXPORT_FAILED");}
    if(!response.headers.get("Content-Type")?.startsWith("text/csv"))throw new RequestError("The export response was invalid. Try again.","EXPORT_FAILED");
    const blob=await response.blob();if(blob.size>2097152)throw new RequestError("This export exceeds the supported size.","EXPORT_FAILED");
    const url=URL.createObjectURL(blob),link=document.createElement("a");link.href=url;link.download=`ReorderLens-draft-${orderId}.csv`;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  });}
  return <div className="space-y-3" data-print-hide><div className="flex flex-wrap gap-3"><Button variant="outline" type="button" disabled={mutation.busy} onClick={()=>void download()}>{mutation.busy?"Exporting…":"Export CSV"}</Button><Button variant="outline" type="button" onClick={()=>window.print()}>Print / Save PDF</Button></div>{mutation.error?<Alert tone="error">{mutation.error.message}</Alert>:mutation.succeeded?<Alert tone="success">CSV downloaded. Draft remains saved.</Alert>:null}</div>;
}
