"use client";

import { useId } from "react";
import Link from "next/link";
import { ChartNoAxesCombined, FileText, House, Layers, Settings, ShoppingCart, SlidersHorizontal, Upload, UserRound } from "lucide-react";

import { Brand } from "@/components/shared/brand";
import { isNavigationActive, navigationItems, type NavigationId } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import type { AccountSummary } from "@/lib/auth/contracts";
import { SignOutButton } from "@/components/auth/sign-out-button";

const icons = { overview: House, inventory: Layers, forecasts: ChartNoAxesCombined, replenishment: ShoppingCart, scenarios: SlidersHorizontal, orders: FileText, data: Upload, settings: Settings };

export function SidebarNav({ activePath, availablePaths = [], previewHref, onNavigate, account }: { activePath: string; availablePaths?: readonly string[]; previewHref?: string; onNavigate?: () => void; account?: AccountSummary }) {
  const availabilityId = useId();

  function item(id: NavigationId) {
    const entry = navigationItems.find((entry) => entry.id === id)!;
    const Icon = icons[id];
    const active = isNavigationActive(activePath, entry.href);
    const href = active && previewHref ? previewHref : availablePaths.includes(entry.href) ? entry.href : null;
    const content = <><Icon aria-hidden="true" className="size-[19px] shrink-0" /><span>{entry.label}</span></>;
    const className = cn("flex min-h-11 items-center gap-3 rounded-md border-l-2 px-3 text-sm font-medium", active ? "border-primary bg-primary/10 text-primary" : "border-transparent text-secondary-foreground", href ? "transition-colors hover:bg-accent hover:text-foreground" : "cursor-not-allowed text-muted-foreground/75");

    return href ? (
      <Link key={id} href={href} className={className} aria-current={active ? "page" : undefined} onClick={onNavigate}>{content}</Link>
    ) : (
      <span key={id} role="link" aria-disabled="true" aria-describedby={availabilityId} title="Available when this workflow is connected" className={className}>{content}</span>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-[var(--shell-topbar-height)] shrink-0 items-center border-b px-3">
        <Link href={previewHref ?? "/app/overview"} onClick={onNavigate} aria-label={account ? "ReorderLens overview" : "ReorderLens visual preview"} className="rounded-md"><Brand /></Link>
      </div>
      <nav aria-label="Main navigation" className="flex-1 overflow-y-auto px-3 pt-6">
        <div className="space-y-1">{navigationItems.filter((entry) => entry.group === "main").map((entry) => item(entry.id))}</div>
        <div className="mt-6 border-t pt-5">
          <p className="mb-3 px-3 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Data &amp; setup</p>
          {item("data")}
        </div>
        {navigationItems.some(entry=>!availablePaths.includes(entry.href))?<p id={availabilityId} className="mt-7 px-3 text-xs leading-5 text-muted-foreground">Other sections become available as their workflows are connected.</p>:null}
      </nav>
      <div className="shrink-0 space-y-4 px-3 py-5">
        {item("settings")}
        <div className="flex items-center gap-3 border-t px-3 pt-5">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full border bg-card text-muted-foreground"><UserRound aria-hidden="true" className="size-4" /></span>
          <div className="min-w-0"><p className="truncate text-xs font-medium" title={account?.displayName}>{account?.displayName ?? "Preview access"}</p><p className="mt-1 text-[11px] text-muted-foreground capitalize">{account?.role ?? "No account connected"}</p></div>
        </div>
        {account ? <SignOutButton /> : null}
      </div>
    </div>
  );
}
