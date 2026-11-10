import "server-only";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { type MembershipWorkspace, roleSchema, type WorkspaceRole } from "@/lib/auth/contracts";
import { AppError } from "@/lib/auth/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { databaseFailure } from "@/server/http";

export async function requireUser(writable = false) {
  const client = await createSupabaseServerClient(writable);
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) throw new AppError(401, "AUTH_REQUIRED", "Sign in to continue.");
  return { client, user: data.user };
}

export async function listMembershipWorkspaces(context: Awaited<ReturnType<typeof requireUser>>) {
  const memberships = await context.client.from("organization_members").select("org_id,role").eq("user_id", context.user.id);
  databaseFailure(memberships.error);
  if (!memberships.data?.length) return [];
  const organizations = await context.client.from("organizations").select("*").in("id", memberships.data.map((item) => item.org_id));
  databaseFailure(organizations.error);
  return (organizations.data ?? []).map((workspace): MembershipWorkspace => ({ ...workspace, role: roleSchema.parse(memberships.data!.find((member) => member.org_id === workspace.id)!.role) }));
}

export async function requireWorkspace(options: { workspaceId?: string | null; roles?: readonly WorkspaceRole[]; writable?: boolean } = {}) {
  const context = await requireUser(options.writable);
  const workspaces = await listMembershipWorkspaces(context);
  const selected = options.workspaceId ?? (await cookies()).get("rl-workspace")?.value;
  if (selected && !z.uuid().safeParse(selected).success) throw new AppError(400, "INVALID_WORKSPACE", "Select a valid workspace.");
  if (!selected && workspaces.length !== 1) throw new AppError(409, "WORKSPACE_REQUIRED", "Choose a workspace to continue.");
  const workspace = selected ? workspaces.find((item) => item.id === selected) : workspaces[0];
  if (!workspace) throw new AppError(403, "WORKSPACE_DENIED", "This workspace is not available to your account.");
  if (options.roles && !options.roles.includes(workspace.role)) throw new AppError(403, "FORBIDDEN", "You do not have permission for this action.");
  return { ...context, workspace, workspaces };
}

export async function requirePageUser() {
  try { return await requireUser(); }
  catch (error) {
    if (error instanceof AppError && [401, 503].includes(error.status)) redirect("/login");
    throw error;
  }
}

export async function requirePageWorkspace() {
  try { return await requireWorkspace({ workspaceId: (await headers()).get("X-Workspace-Id") }); }
  catch (error) {
    if (error instanceof AppError && error.status === 401) redirect("/login");
    if (error instanceof AppError && [400, 403, 409].includes(error.status)) redirect("/setup?select=1");
    if (error instanceof AppError && error.status === 503) redirect("/login?notice=unavailable");
    throw error;
  }
}

export async function readOwnProfile(context: Awaited<ReturnType<typeof requireUser>>) {
  const result = await context.client.from("profiles").select("*").eq("user_id", context.user.id).maybeSingle();
  databaseFailure(result.error);
  return result.data;
}
