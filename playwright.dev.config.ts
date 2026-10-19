import { defineConfig } from "@playwright/test"
import productionConfig from "./playwright.config"

// Dev serves unbundled modules: exported server-only helpers can leak here even
// when Rollup removes them from the production browser bundle.
export default defineConfig({
  ...productionConfig,
  testDir: "./e2e-dev",
  testMatch: "**/*.spec.ts",
  use: { ...productionConfig.use, baseURL: "http://127.0.0.1:3101" },
  webServer: {
    command:
      "pnpm exec cross-env STRENGTH_AI_E2E=1 DATABASE_PATH=test-results/e2e/strength.db tsx scripts/initialize.ts && pnpm exec cross-env STRENGTH_AI_E2E=1 DATABASE_PATH=test-results/e2e/strength.db vite dev --host 127.0.0.1 --port 3101 --strictPort",
    url: "http://127.0.0.1:3101/healthz",
    reuseExistingServer: false,
    stdout: "pipe",
    stderr: "pipe",
    timeout: 60_000,
  },
})
