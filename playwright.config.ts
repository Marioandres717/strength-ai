import { resolve } from "node:path"
import { defineConfig } from "@playwright/test"

const e2eDatabasePath = resolve("test-results", "e2e", "strength.db")

process.env.STRENGTH_AI_E2E = "1"
process.env.DATABASE_PATH = e2eDatabasePath

export default defineConfig({
  testDir: "./e2e",
  outputDir: "test-results/playwright",
  snapshotPathTemplate: "{testDir}/snapshots/{projectName}/{arg}{ext}",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [
    ["list"],
    ["html", { outputFolder: "test-results/playwright-report", open: "never" }],
  ],
  expect: {
    toHaveScreenshot: {
      animations: "disabled",
      caret: "hide",
      maxDiffPixelRatio: 0.005,
    },
  },
  use: {
    baseURL: "http://127.0.0.1:3100",
    colorScheme: "dark",
    locale: "en-US",
    timezoneId: "America/Regina",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: {
    command: "pnpm start:e2e",
    url: "http://127.0.0.1:3100/healthz",
    reuseExistingServer: false,
    stdout: "pipe",
    stderr: "pipe",
    timeout: 60_000,
  },
  projects: [
    {
      name: "chromium-mobile",
      use: {
        browserName: "chromium",
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 1,
        hasTouch: true,
        isMobile: true,
      },
    },
    {
      name: "chromium-desktop",
      use: {
        browserName: "chromium",
        viewport: { width: 1440, height: 900 },
        deviceScaleFactor: 1,
        hasTouch: false,
        isMobile: false,
      },
    },
  ],
})
