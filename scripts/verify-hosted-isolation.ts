// Node-only release tooling. Never import this interactive verifier into the app.
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { Writable } from "node:stream";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { mkdir, writeFile } from "node:fs/promises";

type Account = { email: string; password: string };
type Configuration = { url: string; publishableKey: string; accounts: readonly [Account, Account] };
type Identity = { token: string; id: string; orgs: string[]; job?: { id: string; org_id: string; storage_prefix: string } };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export class ProbeFailure extends Error {
  code: string;
  constructor(code: string) { super(code); this.code = code; }
}
function requireCheck(value: unknown, code: string): asserts value {
  if (!value) throw new ProbeFailure(code);
}
function object(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
function checkedOrigin(value: string) {
  let url: URL;
  try { url = new URL(value); } catch { throw new ProbeFailure("INVALID_SUPABASE_ORIGIN"); }
  requireCheck(url.protocol === "https:" && /^[a-z0-9-]+\.supabase\.co$/.test(url.hostname)
    && !url.port && !url.username && !url.password && url.pathname === "/" && !url.search && !url.hash,
  "INVALID_SUPABASE_ORIGIN");
  return url.origin;
}

/** Signs in two test users, reads existing fixtures, then revokes only these new
 * local sessions. No workspace, object, policy, account or business-data writes. */
export async function verifyHostedIsolation(config: Configuration, fetcher: typeof fetch = fetch) {
  const origin = checkedOrigin(config.url);
  requireCheck(/^sb_publishable_[A-Za-z0-9_-]+$/.test(config.publishableKey), "PUBLISHABLE_KEY_REQUIRED");
  requireCheck(config.accounts.length === 2 && config.accounts.every(a => a.email.includes("@")
    && a.email.length <= 254 && a.password.length > 0 && a.password.length <= 1024), "TWO_TEST_ACCOUNTS_REQUIRED");
  const sessions: string[] = [], checks: { check: string; passed: true }[] = [];
  const pass = (check: string) => checks.push({ check, passed: true });
  async function request(path: string, token?: string, body?: unknown) {
    try {
      return await fetcher(origin + path, {
        method: body === undefined ? "GET" : "POST", redirect: "error", cache: "no-store",
        headers: { apikey: config.publishableKey, ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(15000),
      });
    } catch { throw new ProbeFailure("NETWORK_OR_TIMEOUT"); }
  }
  async function json(response: Response, code: string): Promise<unknown> {
    requireCheck(response.ok, code);
    try { return await response.json(); } catch { throw new ProbeFailure(code); }
  }
  async function cancelled(response: Response) { await response.body?.cancel(); }
  let completed = false;
  try {
    const people: Identity[] = [];
    for (const [index, account] of config.accounts.entries()) {
      const label = index === 0 ? "A" : "B";
      const login = object(await json(await request("/auth/v1/token?grant_type=password", undefined, account), `${label}_SIGN_IN_FAILED`));
      if (typeof login.access_token === "string" && login.access_token) sessions.push(login.access_token);
      const id = object(login.user).id;
      requireCheck(typeof id === "string" && uuid.test(id) && typeof login.access_token === "string" && login.access_token, `${label}_SIGN_IN_FAILED`);
      const memberships = await json(await request(`/rest/v1/organization_members?select=org_id&user_id=eq.${id}`, login.access_token), `${label}_MEMBERSHIP_READ_FAILED`);
      requireCheck(Array.isArray(memberships) && memberships.length > 0 && memberships.every(m => typeof object(m).org_id === "string" && uuid.test(object(m).org_id as string)), `${label}_NEEDS_OWN_WORKSPACE`);
      people.push({ id, token: login.access_token, orgs: memberships.map(m => object(m).org_id as string) });
    }
    const [a, b] = people;
    requireCheck(a.id !== b.id, "DISTINCT_ACCOUNTS_REQUIRED"); pass("distinct_authenticated_users");
    requireCheck(!a.orgs.some(org => b.orgs.includes(org)), "SHARED_MEMBERSHIP_REMOVE_FROM_TEST_SCOPE"); pass("disjoint_workspace_memberships");
    for (const [index, person] of people.entries()) {
      const label = index === 0 ? "A" : "B";
      const query = new URLSearchParams({ select: "id,org_id,storage_prefix", org_id: `in.(${person.orgs.join(",")})`, status: "eq.committed", order: "created_at.desc", limit: "1" });
      const rows = await json(await request(`/rest/v1/import_jobs?${query}`, person.token), `${label}_IMPORT_READ_FAILED`);
      requireCheck(Array.isArray(rows) && rows.length === 1, `${label}_NEEDS_COMMITTED_FICTIONAL_IMPORT`);
      const job = object(rows[0]);
      requireCheck(typeof job.id === "string" && uuid.test(job.id) && typeof job.org_id === "string"
        && person.orgs.includes(job.org_id) && job.storage_prefix === `${job.org_id}/${job.id}`, `${label}_INVALID_IMPORT_PREFIX`);
      person.job = { id: job.id, org_id: job.org_id, storage_prefix: job.storage_prefix as string };
      const own = await request(`/storage/v1/object/retail-imports/${person.job.storage_prefix}/suppliers.csv`, person.token);
      const ok = own.status === 200 && own.headers.get("Content-Type")?.split(";")[0].trim().toLowerCase() === "text/csv";
      await cancelled(own);
      requireCheck(ok, `${label}_OWN_CSV_CONTROL_FAILED`); pass(`${label}_own_import_and_csv_read`);
    }
    for (const [owner, other, label] of [[a, b, "A"], [b, a, "B"]] as const) {
      const job = owner.job!;
      const foreign = await json(await request(`/rest/v1/import_jobs?select=id&id=eq.${job.id}`, other.token), "FOREIGN_IMPORT_PROBE_FAILED");
      requireCheck(Array.isArray(foreign) && foreign.length === 0, `${label}_IMPORT_METADATA_VISIBLE_TO_OTHER_USER`);
      pass(`${label}_import_hidden_from_other_user`);
      for (const [actor, token, publicRoute] of [["other_user", other.token, false], ["anonymous", undefined, false], ["public_route", undefined, true]] as const) {
        const response = await request(`/storage/v1/object/${publicRoute ? "public/" : ""}retail-imports/${job.storage_prefix}/suppliers.csv`, token);
        const status = response.status; await cancelled(response);
        // Own-file positive controls above prevent a missing object from passing.
        // Timeouts, server errors and an expired foreign JWT are not RLS evidence.
        const allowed = actor === "other_user" ? [400, 403, 404] : [400, 401, 403, 404];
        requireCheck(allowed.includes(status), `${label}_CSV_${actor.toUpperCase()}_DENIAL_NOT_VERIFIED`);
        pass(`${label}_csv_denied_to_${actor}`);
      }
    }
    completed = true;
  } finally {
    let cleanupFailed = false;
    for (const token of sessions) {
      try { const response = await request("/auth/v1/logout?scope=local", token, {}); cleanupFailed ||= !response.ok; await cancelled(response); }
      catch { cleanupFailed = true; }
    }
    if (completed && cleanupFailed) throw new ProbeFailure("LOCAL_TEST_SESSION_CLEANUP_FAILED");
  }
  return { passed: true, checks, scope: "Existing fictional import metadata and CSV read isolation only; no write-policy, load, or release approval claim." };
}

async function main() {
  requireCheck(stdin.isTTY && stdout.isTTY, "INTERACTIVE_TERMINAL_REQUIRED");
  // Readline uses raw terminal input; this sink suppresses echo for every answer.
  const muted = new Writable({ write(_chunk, _encoding, callback) { callback(); } });
  const rl = createInterface({ input: stdin, output: muted, terminal: true });
  const abort = new AbortController(); rl.on("SIGINT", () => abort.abort());
  async function ask(label: string) { stdout.write(label); const answer = await rl.question("", { signal: abort.signal }); stdout.write("\n"); return answer; }
  try {
    console.log("P9 verifier: two confirmed TEST accounts, each with an existing committed fictional CSV import. All answers are hidden and held in memory only.");
    const url = checkedOrigin((await ask("Supabase HTTPS origin connected to Vercel: ")).trim());
    console.log(`Target: ${new URL(url).hostname}`);
    const publishableKey = (await ask("Publishable key (sb_publishable_...): ")).trim();
    requireCheck(/^sb_publishable_[A-Za-z0-9_-]+$/.test(publishableKey), "PUBLISHABLE_KEY_REQUIRED");
    const accounts: [Account, Account] = [
      { email: (await ask("Account A email: ")).trim(), password: await ask("Account A password: ") },
      { email: (await ask("Account B email: ")).trim(), password: await ask("Account B password: ") },
    ];
    requireCheck(await ask("Type VERIFY to authenticate and run read-only data probes: ") === "VERIFY", "CANCELLED");
    rl.close();
    const result = await verifyHostedIsolation({ url, publishableKey, accounts });
    const directory = new URL("../artifacts/", import.meta.url); await mkdir(directory, { recursive: true });
    await writeFile(new URL("p9-hosted-storage.json", directory), JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result, null, 2));
  } finally { rl.close(); muted.destroy(); }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    // Never print raw provider/network errors, auth payloads, tokens or CSV bodies.
    console.error(JSON.stringify({ passed: false, code: error instanceof ProbeFailure ? error.code : "PROBE_INCOMPLETE" }));
    process.exitCode = 1;
  });
}
