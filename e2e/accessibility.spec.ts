import { E2E_IDS } from "./fixtures/database"
import { expect, test } from "./fixtures/test"
import { expectNoA11yViolations } from "./helpers/accessibility"

test("dashboard, active set, rest timer, and feedback pass Axe A/AA", async ({
  page,
}) => {
  await page.goto("/")
  await expect(
    page.getByRole("heading", { name: "Focused Strength Block" })
  ).toBeVisible()
  await expectNoA11yViolations(page)

  await page.goto(`/session/${E2E_IDS.currentSession}`)
  await expect(
    page.getByRole("heading", { name: "Barbell Bench Press" })
  ).toBeVisible()
  await expectNoA11yViolations(page)

  await page.getByRole("button", { name: "Complete Set & Rest" }).click()
  await expect(page.getByText("Resting")).toBeVisible()
  await expectNoA11yViolations(page)

  await page.getByRole("button", { name: "Skip" }).click()
  await page.getByRole("button", { name: "Complete Workout" }).click()
  await expect(page).toHaveURL(/\/feedback\//)
  await expect(
    page.getByRole("heading", { name: "Session Logged" })
  ).toBeVisible()
  await expectNoA11yViolations(page)
})
