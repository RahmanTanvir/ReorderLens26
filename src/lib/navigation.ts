export const navigationItems = [
  { id: "overview", label: "Overview", href: "/app/overview", group: "main" },
  { id: "inventory", label: "Inventory", href: "/app/inventory", group: "main" },
  { id: "forecasts", label: "Forecasts", href: "/app/forecasts", group: "main" },
  { id: "replenishment", label: "Replenishment", href: "/app/replenishment", group: "main" },
  { id: "scenarios", label: "Scenarios", href: "/app/scenarios", group: "main" },
  { id: "orders", label: "Purchase Orders", href: "/app/purchase-orders", group: "main" },
  { id: "data", label: "Import Data", href: "/app/data", group: "data" },
  { id: "settings", label: "Settings", href: "/app/settings", group: "settings" },
] as const;

export type NavigationId = (typeof navigationItems)[number]["id"];

export function isNavigationActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}
