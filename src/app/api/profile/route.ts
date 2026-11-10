import { profileUpdateSchema } from "@/lib/auth/contracts";
import { requireUser } from "@/server/auth/context";
import { databaseFailure, endpoint, readJson } from "@/server/http";

export const PATCH = endpoint(async (request) => {
  const context = await requireUser(true);
  const input = await readJson(request, profileUpdateSchema);
  const result = await context.client.from("profiles").update({ display_name: input.displayName }).eq("user_id", context.user.id).select("*").single();
  databaseFailure(result.error);
  return { data: { profile: result.data } };
}, true);
