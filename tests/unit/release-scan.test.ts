import { describe,expect,it } from "vitest";
import { secretFindings } from "@/lib/security/release-scan";
describe("credential preflight redaction",()=>{
  it("detects private credentials without returning any matched value",()=>{const key="sk-or-"+"v1-"+"a".repeat(64);const findings=secretFindings("Example\n"+key);expect(findings).toEqual([{kind:"OpenRouter credential",line:2}]);expect(JSON.stringify(findings)).not.toContain(key);expect(secretFindings("sb_"+"secret_"+"b".repeat(30))).toHaveLength(1);expect(secretFindings("-----BEGIN "+"PRIVATE KEY-----")).toHaveLength(1);});
  it("permits public publishable keys, empty templates and configuration names",()=>{expect(secretFindings("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_example\nOPENROUTER_API_KEY=\nSUPABASE_SECRET_KEY=")).toEqual([]);});
});
