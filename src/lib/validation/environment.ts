import { z } from "@/lib/validation/zod";

type Environment = Readonly<Record<string, string | undefined>>;

const publicKeys = new Set([
  "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
]);

// Vercel injects these documented, public deployment facts during hosted builds.
// Accept exact names only; never allow arbitrary NEXT_PUBLIC_VERCEL_* settings.
// They are not application config and must not enter the returned projection.
// https://vercel.com/docs/environment-variables/framework-environment-variables
const vercelPublicMetadataKeys = new Set([
  "NEXT_PUBLIC_VERCEL_ENV",
  "NEXT_PUBLIC_VERCEL_TARGET_ENV",
  "NEXT_PUBLIC_VERCEL_URL",
  "NEXT_PUBLIC_VERCEL_BRANCH_URL",
  "NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL",
  "NEXT_PUBLIC_VERCEL_DEPLOYMENT_ID",
  "NEXT_PUBLIC_VERCEL_PROJECT_ID",
  "NEXT_PUBLIC_VERCEL_GIT_PROVIDER",
  "NEXT_PUBLIC_VERCEL_GIT_REPO_SLUG",
  "NEXT_PUBLIC_VERCEL_GIT_REPO_OWNER",
  "NEXT_PUBLIC_VERCEL_GIT_REPO_ID",
  "NEXT_PUBLIC_VERCEL_GIT_COMMIT_REF",
  "NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA",
  "NEXT_PUBLIC_VERCEL_GIT_COMMIT_MESSAGE",
  "NEXT_PUBLIC_VERCEL_GIT_COMMIT_AUTHOR_LOGIN",
  "NEXT_PUBLIC_VERCEL_GIT_COMMIT_AUTHOR_NAME",
  "NEXT_PUBLIC_VERCEL_GIT_PREVIOUS_SHA",
  "NEXT_PUBLIC_VERCEL_GIT_PULL_REQUEST_ID",
]);

const httpUrl = z.url().refine((value) => {
  const url = new URL(value);
  return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password;
});

const publicSchema = z
  .object({
    NEXT_PUBLIC_APP_URL: httpUrl.default("http://localhost:3000"),
    NEXT_PUBLIC_SUPABASE_URL: httpUrl.optional(),
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z
      .string()
      .regex(/^sb_publishable_[A-Za-z0-9_-]+$/)
      .optional(),
  })
  .superRefine((value, context) => {
    if (Boolean(value.NEXT_PUBLIC_SUPABASE_URL) !== Boolean(value.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)) {
      context.addIssue({
        code: "custom",
        path: ["NEXT_PUBLIC_SUPABASE_URL"],
        message: "Configure both public Supabase settings together.",
      });
    }
  });

const serverSchema = z.object({
  // This enables external inference only; deterministic Insight remains usable.
  AI_ASSISTANT_ENABLED: z.enum(["false","true"]).default("false"),
  OPENROUTER_SAMPLE_EVALUATION: z.enum(["false","true"]).default("false"),
  OPENROUTER_BASE_URL: z.literal("https://openrouter.ai/api/v1").default("https://openrouter.ai/api/v1"),
});

function optionalValue(value: string | undefined) {
  return value?.trim() || undefined;
}

function parseSafely<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    const fields = [...new Set(result.error.issues.map((issue) => issue.path.join(".")))];
    // Report names only: Zod's raw input/errors must never expose environment values.
    throw new Error(`Invalid application configuration: ${fields.join(", ")}.`);
  }
  return result.data;
}

export function parsePublicEnvironment(environment: Environment) {
  const unsupportedKeys = Object.keys(environment).filter(
    (key) => key.startsWith("NEXT_PUBLIC_") && !publicKeys.has(key) && !vercelPublicMetadataKeys.has(key),
  ).sort();
  if (unsupportedKeys.length) {
    // Names only: never include environment values in build errors.
    throw new Error(`Unsupported NEXT_PUBLIC_ setting: ${unsupportedKeys.join(", ")}. Only approved public configuration is allowed.`);
  }

  const parsed = parseSafely(publicSchema, {
    NEXT_PUBLIC_APP_URL: optionalValue(environment.NEXT_PUBLIC_APP_URL),
    NEXT_PUBLIC_SUPABASE_URL: optionalValue(environment.NEXT_PUBLIC_SUPABASE_URL),
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: optionalValue(environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY),
  });

  return {
    appUrl: parsed.NEXT_PUBLIC_APP_URL,
    supabase: parsed.NEXT_PUBLIC_SUPABASE_URL && parsed.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
      ? { configured: true as const, url: parsed.NEXT_PUBLIC_SUPABASE_URL, publishableKey: parsed.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY }
      : { configured: false as const },
  };
}

export function parseServerEnvironment(environment: Environment) {
  const parsed = parseSafely(serverSchema, {
    AI_ASSISTANT_ENABLED: optionalValue(environment.AI_ASSISTANT_ENABLED),
    OPENROUTER_BASE_URL: optionalValue(environment.OPENROUTER_BASE_URL),
    OPENROUTER_SAMPLE_EVALUATION: optionalValue(environment.OPENROUTER_SAMPLE_EVALUATION),
  });

  return {
    public: parsePublicEnvironment(environment),
    supabaseSecretKey: optionalValue(environment.SUPABASE_SECRET_KEY),
    externalAiEnabled: parsed.AI_ASSISTANT_ENABLED === "true",
    openRouter: {
      baseUrl: parsed.OPENROUTER_BASE_URL,
      apiKey: optionalValue(environment.OPENROUTER_API_KEY),
      models: [optionalValue(environment.OPENROUTER_PRIMARY_MODEL),...(optionalValue(environment.OPENROUTER_FALLBACK_MODELS)?.split(",").map(x=>x.trim()).filter(Boolean)??[])].filter((x):x is string=>Boolean(x)),
      sampleEvaluation: parsed.OPENROUTER_SAMPLE_EVALUATION === "true",
    },
  };
}
