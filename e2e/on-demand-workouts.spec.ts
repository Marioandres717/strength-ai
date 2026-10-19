import { test, expect } from "@playwright/test"
import { eq } from "drizzle-orm"
import { openE2EDatabase, seedScenario } from "./fixtures/database"
import type { E2EDatabase } from "./fixtures/database"
import {
  buildGenerationContext,
  finalizeGenerationReceipt,
} from "../lib/onDemandWorkoutGeneration.server"
import {
  onDemandWorkoutGenerationRequest,
  exercise,
  plannedExercise,
  workoutLog,
  setLog,
} from "../lib/schema"
import { deleteOnDemandWorkoutOperation } from "../lib/onDemandWorkouts.server"
import type { OnDemandWorkoutPreview } from "../src/types/on-demand-workout"

let database: E2EDatabase, preview: OnDemandWorkoutPreview
test.beforeEach(() => {
  database = openE2EDatabase()
  seedScenario(database.db, "active-program")
  const ex = database.db
    .select()
    .from(exercise)
    .where(eq(exercise.name, "Barbell Bench Press"))
    .get()!
  const input = {
    requestId: crypto.randomUUID(),
    prompt: "Short independent upper workout",
    timeMinutes: 30,
    equipment: ["barbell", "bench", "rack"],
  }
  const context = buildGenerationContext(database.db, input)
  database.db
    .insert(onDemandWorkoutGenerationRequest)
    .values({
      id: input.requestId,
      requestHash: "e2e",
      input,
      context,
      status: "calling",
      quotaDay: "2026-10-19",
      callStartedAt: new Date(),
      updatedAt: new Date(),
    })
    .run()
  const result = finalizeGenerationReceipt(database.db, {
    version: 1,
    requestId: input.requestId,
    requestHash: "e2e",
    input,
    context,
    receivedAt: new Date().toISOString(),
    response: {
      status: "workout",
      title: "On-demand upper",
      focus: context.constraints.focus,
      reasoning: "A short independent workout.",
      resolvedConstraints: context.constraints,
      estimatedDurationSeconds: 1,
      exercises: [
        {
          exerciseId: ex.id,
          sets: 2,
          repRange: "8-10",
          loadKg: 20,
          rirTarget: 2,
          restSeconds: 60,
          coachNote: "Controlled repetitions.",
        },
      ],
    },
  })
  if (result.status !== "saved" || !result.preview)
    throw new Error("Fixture generation failed.")
  preview = result.preview
})
test.afterEach(() => database.sqlite.close())

test("cold offline launch, durable rest/resume, completion, feedback and tombstone replay", async ({
  page,
  context,
}) => {
  const programBefore = database.db.select().from(plannedExercise).all()
  await page.goto(`/on-demand-workouts/${preview.id}`)
  await expect(
    page.getByRole("heading", { name: "On-demand upper" })
  ).toBeVisible()
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
  })
  await expect
    .poll(() =>
      page.evaluate(() => Boolean(navigator.serviceWorker.controller))
    )
    .toBe(true)
  await context.setOffline(true)
  await page.close()
  const offline = await context.newPage()
  await offline.goto(`/on-demand-workouts/${preview.id}`)
  await expect(
    offline.getByRole("heading", { name: "On-demand upper" })
  ).toBeVisible()
  await offline
    .getByRole("button", { name: "Start workout", exact: true })
    .click()
  await expect(offline).toHaveURL(/\/workout\//)
  const runId = offline.url().split("/").at(-1)!
  await offline.getByRole("button", { name: "Complete Set & Rest" }).click()
  await expect(offline.getByText("Resting", { exact: true })).toBeVisible()
  await offline.reload()
  await expect(offline.getByText("Resting", { exact: true })).toBeVisible()
  await offline.getByRole("button", { name: "Skip", exact: true }).click()
  await offline
    .getByRole("button", { name: "Complete Workout", exact: true })
    .click()
  await expect(offline).toHaveURL(new RegExp(`/feedback/${runId}$`))
  await expect(
    offline.getByText(/Saved on this device; sync pending/).first()
  ).toBeVisible()
  await offline
    .getByRole("textbox", { name: "Training Notes" })
    .fill("Completed offline.")
  await offline.getByRole("button", { name: "Save & Finish" }).click()
  await expect(offline).toHaveURL(/\/on-demand-workouts\/?$/)
  await expect(offline.getByText("1 completed", { exact: true })).toBeVisible()
  // Another device deletes the definition while this device is disconnected.
  deleteOnDemandWorkoutOperation(database.db, preview.id)
  await context.setOffline(false)
  await offline.getByRole("button", { name: "Retry sync" }).click()
  await expect
    .poll(
      () =>
        database.db
          .select()
          .from(workoutLog)
          .where(eq(workoutLog.id, runId))
          .get()?.notes
    )
    .toBe("Completed offline.")
  expect(
    database.db
      .select()
      .from(setLog)
      .where(eq(setLog.workoutLogId, runId))
      .all()
  ).toHaveLength(2)
  expect(database.db.select().from(plannedExercise).all()).toEqual(
    programBefore
  )
  await offline.getByRole("button", { name: "Retry sync" }).click()
  await offline.reload()
  await expect(
    offline.getByRole("heading", { name: "On-demand workouts", exact: true })
  ).toBeVisible()
  await expect(
    offline.getByText("On-demand upper", { exact: true })
  ).toHaveCount(0)
  expect(
    database.db
      .select()
      .from(setLog)
      .where(eq(setLog.workoutLogId, runId))
      .all()
  ).toHaveLength(2)
})

