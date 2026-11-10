import { commitImportSchema } from "@/lib/imports/contracts";
import { commitImport, importContext, readJob } from "@/server/services/imports";
import { endpoint, readJson } from "@/server/http";
import type { NextRequest } from "next/server";

export async function POST(request:NextRequest,context:RouteContext<"/api/imports/[id]/commit">) {
  const {id}=await context.params;
  return endpoint(async request=>{
    const auth=await importContext(request,true);
    const input=await readJson(request,commitImportSchema);
    return {data:await commitImport(auth,await readJob(auth,id,true),input.confirmUpserts,input.validationToken)};
  },true)(request);
}
