import { cookies } from "next/headers";

import { workspaceCreateSchema } from "@/lib/auth/contracts";
import { AppError } from "@/lib/auth/errors";
import { listMembershipWorkspaces, requireUser } from "@/server/auth/context";
import { getServerEnvironment } from "@/server/config/environment";
import { databaseFailure, endpoint, readJson } from "@/server/http";

export const GET = endpoint(async () => {
  const context = await requireUser();
  return { data: { items: await listMembershipWorkspaces(context) } };
});

export const POST = endpoint(async (request) => {
  const context = await requireUser(true);
  const input = await readJson(request, workspaceCreateSchema);
  const result = input.isSample
    ? await context.client.rpc("create_sample_workspace", {})
    : await context.client.rpc("create_workspace", { p_name: input.name, p_location: input.location, p_is_sample: false });
  databaseFailure(result.error);
  if (!result.data) throw new AppError(503, "WORKSPACE_UNAVAILABLE", "The workspace could not be created. Please try again.");
  (await cookies()).set("rl-workspace", result.data, { httpOnly: true, secure: new URL(getServerEnvironment().public.appUrl).protocol === "https:", sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
  return { data: { workspaceId: result.data, redirect: input.isSample ? "/app/overview" : "/app/data" }, isSample: input.isSample, status: 201 };
}, true);
