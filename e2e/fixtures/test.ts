import { test as base, expect } from "@playwright/test"
import type { ConsoleMessage, Page, TestInfo } from "@playwright/test"
import {
  openE2EDatabase,
  preserveFailedDatabase,
  seedScenario,
} from "./database"
import type { E2EDatabase, E2EScenario } from "./database"

interface E2EFixtures {
  scenario: E2EScenario
  e2eDb: E2EDatabase
  diagnostics: void
}

function formatConsoleMessage(message: ConsoleMessage): string {
  return `[${message.type()}] ${message.text()}`
}

async function retainDiagnostics(
  testInfo: TestInfo,
  consoleMessages: string[],
  networkFailures: string[],
  database: E2EDatabase,
  force = false
): Promise<void> {
  if (!force && testInfo.status === testInfo.expectedStatus) return

  await testInfo.attach("browser-console", {
    body: Buffer.from(consoleMessages.join("\n") || "No console messages."),
    contentType: "text/plain",
  })
  await testInfo.attach("network-failures", {
    body: Buffer.from(networkFailures.join("\n") || "No network failures."),
    contentType: "text/plain",
  })

  database.sqlite.pragma("wal_checkpoint(PASSIVE)")
  const databaseArtifact = preserveFailedDatabase(
    testInfo.outputPath("strength.db")
  )
  if (databaseArtifact) {
    await testInfo.attach("e2e-database", {
      path: databaseArtifact,
      contentType: "application/vnd.sqlite3",
    })
  }
}

function monitorPage(page: Page) {
  const consoleMessages: string[] = []
  const unexpectedErrors: string[] = []
  const networkFailures: string[] = []

  page.on("console", (message) => {
    const formatted = formatConsoleMessage(message)
    consoleMessages.push(formatted)
    if (message.type() === "error") unexpectedErrors.push(formatted)
  })
  page.on("pageerror", (error) => {
    unexpectedErrors.push(`[pageerror] ${error.stack ?? error.message}`)
  })
  page.on("requestfailed", (request) => {
    networkFailures.push(
      `[requestfailed] ${request.method()} ${request.url()} ${request.failure()?.errorText ?? "unknown failure"}`
    )
  })
  page.on("response", (response) => {
    const isServerFunctionFailure =
      response.request().method() !== "GET" && response.status() >= 400
    if (response.status() >= 500 || isServerFunctionFailure) {
      networkFailures.push(
        `[response] ${response.status()} ${response.request().method()} ${response.url()}`
      )
    }
  })

  return { consoleMessages, unexpectedErrors, networkFailures }
}

export const test = base.extend<E2EFixtures>({
  scenario: ["active-program", { option: true }],
  e2eDb: [
    async ({ scenario }, use) => {
      const database = openE2EDatabase()
      seedScenario(database.db, scenario)
      await use(database)
      database.sqlite.close()
    },
    { auto: true },
  ],
  diagnostics: [
    async ({ page, e2eDb }, use, testInfo) => {
      const diagnostics = monitorPage(page)
      await use()

      if (
        diagnostics.unexpectedErrors.length > 0 ||
        diagnostics.networkFailures.length > 0
      ) {
        await testInfo.attach("unexpected-browser-errors", {
          body: Buffer.from(
            [
              ...diagnostics.unexpectedErrors,
              ...diagnostics.networkFailures,
            ].join("\n")
          ),
          contentType: "text/plain",
        })
        await retainDiagnostics(
          testInfo,
          diagnostics.consoleMessages,
          diagnostics.networkFailures,
          e2eDb,
          true
        )
        expect(
          [...diagnostics.unexpectedErrors, ...diagnostics.networkFailures],
          "Unexpected browser, server-function, or network errors"
        ).toEqual([])
      }

      await retainDiagnostics(
        testInfo,
        diagnostics.consoleMessages,
        diagnostics.networkFailures,
        e2eDb
      )
    },
    { auto: true },
  ],
})

export { expect }
