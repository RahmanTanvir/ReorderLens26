import { describe, expect, it } from "vitest";

import { credentialsSchema, passwordUpdateSchema, safeNextPath, workspaceCreateSchema, workspaceUpdateSchema } from "../../src/lib/auth/contracts";
import { assertSameOrigin } from "../../src/lib/auth/errors";

describe("safe authentication redirects", () => {
  it.each(["https://evil.example", "//evil.example", "/\\evil.example", "/%5cevil.example", "/%252fevil.example", "/app/../auth/sign-out", "/api/workspaces", "/app/overview\n", "/app/%ZZ"])("rejects unsafe destination %s", (value) => {
    expect(safeNextPath(value)).toBe("/app/overview");
  });
  it("preserves legitimate protected deep links and recovery destinations", () => {
    expect(safeNextPath("/app/purchase-orders/review?planId=example")).toBe("/app/purchase-orders/review?planId=example");
    expect(safeNextPath("/auth/reset?mode=update")).toBe("/auth/reset?mode=update");
    expect(safeNextPath("/setup")).toBe("/setup");
  });
});

describe("same-origin mutation checks", () => {
  it.each(["https://evil.example", "null", "https://localhost:3000.evil.example", "http://user@localhost:3000", "http://localhost:3000/path", "http://localhost:3000/"])("rejects mismatched/malformed Origin %s", (origin) => {
    expect(() => assertSameOrigin(origin, null, "http://localhost:3000")).toThrow();
  });
  it("requires a same-origin Origin or Referer", () => {
    expect(() => assertSameOrigin(null, null, "http://localhost:3000")).toThrow();
    expect(() => assertSameOrigin("http://localhost:3000", null, "http://localhost:3000")).not.toThrow();
    expect(() => assertSameOrigin(null, "http://localhost:3000/app/settings", "http://localhost:3000")).not.toThrow();
  });
});

describe("auth/workspace input contracts", () => {
  it("rejects submitted identities, roles and permission fields", () => {
    expect(workspaceCreateSchema.safeParse({ name: "Store", location: "Dhaka", userId: "attacker", role: "owner" }).success).toBe(false);
    expect(workspaceUpdateSchema.safeParse({ name: "Store", location: "Dhaka", isSample: true }).success).toBe(false);
    expect(credentialsSchema.safeParse({ email: "valid@example.test", password: "x", org_id: "forged" }).success).toBe(false);
  });
  it("allows existing sign-in passwords but requires strong, matching new passwords", () => {
    expect(credentialsSchema.safeParse({ email: "valid@example.test", password: "existing" }).success).toBe(true);
    expect(passwordUpdateSchema.safeParse({ password: "short", confirmPassword: "short" }).success).toBe(false);
    expect(passwordUpdateSchema.safeParse({ password: "long-test-password", confirmPassword: "different" }).success).toBe(false);
    expect(passwordUpdateSchema.safeParse({ password: "long-test-password", confirmPassword: "long-test-password" }).success).toBe(true);
  });
});
