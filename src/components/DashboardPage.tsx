import { Link } from "@tanstack/react-router"
import { type DashboardState } from "../functions/getDashboardData"
import { ProgramHeader } from "./dashboard/ProgramHeader"
import { NextSessionCard } from "./dashboard/NextSessionCard"
import { WeekGrid } from "./dashboard/WeekGrid"
import { WeekProgressBar } from "./dashboard/WeekProgressBar"
import { ProgramFooter } from "./dashboard/ProgramFooter"

interface DashboardPageProps {
  data: DashboardState
}

export function DashboardPage({ data }: DashboardPageProps) {
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
