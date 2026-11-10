import { validateImportSchema } from "@/lib/imports/contracts";
import { importContext, readJob, validateImport } from "@/server/services/imports";
import { endpoint, readJson } from "@/server/http";
import type { NextRequest } from "next/server";

export async function POST(request:NextRequest,context:RouteContext<"/api/imports/[id]/validate">) {
  const {id}=await context.params;
  return endpoint(async request=>{
    const auth=await importContext(request,true);
    const input=await readJson(request,validateImportSchema,32768);
    return {data:await validateImport(auth,await readJob(auth,id,true),input.columnMappings)};
  },true)(request);
}
