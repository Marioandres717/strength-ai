import { saveFeedbackFn } from "../functions/saveFeedback"
import type {
  SessionRun,
  PrescriptionRef,
  SessionExercise,
} from "../types/session"
import { setKey } from "../types/session"
import type {
  OnDemandWorkoutPreview,
  OnDemandWorkoutLibraryPage,
  StartWorkoutInput,
  GenerateOnDemandWorkoutInput,
  GenerationResult,
} from "../types/on-demand-workout"
import {
  idbRequest,
  repositoryAll,
  repositoryGet,
  repositoryPut,
  repositoryTransaction,
} from "./offline/workoutRepository"
import { getWorkoutRunFn } from "../functions/getWorkoutRun"
import { getOnDemandWorkoutFn } from "../functions/getOnDemandWorkout"
import { listOnDemandWorkoutsFn } from "../functions/listOnDemandWorkouts"
import { getFeedbackDataFn } from "../functions/getFeedbackData"
import type { GetFeedbackDataResult } from "../functions/getFeedbackData"
import { suggestLoad } from "../../lib/loadSuggestions"
import { prescriptionId } from "../types/session"

export interface SetCommit {
  prescriptionRef: PrescriptionRef
  setNumber: number
  weightKg: number
  reps: number
  rirActual: number
  loggedAt: Date
}
export interface LocalRun {
  run: Omit<SessionRun, "startedAt" | "persistedSets"> & { startedAt: string }
  completedAt: string | null
  acknowledged: boolean
  completionAcknowledged: boolean
  restDeadline: number | null
  restSeconds: number
  returnTo: "/" | "/on-demand-workouts"
}
export interface LocalSet extends Omit<SetCommit, "loggedAt"> {
  workoutLogId: string
  loggedAt: string
  setLogId: string
  acknowledged: boolean
}
export type OutboxCommand =
  | { kind: "start"; data: StartWorkoutInput }
  | { kind: "set"; data: Omit<LocalSet, "setLogId" | "acknowledged"> }
  | { kind: "complete"; data: { workoutLogId: string; completedAt: string } }
  | {
      kind: "feedback"
      data: {
        workoutLogId: string
        fatigueRating: number
        notes: string | null
      }
    }
  | { kind: "delete"; data: { onDemandWorkoutId: string } }
export interface OutboxEntry {
  key: string
  command: OutboxCommand
  createdAt: number
  attempts: number
  retryAt: number
  conflict: string | null
}
export interface CachedDefinition {
  preview: OnDemandWorkoutPreview
  tombstone: boolean
  cachedAt: number
}

export function queueCommand(
  tx: IDBTransaction,
  key: string,
  command: OutboxCommand
) {
  tx.objectStore("outbox").put(
    {
      key,
      command,
      createdAt: Date.now(),
      attempts: 0,
      retryAt: 0,
      conflict: null,
    } satisfies OutboxEntry,
    key
  )
}
function notifySync() {
  window.dispatchEvent(new Event("strength-workout-change"))
}

export async function cacheDefinition(preview: OnDemandWorkoutPreview) {
  await repositoryTransaction(["definitions", "revisions"], async (tx) => {
    const existing = (await idbRequest(
      tx.objectStore("definitions").get(preview.id)
    )) as CachedDefinition | undefined
    if (existing?.tombstone) return
    tx.objectStore("definitions").put(
      {
        preview,
        tombstone: false,
        cachedAt: Date.now(),
      } satisfies CachedDefinition,
      preview.id
    )
    tx.objectStore("revisions").put(preview, preview.revisionId)
  })
}
export async function loadDefinition(id: string) {
  if ((await repositoryGet<CachedDefinition>("definitions", id))?.tombstone)
    throw new Error("This workout has been deleted.")
  try {
    const preview = await getOnDemandWorkoutFn({
      data: { onDemandWorkoutId: id },
    })
    await cacheDefinition(preview)
    return refreshLocalLoads(preview)
  } catch (error) {
    const cached = await repositoryGet<CachedDefinition>("definitions", id)
    if (cached && !cached.tombstone) return refreshLocalLoads(cached.preview)
    throw error
  }
}
async function refreshLocalLoads(
  preview: OnDemandWorkoutPreview
): Promise<OnDemandWorkoutPreview> {
  const runs = await repositoryAll<LocalRun>("runs"),
    sets = await repositoryAll<LocalSet>("sets")
  const exercises = preview.exercises.map((entry) => {
    const exId = entry.exercise.id
    const local = runs
      .filter(
        (r) =>
          r.completedAt && r.run.exercises.some((e) => e.exercise.id === exId)
      )
      .sort(
        (a, b) => Date.parse(b.completedAt!) - Date.parse(a.completedAt!)
      )[0]
    if (
      !local ||
      (entry.prescription.loadHistoryAt &&
        Date.parse(entry.prescription.loadHistoryAt) >=
          Date.parse(local.completedAt!))
    )
      return entry
    const refs = new Set(
      local.run.exercises
        .filter((e) => e.exercise.id === exId)
        .map((e) => prescriptionId(e.prescription.ref))
    )
    const historySets = sets.filter(
      (s) =>
        s.workoutLogId === local.run.workoutLogId &&
        refs.has(prescriptionId(s.prescriptionRef))
    )
    const load = suggestLoad({
      baselineKg: entry.prescription.loadKg,
      units: preview.units,
      repRange: entry.prescription.repRange,
      rirTarget: entry.prescription.rirTarget,
      history: {
        workoutLogId: local.run.workoutLogId,
        completedAt: local.completedAt!,
        sets: historySets,
      },
    })
    return { ...entry, prescription: { ...entry.prescription, ...load } }
  })
  return {
    ...preview,
    exercises,
    snapshot: {
      ...preview.snapshot,
      exercises: preview.snapshot.exercises.map((e) => {
        const p = exercises.find(
          (x) =>
            prescriptionId(x.prescription.ref) === e.onDemandWorkoutExerciseId
        )!.prescription
        return {
          ...e,
          loadKg: p.loadKg,
          loadBasis: p.loadBasis!,
          loadHistoryAt: p.loadHistoryAt ?? null,
        }
      }),
    },
  }
}

