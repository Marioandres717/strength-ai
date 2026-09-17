import { Link, useRouter } from "@tanstack/react-router"
import { useState } from "react"
import { type DashboardState } from "../functions/getDashboardData"
import { saveUnitsFn } from "../functions/saveUnits"
import { swapWorkoutDaysFn } from "../functions/swapWorkoutDays"
import type { WeightUnit } from "../lib/weightUnits"
import { ProgramHeader } from "./dashboard/ProgramHeader"
import { NextSessionCard } from "./dashboard/NextSessionCard"
import { WeekGrid } from "./dashboard/WeekGrid"
import { WeekProgressBar } from "./dashboard/WeekProgressBar"
import { ProgramFooter } from "./dashboard/ProgramFooter"

interface DashboardPageProps {
  data: DashboardState
}

export function DashboardPage({ data }: DashboardPageProps) {
  const router = useRouter()
  const [selectedSessionId, setSelectedSessionId] = useState("")
  const [targetSessionId, setTargetSessionId] = useState("")
  const [actionError, setActionError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  if (data.kind === "no_program") {
    return (
      <div className="bg-bg min-h-screen">
        <div className="mx-auto flex max-w-md flex-col items-center justify-center px-6 py-24 text-center">
          <p className="text-muted mb-2 text-xs font-semibold tracking-widest uppercase">
            No active program
          </p>
          <p className="text-muted mb-6 text-sm">
            You don&apos;t have an active training program yet.
          </p>
          <Link
            to="/onboarding"
            className="bg-accent rounded-2xl px-6 py-3 text-sm font-bold text-black transition-opacity hover:opacity-90"
          >
            Generate your plan →
          </Link>
        </div>
      </div>
    )
  }

  if (data.kind !== "active") {
    return null
  }

  const { profile, program, currentWeek, sessionsThisWeek, nextSession } = data
  const eligibleSessions = sessionsThisWeek.filter(
    (session) =>
      session.workoutLog?.completedAt == null && !session.hasLoggedSets
  )

  const changeUnits = async (units: WeightUnit) => {
    if (units === profile.units || saving) return
    setSaving(true)
    setActionError(null)
    try {
      await saveUnitsFn({ data: { profileId: profile.id, units } })
      await router.invalidate()
    } catch {
      setActionError("Could not save units. Try again.")
    } finally {
      setSaving(false)
    }
  }

  const swapDays = async () => {
    if (!selectedSessionId || !targetSessionId || saving) return
    setSaving(true)
    setActionError(null)
    try {
      await swapWorkoutDaysFn({
        data: {
          firstSessionId: selectedSessionId,
          secondSessionId: targetSessionId,
        },
      })
      setSelectedSessionId("")
      setTargetSessionId("")
      await router.invalidate()
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "Could not save the swap. Try again."
      )
    } finally {
      setSaving(false)
    }
  }

  const doneSessions = sessionsThisWeek.filter(
    (s) => s.workoutLog?.completedAt != null
  )
  const weekDone =
    sessionsThisWeek.length > 0 &&
    doneSessions.length === sessionsThisWeek.length
  const programComplete = currentWeek > program.weeksTotal

  return (
    <div className="bg-bg min-h-screen">
      <div className="mx-auto max-w-md px-6 pt-8 pb-16">
        {/* Program header */}
        <ProgramHeader
          program={program}
          currentWeek={currentWeek}
          sessionLengthMin={profile.sessionLengthMin}
        />

        <div className="mt-5 flex items-center justify-between gap-3">
          <span className="text-muted text-sm">Weight units</span>
          <div
            role="group"
            aria-label="Weight units"
            className="border-border flex rounded-xl border p-1"
          >
            {(["kg", "lbs"] as const).map((units) => (
              <button
                key={units}
                type="button"
                aria-pressed={profile.units === units}
                disabled={saving}
                onClick={() => void changeUnits(units)}
                className={`rounded-lg px-4 py-2 text-sm font-semibold ${profile.units === units ? "bg-accent text-black" : "text-muted"}`}
              >
                {units}
              </button>
            ))}
          </div>
        </div>

        <div className="border-border my-8 border-t" />

        {/* Next session / week-done / program-done */}
        {programComplete ? (
          <ProgramCompleteState />
        ) : weekDone ? (
          <WeekCompleteState
            currentWeek={currentWeek}
            weeksTotal={program.weeksTotal}
          />
        ) : (
          <NextSessionCard
            session={nextSession!}
            sessionLengthMin={profile.sessionLengthMin}
          />
        )}

        <div className="border-border my-8 border-t" />

        {/* This week */}
        <section>
          <p className="text-muted mb-3 text-xs font-semibold tracking-widest uppercase">
            This Week
          </p>
          <WeekGrid sessions={sessionsThisWeek} nextSession={nextSession} />
          {eligibleSessions.length >= 2 && (
            <div className="mt-4 flex flex-col gap-2">
              <p className="text-muted text-xs font-semibold tracking-widest uppercase">
                Swap workout days
              </p>
              <div className="flex gap-2">
                <select
                  aria-label="First workout"
                  value={selectedSessionId}
                  onChange={(event) => setSelectedSessionId(event.target.value)}
                  className="border-border bg-surface min-w-0 flex-1 rounded-xl border p-2 text-sm text-white"
                >
                  <option value="">Choose workout</option>
                  {eligibleSessions.map((session) => (
                    <option
                      key={session.template.id}
                      value={session.template.id}
                    >
                      {session.template.dayLabel}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="Second workout"
                  value={targetSessionId}
                  onChange={(event) => setTargetSessionId(event.target.value)}
                  className="border-border bg-surface min-w-0 flex-1 rounded-xl border p-2 text-sm text-white"
                >
                  <option value="">Swap with</option>
                  {eligibleSessions
                    .filter(
                      (session) => session.template.id !== selectedSessionId
                    )
                    .map((session) => (
                      <option
                        key={session.template.id}
                        value={session.template.id}
                      >
                        {session.template.dayLabel}
                      </option>
                    ))}
                </select>
              </div>
              <button
                type="button"
                disabled={
                  !selectedSessionId ||
                  !targetSessionId ||
                  selectedSessionId === targetSessionId ||
                  saving
                }
                onClick={() => void swapDays()}
                className="border-border bg-surface rounded-xl border px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {saving ? "Saving..." : "Swap days"}
              </button>
            </div>
          )}
          {actionError && (
            <p role="alert" className="mt-3 text-sm text-red-300">
              {actionError}
            </p>
          )}
          <WeekProgressBar
            done={doneSessions.length}
            total={sessionsThisWeek.length}
          />
        </section>

        <div className="border-border my-8 border-t" />

        <ProgramFooter program={program} />
      </div>
    </div>
  )
}

function WeekCompleteState({
  currentWeek,
  weeksTotal,
}: {
  currentWeek: number
  weeksTotal: number
}) {
  const isLastWeek = currentWeek >= weeksTotal
  return (
    <div className="border-border bg-surface rounded-2xl border p-5">
      <p className="text-muted mb-2 text-xs font-semibold tracking-widest uppercase">
        Week {currentWeek} complete
      </p>
      <p className="mb-1 text-xl font-bold text-white">All sessions done!</p>
      <p className="text-muted text-sm">
        {isLastWeek
          ? "You&apos;ve finished the final week of this program."
          : `Week ${currentWeek + 1} starts next week — rest up.`}
      </p>
    </div>
  )
}

function ProgramCompleteState() {
  return (
    <div className="border-border bg-surface rounded-2xl border p-5">
      <p className="text-muted mb-2 text-xs font-semibold tracking-widest uppercase">
        Program complete
      </p>
      <p className="mb-1 text-xl font-bold text-white">
        You finished the program!
      </p>
      <p className="text-muted mb-5 text-sm">
        Ready for your next challenge? Generate a new program to keep
        progressing.
      </p>
      <Link
        to="/onboarding"
        className="bg-accent inline-block rounded-2xl px-5 py-2.5 text-sm font-bold text-black transition-opacity hover:opacity-90"
      >
        Start a new program →
      </Link>
    </div>
  )
}
