import { describe, expect, it } from "vitest";
import { verifyHostedIsolation } from "../../scripts/verify-hosted-isolation";

const userA = "10000000-0000-4000-8000-000000000001", userB = "10000000-0000-4000-8000-000000000002";
const orgA = "10000000-0000-4000-8000-000000000011", orgB = "10000000-0000-4000-8000-000000000012";
const jobA = "10000000-0000-4000-8000-000000000021", jobB = "10000000-0000-4000-8000-000000000022";
const config = { url: "https://synthetic.supabase.co", publishableKey: "sb_publishable_synthetic", accounts: [
  { email: "a@example.test", password: "private-fixture-password-A" },
  { email: "b@example.test", password: "private-fixture-password-B" },
] as const };
type Scenario = { shared?: boolean; missingBImport?: boolean; missingOwnCsv?: boolean; ownHtml?: boolean; foreignMetadata?: boolean;
  foreignDownload?: boolean; publicDownload?: boolean; foreignStatus?: number; networkFailure?: boolean; badPrefix?: boolean };
function fixture(scenario: Scenario = {}) {
  const calls: { path: string; method: string }[] = [];
  const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });
  const fetcher: typeof fetch = async (input, init) => {
    const url = new URL(String(input)); const headers = new Headers(init?.headers);
    calls.push({ path: url.pathname, method: init?.method ?? "GET" });
    if (url.pathname === "/auth/v1/token") {
      const account = JSON.parse(String(init?.body)); const a = account.email === config.accounts[0].email;
      return json({ access_token: a ? "synthetic-access-a" : "synthetic-access-b", user: { id: a ? userA : userB } });
    }
    if (url.pathname === "/auth/v1/logout") {
      expect(url.searchParams.get("scope")).toBe("local"); return new Response(null, { status: 204 });
    }
    const actor = headers.get("Authorization") === "Bearer synthetic-access-a" ? "A"
      : headers.get("Authorization") === "Bearer synthetic-access-b" ? "B" : "anonymous";
    if (url.pathname === "/rest/v1/organization_members") return json([{ org_id: actor === "A" || scenario.shared ? orgA : orgB }]);
    if (url.pathname === "/rest/v1/import_jobs") {
      if (url.searchParams.has("id")) return json(scenario.foreignMetadata ? [{ id: jobA }] : []);
      if (actor === "B" && scenario.missingBImport) return json([]);
      const org = actor === "A" ? orgA : orgB, id = actor === "A" ? jobA : jobB;
      return json([{ id, org_id: org, storage_prefix: scenario.badPrefix ? "../other" : `${org}/${id}` }]);
    }
    if (url.pathname.startsWith("/storage/v1/object/")) {
      const publicRoute = url.pathname.includes("/object/public/");
      const owner = url.pathname.includes(orgA) ? "A" : "B";
      if (!publicRoute && owner === actor) return scenario.missingOwnCsv ? json({}, 404)
        : new Response(scenario.ownHtml ? "<h1>Gateway</h1>" : "sku,supplier\nfixture,synthetic\n", { headers: { "Content-Type": scenario.ownHtml ? "text/html" : "text/csv" } });
      if (scenario.networkFailure) throw new Error("private-fixture-password-A synthetic-access-a provider-payload");
      if (publicRoute && scenario.publicDownload || !publicRoute && actor !== "anonymous" && scenario.foreignDownload) return new Response("forbidden-csv-content");
      return json({}, actor === "anonymous" ? 404 : scenario.foreignStatus ?? 404);
    }
    throw new Error("Unexpected fixture route");
  };
  return { fetcher, calls };
}

describe("read-only hosted isolation verifier", () => {
  it("requires own-file controls, checks both directions and anonymous/public denial, and logs no data", async () => {
    const { fetcher, calls } = fixture(); const result = await verifyHostedIsolation(config, fetcher);
    expect(result.passed).toBe(true); expect(result.checks).toHaveLength(12);
    const serialized = JSON.stringify(result);
    for (const value of [userA, orgA, jobA, config.publishableKey, config.accounts[0].email, config.accounts[0].password, "synthetic-access-a", "fixture,synthetic"])
      expect(serialized).not.toContain(value);
    expect(calls.filter(c => c.method !== "GET").map(c => c.path)).toEqual([
      "/auth/v1/token", "/auth/v1/token", "/auth/v1/logout", "/auth/v1/logout",
    ]);
  });
  it.each([
    [{ shared: true }, "SHARED_MEMBERSHIP_REMOVE_FROM_TEST_SCOPE"],
    [{ missingBImport: true }, "B_NEEDS_COMMITTED_FICTIONAL_IMPORT"],
    [{ missingOwnCsv: true }, "A_OWN_CSV_CONTROL_FAILED"],
    [{ ownHtml: true }, "A_OWN_CSV_CONTROL_FAILED"],
    [{ badPrefix: true }, "A_INVALID_IMPORT_PREFIX"],
    [{ foreignMetadata: true }, "A_IMPORT_METADATA_VISIBLE_TO_OTHER_USER"],
    [{ foreignDownload: true }, "A_CSV_OTHER_USER_DENIAL_NOT_VERIFIED"],
    [{ publicDownload: true }, "A_CSV_PUBLIC_ROUTE_DENIAL_NOT_VERIFIED"],
    [{ foreignStatus: 503 }, "A_CSV_OTHER_USER_DENIAL_NOT_VERIFIED"],
    [{ foreignStatus: 401 }, "A_CSV_OTHER_USER_DENIAL_NOT_VERIFIED"],
  ] as const)("fails closed instead of reporting isolation for %j", async (scenario, code) => {
    const { fetcher, calls } = fixture(scenario);
    await expect(verifyHostedIsolation(config, fetcher)).rejects.toThrow(code);
    expect(calls.filter(c => c.path === "/auth/v1/logout")).toHaveLength(2);
  });
  it("redacts transport errors and still revokes the two local probe sessions", async () => {
    const { fetcher, calls } = fixture({ networkFailure: true });
    await expect(verifyHostedIsolation(config, fetcher)).rejects.toThrow(/^NETWORK_OR_TIMEOUT$/);
    expect(calls.filter(c => c.path === "/auth/v1/logout")).toHaveLength(2);
  });
  it.each(["https://other.example", "http://synthetic.supabase.co", "https://user:password@synthetic.supabase.co", "https://synthetic.supabase.co/path"])(
    "rejects an unsafe/unapproved target before authentication: %s", async url => {
      const { fetcher, calls } = fixture();
      await expect(verifyHostedIsolation({ ...config, url }, fetcher)).rejects.toThrow("INVALID_SUPABASE_ORIGIN");
      expect(calls).toEqual([]);
    },
  );
  it("does not accept a secret/legacy credential as the public project key", async () => {
    const { fetcher, calls } = fixture();
    await expect(verifyHostedIsolation({ ...config, publishableKey: "legacy-or-privileged-key" }, fetcher)).rejects.toThrow("PUBLISHABLE_KEY_REQUIRED");
    expect(calls).toEqual([]);
  });
});
