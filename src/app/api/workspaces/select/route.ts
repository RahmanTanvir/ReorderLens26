import { cookies } from "next/headers";

import { workspaceSelectionSchema } from "@/lib/auth/contracts";
import { requireWorkspace } from "@/server/auth/context";
import { getServerEnvironment } from "@/server/config/environment";
import { endpoint, readJson } from "@/server/http";

export const POST = endpoint(async (request) => {
  const input = await readJson(request, workspaceSelectionSchema);
  const context = await requireWorkspace({ workspaceId: input.workspaceId });
  (await cookies()).set("rl-workspace", context.workspace.id, { httpOnly: true, secure: new URL(getServerEnvironment().public.appUrl).protocol === "https:", sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
  return { data: { redirect: "/app/overview" }, isSample: context.workspace.is_sample };
}, true);
