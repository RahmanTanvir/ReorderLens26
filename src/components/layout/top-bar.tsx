import type { ReactNode } from "react";
import { Info, Sparkles } from "lucide-react";

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
      <span id="assistant-note" className="sr-only">Read-only explanations are not available yet.</span>
      <Button variant="outline" disabled aria-label="Ask ReorderLens (unavailable)" aria-describedby="assistant-note" title="Read-only explanations are not connected yet" className="size-11 px-0 text-primary sm:w-auto sm:px-3 md:h-10">
        <Sparkles aria-hidden="true" /><span className="hidden sm:inline">Ask ReorderLens</span>
      </Button>
    </header>
  );
}
