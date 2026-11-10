import { z } from "zod";

type Environment = Readonly<Record<string, string | undefined>>;

const publicKeys = new Set([
  "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
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
  // P0 cannot enable external inference: privacy/consent gates belong to P8.
  AI_ASSISTANT_ENABLED: z.literal("false").default("false"),
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
  if (Object.keys(environment).some((key) => key.startsWith("NEXT_PUBLIC_") && !publicKeys.has(key))) {
    throw new Error("Unsupported NEXT_PUBLIC_ setting. Only approved public configuration is allowed.");
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
  });

  return {
    public: parsePublicEnvironment(environment),
    supabaseSecretKey: optionalValue(environment.SUPABASE_SECRET_KEY),
    externalAiEnabled: false as const,
    openRouter: {
      baseUrl: parsed.OPENROUTER_BASE_URL,
      apiKey: optionalValue(environment.OPENROUTER_API_KEY),
    },
  };
}
