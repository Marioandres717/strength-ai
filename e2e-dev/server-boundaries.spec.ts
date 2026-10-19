import { test, expect } from "@playwright/test"
import {
  E2E_IDS,
  openE2EDatabase,
  seedScenario,
} from "../e2e/fixtures/database"

test("dev module exposes the RPC without server-only operation imports", async ({
  request,
}) => {
  const response = await request.get("/src/functions/getSessionData.ts")
  expect(response.ok()).toBe(true)
  const source = await response.text()
  expect(source).toContain("createClientRpc")
  expect(source).not.toContain("workoutHistory.server")
  expect(source).not.toContain("getSessionDataOperation")
  expect(source).not.toContain("getSessionData.server")
})

test("a planned session loads in dev without browser module errors", async ({
  page,
}) => {
  const database = openE2EDatabase()
  try {
    seedScenario(database.db, "resumable-workout")
  } finally {
    database.sqlite.close()
  }
  const errors: string[] = []
  page.on("pageerror", (error) => errors.push(error.message))
  await page.goto(`/session/${E2E_IDS.currentSession}`)
  await expect(
    page.getByRole("heading", { name: "Barbell Bench Press" })
  ).toBeVisible()
  await expect(page.getByText("Set 2", { exact: false }).first()).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Complete Workout", exact: true })
  ).toBeVisible()
  expect(errors).toEqual([])
})
