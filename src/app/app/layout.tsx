import type { ReactNode } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { readOwnProfile, requirePageWorkspace } from "@/server/auth/context";
import { databaseFailure } from "@/server/http";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export default async function ProtectedLayout({ children }: { children: ReactNode }) {
  const context = await requirePageWorkspace();
  const profile = await readOwnProfile(context);
  const latest=await context.client.from("import_jobs").select("committed_at").eq("org_id",context.workspace.id).eq("status","committed").order("committed_at",{ascending:false}).limit(1);databaseFailure(latest.error);
  const timestamp=latest.data?.[0]?.committed_at;
  const dataFreshness=context.workspace.is_sample?"Sample source · 9 Nov 2026":timestamp?`Import confirmed ${new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Dhaka",dateStyle:"medium"}).format(new Date(timestamp))}`:undefined;
  return <AppShell dataFreshness={dataFreshness} workspace={context.workspace} workspaces={context.workspaces} account={{ displayName: profile?.display_name || "Your account", role: context.workspace.role }} availablePaths={["/app/overview", "/app/inventory", "/app/forecasts", "/app/settings", "/app/data"]}>{children}</AppShell>;
}
