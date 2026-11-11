import { OverviewWorkspace } from "@/components/inventory/overview-workspace";
import { requirePageWorkspace } from "@/server/auth/context";
import { readOverview } from "@/server/services/inventory";

export const metadata = { title: "Workspace — ReorderLens" };
export default async function WorkspaceOverviewPage() {
  const context = await requirePageWorkspace();
  return <OverviewWorkspace data={await readOverview(context)}/>;
}
