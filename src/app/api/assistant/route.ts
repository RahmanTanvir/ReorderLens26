import { assistantInputSchema } from "@/lib/assistant/contracts";
import { requireWorkspace } from "@/server/auth/context";
import { endpoint,readJson } from "@/server/http";
import { explain } from "@/server/services/assistant";
export const maxDuration=30;
export const POST=endpoint(async request=>{
  const context=await requireWorkspace({workspaceId:request.headers.get("X-Workspace-Id")});
  const input=await readJson(request,assistantInputSchema,16384);
  return {data:await explain(context,input,request.signal),isSample:context.workspace.is_sample};
},true);
