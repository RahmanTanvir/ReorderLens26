import { requireWorkspace } from "@/server/auth/context";
import { endpoint,readJson } from "@/server/http";
import { scenarioInputSchema } from "@/lib/planning/contracts";
import { compareScenario,planningQuery } from "@/server/services/planning";
export const POST=endpoint(async request=>{const context=await requireWorkspace({workspaceId:request.headers.get("X-Workspace-Id")}),{nextCursor,...data}=await compareScenario(context,await readJson(request,scenarioInputSchema),planningQuery(request.nextUrl.searchParams));return {data:{...data,pageInfo:{nextCursor}},isSample:context.workspace.is_sample};},true);
