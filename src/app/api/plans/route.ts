import { requireWorkspace } from "@/server/auth/context";
import { endpoint,readJson } from "@/server/http";
import { createPlanSchema } from "@/lib/planning/contracts";
import { createPlan,listPlans,planningQuery } from "@/server/services/planning";
export const GET=endpoint(async request=>{
  const context=await requireWorkspace({workspaceId:request.headers.get("X-Workspace-Id")}),query=planningQuery(request.nextUrl.searchParams);
  const {items,nextCursor}=await listPlans(context,query.limit,query.plansCursor);return {data:{items,pageInfo:{nextCursor}},isSample:context.workspace.is_sample};
});
export const POST=endpoint(async request=>{
  const context=await requireWorkspace({workspaceId:request.headers.get("X-Workspace-Id"),roles:["owner","operator"]});const data=await createPlan(context,await readJson(request,createPlanSchema));return {data,isSample:context.workspace.is_sample,status:data.reused?200:201};
},true);