test("a failed device transaction cannot advance a set or lose the retry", async ({
  page,
}) => {
  await page.goto(`/on-demand-workouts/${preview.id}`)
  await page.getByRole("button", { name: "Start workout", exact: true }).click()
  await expect(
    page.getByRole("button", { name: "Complete Set & Rest" })
  ).toBeVisible()
  await page.evaluate(() => {
    // The test wrapper explicitly applies the original method with its object-store receiver.
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const original = IDBObjectStore.prototype.put
    IDBObjectStore.prototype.put = function (
      ...args: Parameters<IDBObjectStore["put"]>
    ) {
      if (this.name === "sets")
        throw new DOMException("Device storage full", "QuotaExceededError")
      return original.apply(this, args)
    }
  })
  await page.getByRole("button", { name: "Complete Set & Rest" }).click()
  await expect(
    page.getByText(/Failed to save set on this device/)
  ).toBeVisible()
  await expect(page.getByText("Resting", { exact: true })).toHaveCount(0)
  await page.reload()
  await expect(page.getByText("Set 1", { exact: false }).first()).toBeVisible()
  await page.getByRole("button", { name: "Complete Set & Rest" }).click()
  await expect(page.getByText("Resting", { exact: true })).toBeVisible()
})

test("a pending local deletion cannot be resurrected by a stale online library page", async ({
  page,
  context,
}) => {
  await page.goto(`/on-demand-workouts/${preview.id}`)
  await expect(
    page.getByRole("heading", { name: "On-demand upper" })
  ).toBeVisible()
  await expect(
    page.getByText("Available offline on this device", { exact: true })
  ).toBeVisible()
  await context.setOffline(true)
  await page
    .getByRole("button", { name: "Delete from library", exact: true })
    .click()
  await page
    .getByRole("button", { name: "Delete workout", exact: true })
    .click()
  await expect(page).toHaveURL(/\/on-demand-workouts\/?$/)
  await page.route("**/_serverFn/**", (route) =>
    route.request().method() === "POST" ? route.abort() : route.continue()
  )
  await context.setOffline(false)
  await page.reload()
  await expect(
    page.getByRole("heading", { name: "On-demand workouts", exact: true })
  ).toBeVisible()
  await expect(page.getByText("On-demand upper", { exact: true })).toHaveCount(
    0
  )
  await page.unroute("**/_serverFn/**")
  await page.getByRole("button", { name: "Retry sync" }).click()
  const { onDemandWorkout } = await import("../lib/schema")
  await expect
    .poll(
      () =>
        database.db
          .select()
          .from(onDemandWorkout)
          .where(eq(onDemandWorkout.id, preview.id))
          .get()?.deletedAt !== null
    )
    .toBe(true)
})
