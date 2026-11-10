"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Menu } from "lucide-react";
import { usePathname } from "next/navigation";

import { SidebarNav } from "@/components/layout/sidebar-nav";
import { TopBar } from "@/components/layout/top-bar";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { AccountSummary, MembershipWorkspace } from "@/lib/auth/contracts";

export function AppShell({ children, activePath, availablePaths = [], previewHref, workspace, workspaces = [], account, dataFreshness }: { children: ReactNode; activePath?: string; availablePaths?: readonly string[]; previewHref?: string; workspace?: MembershipWorkspace; workspaces?: MembershipWorkspace[]; account?: AccountSummary; dataFreshness?: string }) {
  const pathname = usePathname();
  const selectedPath = activePath ?? pathname ?? "/app/overview";
  const [navigationOpen, setNavigationOpen] = useState(false);

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1280px)");
    const closeOnDesktop = () => { if (desktop.matches) setNavigationOpen(false); };
    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
  }, []);

  return (
    <TooltipProvider delayDuration={300}>
      <a href="#main-content" className="skip-link">Skip to content</a>
      <aside data-slot="desktop-sidebar" className="fixed inset-y-0 left-0 z-30 hidden w-[var(--shell-sidebar-width)] border-r bg-sidebar xl:block">
        <SidebarNav activePath={selectedPath} availablePaths={availablePaths} previewHref={previewHref} account={account} />
      </aside>
      <div className="min-h-dvh xl:pl-[var(--shell-sidebar-width)]">
        <TopBar workspace={workspace} workspaces={workspaces} dataFreshness={dataFreshness} menuTrigger={
          <Sheet open={navigationOpen} onOpenChange={setNavigationOpen}>
            <SheetTrigger asChild><Button variant="ghost" size="icon" className="xl:hidden" aria-label="Open navigation"><Menu aria-hidden="true" /></Button></SheetTrigger>
            <SheetContent side="left" className="p-0">
              <SheetTitle className="sr-only">Main navigation</SheetTitle>
              <SheetDescription className="sr-only">Choose an available workspace section.</SheetDescription>
              <SidebarNav activePath={selectedPath} availablePaths={availablePaths} previewHref={previewHref} account={account} onNavigate={() => setNavigationOpen(false)} />
            </SheetContent>
          </Sheet>
        } />
        <main id="main-content" tabIndex={-1} className="min-w-0 px-4 py-6 outline-none sm:px-[var(--shell-gutter)] sm:py-8">{workspace?.is_sample?<p role="note" className="mb-6 rounded-lg border border-primary/40 bg-primary/5 px-4 py-3 text-sm text-primary">Sample workspace · Illustrative data</p>:null}{children}</main>
      </div>
    </TooltipProvider>
  );
}
