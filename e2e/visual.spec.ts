import { E2E_IDS, E2E_VISUAL_TIMESTAMP } from "./fixtures/database"
import { expect, test } from "./fixtures/test"

test.beforeEach(({ isMobile }) => {
  test.skip(!isMobile)
  test.skip(process.platform !== "linux", "Visual baselines are Linux-only")
})

test("dashboard @visual", async ({ page }) => {
  await page.goto("/")
  await expect(
    page.getByRole("heading", { name: "Focused Strength Block" })
  ).toBeVisible()
  await expect(page).toHaveScreenshot("dashboard.png", { fullPage: true })
})

test.describe("workout states", () => {
  test.use({ scenario: "visual-workout" })

  test.beforeEach(async ({ page }) => {
    await page.clock.install({ time: new Date(E2E_VISUAL_TIMESTAMP) })
  })

  test("active set @visual", async ({ page }) => {
    await page.goto(`/session/${E2E_IDS.currentSession}`)
    await expect(
      page.getByRole("heading", { name: "Barbell Bench Press" })
    ).toBeVisible()
    await expect(page.getByText("00:00", { exact: true })).toBeVisible()
    await expect(page).toHaveScreenshot("active-set.png", { fullPage: true })
  })

  test("rest timer @visual", async ({ page }) => {
    await page.goto(`/session/${E2E_IDS.currentSession}`)
    await page.getByRole("button", { name: "Complete Set & Rest" }).click()
    await expect(page.getByText("Resting")).toBeVisible()
    await expect(page.getByText("00:00", { exact: true })).toBeVisible()
    await expect(page).toHaveScreenshot("rest-timer.png", { fullPage: true })
  })
})

test.describe("completed workout", () => {
  test.use({ scenario: "completed-workout" })

  test("feedback @visual", async ({ page }) => {
    await page.goto(`/feedback/${E2E_IDS.completedWorkout}`)
    await expect(
      page.getByRole("heading", { name: "Session Logged" })
    ).toBeVisible()
    await expect(page).toHaveScreenshot("feedback.png", { fullPage: true })
  })
})
