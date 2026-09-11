import { eq } from "drizzle-orm"
import { plannedExercise } from "../lib/schema"
import { completeSessionOperation } from "../src/functions/completeSession.server"
import {
  E2E_IDS,
  findCurrentWorkout,
  findFuturePrescription,
  findWorkoutSets,
} from "./fixtures/database"
import { expect, test } from "./fixtures/test"

test.describe("empty database", () => {
  test.use({ scenario: "no-profile" })

  test("redirects to onboarding without invoking AI", async ({ page }) => {
    await page.goto("/")

    await expect(page).toHaveURL(/\/onboarding$/)
    await expect(
      page.getByRole("heading", { name: "What's your goal?" })
    ).toBeVisible()
    await expect(page.getByRole("button", { name: "Continue" })).toBeDisabled()
  })
})

test.describe("active program", () => {
  test("renders the seeded dashboard and starts the correct session", async ({
    page,
  }) => {
    await page.goto("/")

    await expect(
      page.getByRole("heading", { name: "Focused Strength Block" })
    ).toBeVisible()
    await expect(page.getByText("Upper Strength").first()).toBeVisible()
    await expect(page.getByText("Barbell Bench Press").first()).toBeVisible()

    await page.getByRole("link", { name: /Start Session/ }).click()

    await expect(page).toHaveURL(
      new RegExp(`/session/${E2E_IDS.currentSession}$`)
    )
    await expect(
      page.getByRole("heading", { name: "Barbell Bench Press" })
    ).toBeVisible()
    await expect(
      page.getByText("Set 1", { exact: false }).first()
    ).toBeVisible()
  })

  test("desktop dashboard navigates to the complete plan", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium-desktop")

    await page.goto("/")
    await page.getByRole("link", { name: /View full plan/ }).click()

    await expect(page).toHaveURL(/\/plan$/)
    await expect(
      page.getByRole("heading", { name: "Focused Strength Block" })
    ).toBeVisible()
    await expect(
      page.getByRole("tab", { name: "Week 1", selected: true })
    ).toBeVisible()
    await page.waitForLoadState("networkidle")
    const viewSession = page
      .getByRole("button", { name: "View session" })
      .first()
    await viewSession.click()
    await expect(
      page.getByRole("heading", { name: "Barbell Bench Press" })
    ).toBeVisible()
  })
})

test.describe("resumable workout", () => {
  test.use({ scenario: "resumable-workout" })

  test("reload resumes at set two without duplicate rows", async ({
    page,
    e2eDb,
  }) => {
    await page.goto(`/session/${E2E_IDS.currentSession}`)
    await expect(
      page.getByText("Set 2", { exact: false }).first()
    ).toBeVisible()

    expect(findCurrentWorkout(e2eDb.db)).toHaveLength(1)
    expect(findWorkoutSets(e2eDb.db, E2E_IDS.resumableWorkout)).toHaveLength(1)

    await page.reload()
    await expect(
      page.getByText("Set 2", { exact: false }).first()
    ).toBeVisible()
    expect(findCurrentWorkout(e2eDb.db)).toHaveLength(1)
    expect(findWorkoutSets(e2eDb.db, E2E_IDS.resumableWorkout)).toHaveLength(1)
  })
})

test.describe("mobile workout", () => {
  test("logs, rests, completes, saves feedback, and progresses once", async ({
    page,
    e2eDb,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium-mobile")

    await page.goto(`/session/${E2E_IDS.currentSession}`)

    const completeSet = page.getByRole("button", {
      name: "Complete Set & Rest",
    })
    await expect(completeSet).toBeVisible()
    expect((await completeSet.boundingBox())?.height).toBeGreaterThanOrEqual(48)

    await page.getByRole("button", { name: "Increase Reps" }).click()
    await page.getByRole("button", { name: "Increase Reps" }).click()
    await completeSet.click()

    const timer = page
      .getByText("Resting")
      .locator("..")
      .locator("span")
      .first()
    await expect(timer).toHaveText(/01:(?:2\d|30)/)
    const secondsBefore = parseTimer(await timer.innerText())
    await page.getByRole("button", { name: "+30s" }).click()
    const secondsAfter = parseTimer(await timer.innerText())
    expect(secondsAfter - secondsBefore).toBeGreaterThanOrEqual(29)

    const logSet = page.getByRole("button", { name: "Log Set 1" })
    expect((await logSet.boundingBox())?.height).toBeGreaterThanOrEqual(48)
    await page.getByRole("button", { name: "Skip" }).click()

    await expect(
      page.getByText("Set 2", { exact: false }).first()
    ).toBeVisible()
    await page.getByRole("button", { name: "Increase Reps" }).click()
    await page.getByRole("button", { name: "Increase Reps" }).click()
    await page.getByRole("button", { name: "Complete Workout" }).click()

    await expect(page).toHaveURL(/\/feedback\//)
    await expect(
      page.getByRole("heading", { name: "Session Logged" })
    ).toBeVisible()
    await expect(page.getByText("102.5 kg")).toBeVisible()

    const fatigue = page.getByRole("slider", {
      name: "Perceived fatigue from 1 to 5",
    })
    await fatigue.focus()
    await fatigue.press("ArrowRight")
    await page
      .getByRole("textbox", { name: "Training Notes" })
      .fill("Strong bar speed and consistent setup.")
    await page.getByRole("button", { name: "Save & Finish" }).click()

    await expect(page).toHaveURL(/\/$/)
    await expect(page.getByText("All sessions done!")).toBeVisible()

    const workouts = findCurrentWorkout(e2eDb.db)
    expect(workouts).toHaveLength(1)
    expect(workouts[0]?.completedAt).not.toBeNull()
    expect(workouts[0]?.fatigueRating).toBe(4)
    expect(workouts[0]?.notes).toBe("Strong bar speed and consistent setup.")
    expect(findWorkoutSets(e2eDb.db, workouts[0].id)).toHaveLength(2)
    expect(findFuturePrescription(e2eDb.db)?.loadKg).toBe(102.5)

    const repeatedCompletion = completeSessionOperation(e2eDb.db, {
      workoutLogId: workouts[0].id,
      sessionTemplateId: E2E_IDS.currentSession,
    })
    expect(repeatedCompletion.alreadyCompleted).toBe(true)
    expect(findFuturePrescription(e2eDb.db)?.loadKg).toBe(102.5)

    const futureRows = e2eDb.db
      .select()
      .from(plannedExercise)
      .where(eq(plannedExercise.id, E2E_IDS.futurePlannedExercise))
      .all()
    expect(futureRows).toHaveLength(1)
  })
})

function parseTimer(value: string): number {
  const [minutes, seconds] = value.split(":").map(Number)
  return (minutes ?? 0) * 60 + (seconds ?? 0)
}
