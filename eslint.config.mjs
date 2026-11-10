import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTypescript,
  globalIgnores([
    ".next/**",
    "out/**",
    "coverage/**",
    "artifacts/**",
    "ReorderLens_Docs/**",
    "next-env.d.ts",
  ]),
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/server/**", "src/app/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/server", "@/server/**", "**/server", "**/server/**"],
              message: "Only server entrypoints may import server modules. Keep shared UI and domain modules server-independent.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "Program[body.0.type='ExpressionStatement'][body.0.expression.value='use client'] ImportDeclaration[source.value=/server/]",
          message: "Client components cannot import server modules. Server modules must also import server-only.",
        },
      ],
    },
  },
]);
