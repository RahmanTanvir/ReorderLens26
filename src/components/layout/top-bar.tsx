import type { ReactNode } from "react";
import { Info } from "lucide-react";
import { InsightTrigger } from "@/components/insight/insight-provider";

import { WorkspaceSwitcher } from "@/components/layout/workspace-switcher";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { MembershipWorkspace } from "@/lib/auth/contracts";

export function TopBar({ menuTrigger, workspace, workspaces = [], dataFreshness }: { menuTrigger: ReactNode; workspace?: MembershipWorkspace; workspaces?: MembershipWorkspace[]; dataFreshness?: string }) {
  return (
    <header data-slot="top-bar" className="sticky top-0 z-20 flex h-[var(--shell-topbar-height)] items-center justify-between gap-3 border-b bg-background px-4 sm:px-[var(--shell-gutter)]">
      <div className="flex min-w-0 items-center gap-2 sm:gap-4">
        {menuTrigger}
        <WorkspaceSwitcher workspace={workspace} workspaces={workspaces} />
        <div className="hidden items-center gap-2 border-l pl-5 text-xs text-muted-foreground md:flex">
          <span aria-hidden="true" className="size-1.5 rounded-full bg-muted-foreground" />
          <span>{dataFreshness??"No data connected"}</span>
          <Tooltip>
            <TooltipTrigger asChild><Button variant="ghost" size="icon" aria-label="About data freshness" className="size-8 sm:size-8"><Info /></Button></TooltipTrigger>
            <TooltipContent>{dataFreshness?"This identifies the saved source records, not a live POS connection or forecast run.":"Data freshness will reflect confirmed imports and forecast runs. No records are connected yet."}</TooltipContent>
          </Tooltip>
        </div>
      </div>
      <InsightTrigger className="shrink-0 text-primary [&_span]:hidden sm:[&_span]:inline" />
    </header>
  );
}
