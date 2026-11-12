import { z } from "@/lib/validation/zod";
import type { NextRequest } from "next/server";
import { AppError } from "@/lib/auth/errors";
import { fileKinds } from "@/lib/imports/contracts";
import { importContext,readJob,uploadImportFile } from "@/server/services/imports";
import { endpoint } from "@/server/http";

export const runtime="nodejs";
export async function POST(request:NextRequest,route:RouteContext<"/api/imports/[id]/files/[kind]">) {
  const {id,kind}=await route.params;
  return endpoint(async request=>{
    const context=await importContext(request,true);
    const parsed=z.enum(fileKinds).safeParse(kind);
    if(!parsed.success)throw new AppError(404,"NOT_FOUND","This file kind is not supported.");
    const job=await readJob(context,id,true);
    return {data:await uploadImportFile(request,context,job,parsed.data)};
  },true)(request);
}
