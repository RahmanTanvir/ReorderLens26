import { describe,expect,it } from "vitest";
import { contentPolicy } from "@/lib/security/content-policy";
describe("deployment content restrictions",()=>{
  it("restricts production scripts/connections and preserves native UI positioning",()=>{const policy=contentPolicy("nonce-example",false,true);expect(policy).toContain("script-src 'self' 'nonce-nonce-example' 'strict-dynamic'");expect(policy).not.toContain("'unsafe-eval'");expect(policy.split('; ').find(s=>s.startsWith('script-src'))).not.toContain("'unsafe-inline'");expect(policy).toContain("connect-src 'self';");expect(policy).toContain("style-src-attr 'unsafe-inline'");expect(policy).toContain("frame-ancestors 'none'");expect(policy).toContain("upgrade-insecure-requests");});
  it("permits local development hot reload without upgrading HTTP loopback",()=>{const policy=contentPolicy("example",true,false);expect(policy).toContain("'unsafe-eval'");expect(policy).toContain("connect-src 'self' ws: wss:");expect(policy).not.toContain("upgrade-insecure-requests");});
});
