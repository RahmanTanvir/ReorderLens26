import { describe, expect, it } from "vitest";

import { parsePublicEnvironment, parseServerEnvironment } from "../../src/lib/validation/environment";

describe("bootstrap configuration", () => {
  it("starts with no service credentials and external AI disabled", () => {
    const result = parseServerEnvironment({});
    expect(result.public).toEqual({ appUrl: "http://localhost:3000", supabase: { configured: false } });
    expect(result.externalAiEnabled).toBe(false);
  });

  it("accepts blank optional values from the example environment", () => {
    expect(parseServerEnvironment({ NEXT_PUBLIC_SUPABASE_URL: "", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "", AI_ASSISTANT_ENABLED: "false" }).public.supabase.configured).toBe(false);
  });

  it.each([
    { NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co" },
    { NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_example" },
  ])("rejects a partial Supabase configuration", (environment) => {
    expect(() => parsePublicEnvironment(environment)).toThrow("Invalid application configuration");
  });

  it("accepts the complete publishable Supabase pair", () => {
    expect(parsePublicEnvironment({ NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_example" }).supabase.configured).toBe(true);
  });

  it.each([
    "ENV", "TARGET_ENV", "URL", "BRANCH_URL", "PROJECT_PRODUCTION_URL",
    "DEPLOYMENT_ID", "PROJECT_ID", "GIT_PROVIDER", "GIT_REPO_SLUG",
    "GIT_REPO_OWNER", "GIT_REPO_ID", "GIT_COMMIT_REF", "GIT_COMMIT_SHA",
    "GIT_COMMIT_MESSAGE", "GIT_COMMIT_AUTHOR_LOGIN", "GIT_COMMIT_AUTHOR_NAME",
    "GIT_PREVIOUS_SHA", "GIT_PULL_REQUEST_ID",
  ])("accepts Vercel's documented %s metadata without projecting it", (suffix) => {
    const result = parseServerEnvironment({
      [`NEXT_PUBLIC_VERCEL_${suffix}`]: "synthetic-deployment-metadata",
      NEXT_PUBLIC_APP_URL: "https://reorderlens.example",
    });
    expect(result.public).toEqual({ appUrl: "https://reorderlens.example", supabase: { configured: false } });
    expect(result.externalAiEnabled).toBe(false);
  });

  it.each(["NEXT_PUBLIC_CUSTOM_SETTING", "NEXT_PUBLIC_VERCEL_API_KEY", "NEXT_PUBLIC_VERCEL_SECRET"])(
    "reports an unapproved name without its value: %s", (key) => {
      try {
        parsePublicEnvironment({ [key]: "private-test-value" });
        expect.fail("Expected configuration rejection");
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain(key);
        expect((error as Error).message).not.toContain("private-test-value");
      }
    },
  );

  it.each(["javascript:alert(1)", "ftp://example.com", "https://user:secret@example.com"]) (
    "rejects unsafe application URLs: %s", (url) => {
      expect(() => parsePublicEnvironment({ NEXT_PUBLIC_APP_URL: url })).toThrow("Invalid application configuration");
    },
  );

  it.each(["NEXT_PUBLIC_OPENROUTER_API_KEY", "NEXT_PUBLIC_SUPABASE_SECRET_KEY", "NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY"])(
    "rejects an unapproved public variable: %s", (key) => {
      expect(() => parsePublicEnvironment({ [key]: "private-test-value" })).toThrow("Unsupported NEXT_PUBLIC_");
    },
  );

  it("rejects a secret key in the publishable-key field without echoing its value", () => {
    const secret = "sb_secret_private_test_value";
    try {
      parsePublicEnvironment({ NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: secret });
      expect.fail("Expected configuration rejection");
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).not.toContain(secret);
      expect((error as Error).message).toContain("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
    }
  });

  it("projects only public fields even when passed server credentials", () => {
    const result = parsePublicEnvironment({ OPENROUTER_API_KEY: "private-ai-value", SUPABASE_SECRET_KEY: "private-db-value" });
    expect(JSON.stringify(result)).not.toContain("private-");
    expect(Object.keys(result).sort()).toEqual(["appUrl", "supabase"]);
  });

  it.each(["1", "FALSE", "yes"])("rejects invalid external AI flags: %s", (flag) => {
    expect(() => parseServerEnvironment({ AI_ASSISTANT_ENABLED: flag })).toThrow("AI_ASSISTANT_ENABLED");
  });

  it("separates external inference from the explicit sample evaluation gate",()=>{
    const result=parseServerEnvironment({AI_ASSISTANT_ENABLED:"true"});expect(result.externalAiEnabled).toBe(true);expect(result.openRouter.sampleEvaluation).toBe(false);expect(result.openRouter.models).toEqual([]);
  });

  it("does not enable inference merely because a provider key exists", () => {
    expect(parseServerEnvironment({ OPENROUTER_API_KEY: "private-test-value" }).externalAiEnabled).toBe(false);
  });

  it("rejects alternate provider endpoints", () => {
    expect(() => parseServerEnvironment({ OPENROUTER_BASE_URL: "https://unapproved.example/api" })).toThrow("OPENROUTER_BASE_URL");
  });
});
