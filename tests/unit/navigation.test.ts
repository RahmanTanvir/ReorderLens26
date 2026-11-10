import { describe, expect, it } from "vitest";

import { isNavigationActive } from "../../src/lib/navigation";

describe("navigation section matching", () => {
  it("retains the section for deep-linked details and review", () => {
    expect(isNavigationActive("/app/purchase-orders/review", "/app/purchase-orders")).toBe(true);
    expect(isNavigationActive("/app/inventory/product-id", "/app/inventory")).toBe(true);
    expect(isNavigationActive("/app/inventory", "/app/inventory")).toBe(true);
  });

  it("does not mark similarly prefixed routes as the active section", () => {
    expect(isNavigationActive("/app/inventory-archive", "/app/inventory")).toBe(false);
    expect(isNavigationActive("/app/forecasts", "/app/inventory")).toBe(false);
  });
});
