import Link from "next/link";
import { Store } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { buttonVariants } from "@/components/ui/button";
import { requirePageWorkspace } from "@/server/auth/context";

export const metadata = { title: "Workspace — ReorderLens" };
export default async function WorkspaceOverviewPage() {
  const { workspace } = await requirePageWorkspace();
  return <div className="space-y-8"><PageHeader title="Overview" description={`Welcome to ${workspace.name}. Your workspace access is connected.`} /><section className="rounded-xl border bg-card"><EmptyState icon={<Store />} title={workspace.is_sample?"Your sample records are ready":"Your workspace is ready"} description={workspace.is_sample?"Explore the saved fictional catalog and stock snapshots. Forecasting, risk analysis and purchasing workflows arrive in their later phases.":"Import your suppliers, products, stock snapshots and daily sales. Review each file and confirm the import before records are saved."} action={<Link href="/app/data" className={buttonVariants({ variant: "outline" })}>{workspace.is_sample?"View sample records":"Import or review data"}</Link>} /></section><p className="text-xs text-muted-foreground">{workspace.location} · BDT · Asia/Dhaka{workspace.is_sample ? " · Sample workspace · Illustrative data" : ""}</p></div>;
}
