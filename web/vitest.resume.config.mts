import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Explicit opt-in suite. Missing/broken binaries fail; nothing is silently skipped.
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: { environment: "node", include: ["integration/resume-parser.integration.test.ts"], testTimeout: 20_000 },
});