export async function loadLibrary(cursor?: {
  createdAt: string
  id: string
}): Promise<OnDemandWorkoutLibraryPage> {
  try {
    const page = await listOnDemandWorkoutsFn({ data: { cursor } })
    const previous = await repositoryGet<OnDemandWorkoutLibraryPage>(
      "context",
      "library"
    )
    await repositoryPut("context", "library", {
      ...page,
      items: [
        ...(previous?.items ?? []).filter(
          (item) =>
            !page.items.some((next) => next.id === item.id) &&
            !page.tombstoneIds.includes(item.id)
        ),
        ...page.items,
      ],
    })
    for (const id of page.tombstoneIds)
      await repositoryTransaction(["definitions"], async (tx) => {
        const store = tx.objectStore("definitions"),
          row = (await idbRequest(store.get(id))) as
            | CachedDefinition
            | undefined
        if (row) store.put({ ...row, tombstone: true }, id)
      })
    // Full definitions, not list titles, make a workout runnable offline.
    await Promise.allSettled(
      page.items.map(async (item) =>
        cacheDefinition(
          await getOnDemandWorkoutFn({ data: { onDemandWorkoutId: item.id } })
        )
      )
    )
    return mergeLocalCounts(page)
  } catch (error) {
    const cached = await repositoryAll<CachedDefinition>("definitions")
    if (!cached.length) throw error
    const page = {
      items: cached
        .filter((d) => !d.tombstone)
        .map(({ preview: p }) => ({
          id: p.id,
          revisionId: p.revisionId,
          title: p.title,
          promptExcerpt: p.prompt.slice(0, 120),
          focus: p.focus,
          estimatedDurationSeconds: p.estimatedDurationSeconds,
          createdAt: p.createdAt,
          timesCompleted: 0,
          completedRunIds: [] as string[],
        })),
      tombstoneIds: cached.filter((d) => d.tombstone).map((d) => d.preview.id),
      nextCursor: null,
    }
    const previous = await repositoryGet<OnDemandWorkoutLibraryPage>(
      "context",
      "library"
    )
    for (const item of page.items) {
      const prior = previous?.items.find((i) => i.id === item.id)
      item.timesCompleted = prior?.timesCompleted ?? 0
      item.completedRunIds = prior?.completedRunIds ?? []
    }
    return mergeLocalCounts(page)
  }
}
async function mergeLocalCounts(page: OnDemandWorkoutLibraryPage) {
  const runs = await repositoryAll<LocalRun>("runs")
  const tombstones = new Set(
    (await repositoryAll<CachedDefinition>("definitions"))
      .filter((d) => d.tombstone)
      .map((d) => d.preview.id)
  )
  return {
    ...page,
    items: page.items
      .filter((item) => !tombstones.has(item.id))
      .map((item) => ({
        ...item,
        timesCompleted: new Set([
          ...(item.completedRunIds ?? []),
          ...runs
            .filter(
              (r) =>
                r.completedAt &&
                r.run.source.kind === "on_demand_workout" &&
                r.run.source.onDemandWorkoutId === item.id
            )
            .map((r) => r.run.workoutLogId),
        ]).size,
      })),
  }
}
export async function cacheRun(run: SessionRun) {
  const { persistedSets: _persisted, startedAt, ...staticRun } = run
  await repositoryTransaction(["runs", "sets"], async (tx) => {
    const existing = (await idbRequest(
      tx.objectStore("runs").get(run.workoutLogId)
    )) as LocalRun | undefined
    if (!existing)
      tx.objectStore("runs").put(
        {
          run: { ...staticRun, startedAt: new Date(startedAt).toISOString() },
          completedAt: null,
          acknowledged: true,
          completionAcknowledged: false,
          restDeadline: null,
          restSeconds: 0,
          returnTo: run.source.kind === "planned" ? "/" : "/on-demand-workouts",
        } satisfies LocalRun,
        run.workoutLogId
      )
    for (const s of run.persistedSets) {
      const key = `${run.workoutLogId}:${setKey(s.prescriptionRef, s.setNumber)}`
      const prior: unknown = await idbRequest(tx.objectStore("sets").get(key))
      if (!prior)
        tx.objectStore("sets").put(
          {
            ...s,
            workoutLogId: run.workoutLogId,
            loggedAt: new Date(s.loggedAt).toISOString(),
            acknowledged: true,
          } satisfies LocalSet,
          key
        )
    }
  })
}
export async function startLocalWorkout(
  preview: OnDemandWorkoutPreview
): Promise<string> {
  const cached = await repositoryGet<CachedDefinition>(
    "definitions",
    preview.id
  )
  if (cached?.tombstone) throw new Error("This workout has been deleted.")
  const id = crypto.randomUUID(),
    startedAt = new Date().toISOString()
  const run: LocalRun = {
    run: {
      workoutLogId: id,
      source: {
        kind: "on_demand_workout",
        onDemandWorkoutId: preview.id,
        onDemandWorkoutRevisionId: preview.revisionId,
      },
      title: preview.title,
      programName: null,
      units: preview.units,
      startedAt,
      exercises: preview.exercises,
      snapshot: preview.snapshot,
    },
    completedAt: null,
    acknowledged: false,
    completionAcknowledged: false,
    restDeadline: null,
    restSeconds: 0,
    returnTo: "/on-demand-workouts",
  }
  await repositoryTransaction(["runs", "outbox"], (tx) => {
    tx.objectStore("runs").put(run, id)
    queueCommand(tx, `${id}:start`, {
      kind: "start",
      data: {
        workoutLogId: id,
        source: run.run.source,
        startedAt,
        intent: "offline_replay",
        onDemandWorkoutRunSnapshot: preview.snapshot,
      },
    })
  })
  void navigator.storage?.persist?.().catch(() => false)
  notifySync()
  return id
}
export async function unfinishedRun(definitionId: string) {
  return (await repositoryAll<LocalRun>("runs"))
    .filter(
      (r) =>
        !r.completedAt &&
        r.run.source.kind === "on_demand_workout" &&
        r.run.source.onDemandWorkoutId === definitionId
    )
    .sort(
      (a, b) => Date.parse(b.run.startedAt) - Date.parse(a.run.startedAt)
    )[0]?.run.workoutLogId
}
export async function loadRun(id: string): Promise<SessionRun> {
  let local = await repositoryGet<LocalRun>("runs", id)
  if (!local) {
    await cacheRun(await getWorkoutRunFn({ data: { workoutLogId: id } }))
    local = await repositoryGet<LocalRun>("runs", id)
  }
  if (!local)
    throw new Error("This workout has not been downloaded on this device.")
  const sets = (await repositoryAll<LocalSet>("sets")).filter(
    (s) => s.workoutLogId === id
  )
  return {
    ...local.run,
    restDeadline: local.restDeadline,
    restSeconds: local.restSeconds,
    startedAt: new Date(local.run.startedAt),
    persistedSets: sets.map((s) => ({ ...s, loggedAt: new Date(s.loggedAt) })),
  }
}
export async function commitWorkoutSet(
  id: string,
  entry: SetCommit
): Promise<string> {
  const key = `${id}:${setKey(entry.prescriptionRef, entry.setNumber)}`
  await repositoryTransaction(["runs", "sets", "outbox"], async (tx) => {
    const run = (await idbRequest(tx.objectStore("runs").get(id))) as
      | LocalRun
      | undefined
    if (!run || run.completedAt)
      throw new Error("Workout cannot accept new sets.")
    const existing = (await idbRequest(tx.objectStore("sets").get(key))) as
      | LocalSet
      | undefined
    if (existing) {
      if (
        existing.weightKg !== entry.weightKg ||
        existing.reps !== entry.reps ||
        existing.rirActual !== entry.rirActual
      )
        throw new Error("Committed set cannot be changed.")
      return
    }
    const target = run.run.exercises.find(
      (e) =>
        setKey(e.prescription.ref, entry.setNumber) ===
        setKey(entry.prescriptionRef, entry.setNumber)
    )?.prescription
    if (!target || entry.setNumber < 1 || entry.setNumber > target.sets)
      throw new Error("Invalid prescribed set.")
    const set = {
      ...entry,
      workoutLogId: id,
      loggedAt: entry.loggedAt.toISOString(),
      setLogId: key,
      acknowledged: false,
    }
    tx.objectStore("sets").put(set, key)
    const { setLogId: _setId, acknowledged: _ack, ...data } = set
    queueCommand(tx, key, { kind: "set", data })
    tx.objectStore("runs").put(
      {
        ...run,
        restDeadline: Date.now() + target.restSeconds * 1000,
        restSeconds: target.restSeconds,
      },
      id
    )
  })
  notifySync()
  return key
}
export async function saveRestDeadline(
  id: string,
  deadline: number | null,
  seconds: number
) {
  await repositoryTransaction(["runs"], async (tx) => {
    const run = (await idbRequest(tx.objectStore("runs").get(id))) as
      | LocalRun
      | undefined
    if (run)
      tx.objectStore("runs").put(
        { ...run, restDeadline: deadline, restSeconds: seconds },
        id
      )
  })
}
export async function completeWorkoutLocally(id: string) {
  await repositoryTransaction(["runs", "sets", "outbox"], async (tx) => {
    const run = (await idbRequest(tx.objectStore("runs").get(id))) as
      | LocalRun
      | undefined
    if (!run) throw new Error("Workout is unavailable on this device.")
    if (run.completedAt) return
    const sets = (await idbRequest(
      tx.objectStore("sets").getAll()
    )) as LocalSet[]
    for (const e of run.run.exercises)
      for (let n = 1; n <= e.prescription.sets; n++)
        if (
          !sets.some(
            (s) =>
              s.workoutLogId === id &&
              setKey(s.prescriptionRef, s.setNumber) ===
                setKey(e.prescription.ref, n)
          )
        )
          throw new Error("Commit every prescribed set first.")
    const completedAt = new Date().toISOString()
    tx.objectStore("runs").put({ ...run, completedAt, restDeadline: null }, id)
    queueCommand(tx, `${id}:complete`, {
      kind: "complete",
      data: { workoutLogId: id, completedAt },
    })
  })
  notifySync()
  return { workoutLogId: id }
}
export async function loadWorkoutFeedback(
  id: string
): Promise<GetFeedbackDataResult> {
  const local = await repositoryGet<LocalRun>("runs", id)
  if (local?.completedAt) {
    try {
      if (local.completionAcknowledged)
        return await getFeedbackDataFn({ data: { workoutLogId: id } })
    } catch {
      /* Cached completion remains available. */
    }
    return {
      workoutLogId: id,
      sessionName: local.run.title,
      units: local.run.units,
      progressionChanges: [],
      returnTo: local.returnTo,
      pendingSync: !local.completionAcknowledged,
    }
  }
  return getFeedbackDataFn({ data: { workoutLogId: id } })
}
export async function saveWorkoutFeedback(data: {
  workoutLogId: string
  fatigueRating: number
  notes: string | null
}) {
  if (!(await getLocalRun(data.workoutLogId))) {
    await saveFeedbackFn({ data })
    return
  }
  await repositoryTransaction(["runs", "feedback", "outbox"], async (tx) => {
    const run = (await idbRequest(
      tx.objectStore("runs").get(data.workoutLogId)
    )) as LocalRun | undefined
    if (!run?.completedAt) throw new Error("Complete this workout first.")
    const normalized = {
      ...data,
      notes: data.notes?.trim() ? data.notes.trim().slice(0, 2000) : null,
    }
    tx.objectStore("feedback").put(
      { ...normalized, acknowledged: false },
      data.workoutLogId
    )
    queueCommand(tx, `${data.workoutLogId}:feedback`, {
      kind: "feedback",
      data: normalized,
    })
  })
  notifySync()
}
export async function deleteWorkoutLocally(id: string) {
  await repositoryTransaction(["definitions", "outbox"], async (tx) => {
    const cached = (await idbRequest(tx.objectStore("definitions").get(id))) as
      | CachedDefinition
      | undefined
    if (cached)
      tx.objectStore("definitions").put({ ...cached, tombstone: true }, id)
    queueCommand(tx, `${id}:delete`, {
      kind: "delete",
      data: { onDemandWorkoutId: id },
    })
  })
  notifySync()
}
export async function retainGenerationRequest(
  input: GenerateOnDemandWorkoutInput,
  result?: GenerationResult
) {
  await repositoryPut("generationRequests", input.requestId, {
    input,
    result: result ?? null,
  })
}
export async function getLocalRun(id: string) {
  return repositoryGet<LocalRun>("runs", id)
}
export type { SessionExercise }
