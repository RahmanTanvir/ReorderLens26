import { workspaceUpdateSchema } from "@/lib/auth/contracts";
import { requireWorkspace } from "@/server/auth/context";
import { databaseFailure, endpoint, readJson } from "@/server/http";

export const GET = endpoint(async (request) => {
  const context = await requireWorkspace({ workspaceId: request.headers.get("X-Workspace-Id") });
  return { data: { workspace: context.workspace, permissions: { canEditSettings: context.workspace.role === "owner" } }, isSample: context.workspace.is_sample };
});

export const PATCH = endpoint(async (request) => {
  const context = await requireWorkspace({ workspaceId: request.headers.get("X-Workspace-Id"), roles: ["owner"], writable: true });
  const input = await readJson(request, workspaceUpdateSchema);
  const result = await context.client.rpc("update_workspace_settings", { p_org_id: context.workspace.id, p_name: input.name, p_location: input.location }).single();
  databaseFailure(result.error);
  return { data: { workspace: result.data }, isSample: context.workspace.is_sample };
}, true);
