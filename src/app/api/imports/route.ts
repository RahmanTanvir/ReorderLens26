import { importContext, prepareImport } from "@/server/services/imports";
import { prepareImportSchema } from "@/lib/imports/contracts";
import { endpoint,readJson } from "@/server/http";

export const runtime="nodejs";
export const POST=endpoint(async request=>{
  const context=await importContext(request,true);
  const input=await readJson(request,prepareImportSchema,32768);
  return {data:await prepareImport(context,input.jobId,input.files),status:201};
},true);
