import { importContext, jobView, readJob } from "@/server/services/imports";
import { endpoint } from "@/server/http";
import type { NextRequest } from "next/server";

export async function GET(request:NextRequest,context:RouteContext<"/api/imports/[id]">) {
  const {id}=await context.params;
  return endpoint(async request=>{
    const auth=await importContext(request);
    return {data:jobView(await readJob(auth,id)),isSample:auth.workspace.is_sample};
  })(request);
}
