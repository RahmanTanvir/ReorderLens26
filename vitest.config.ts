import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts", "tests/components/**/*.test.tsx", "tests/security/**/*.test.ts"],
    clearMocks: true,
    // Each security file boots PostgreSQL/WASM; avoid CPU/memory setup timeouts.
    maxWorkers: 2,
  },
});
