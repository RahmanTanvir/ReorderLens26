import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ create: vi.fn(), claims: vi.fn(), session: vi.fn() }));
vi.mock("@supabase/ssr", () => ({ createServerClient: mocks.create }));

import { proxy } from "../../src/proxy";

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3000");
  mocks.create.mockReset(); mocks.claims.mockReset(); mocks.session.mockReset();
  mocks.create.mockReturnValue({ auth: { getClaims: mocks.claims, getSession: mocks.session } });
});

describe("proxy session boundary", () => {
  it("redirects protected deep links without configured/verified access", async () => {
    const response = await proxy(new NextRequest("http://localhost:3000/app/settings"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost:3000/login?next=%2Fapp%2Fsettings");
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("returns private JSON 401 for unauthenticated API access", async () => {
    const response = await proxy(new NextRequest("http://localhost:3000/api/workspaces"));
    expect(response.status).toBe(401);
    expect((await response.json()).error.code).toBe("AUTH_REQUIRED");
  });
  it("does not trust a cookie that the auth verifier rejects", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_example");
    mocks.claims.mockResolvedValue({ data: null, error: { code: "invalid_jwt" } });
    const response = await proxy(new NextRequest("http://localhost:3000/api/workspace", { headers: { cookie: "sb-forged-auth-token=forged" } }));
    expect(response.status).toBe(401);
    expect(mocks.claims).toHaveBeenCalledOnce();
    expect(mocks.session).not.toHaveBeenCalled();
  });
  it("retains refreshed cookies and private cache policy on an auth redirect", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_example");
    mocks.create.mockImplementation((_url, _key, options) => ({ auth: { getClaims: async () => {
      options.cookies.setAll([{ name: "sb-test-auth-token", value: "test-refresh", options: { httpOnly: true, sameSite: "lax", path: "/" } }], { "Cache-Control": "private, no-store" });
      return { data: null, error: { code: "invalid_jwt" } };
    } } }));
    const response = await proxy(new NextRequest("http://localhost:3000/app/overview"));
    expect(response.cookies.get("sb-test-auth-token")?.value).toBe("test-refresh");
    expect(response.cookies.get("sb-test-auth-token")?.httpOnly).toBe(true);
    expect(response.headers.get("cache-control")).toContain("private");
    expect(response.headers.get("expires")).toBe("0");
  });
});
