import type { ReactNode } from "react"
import type { SessionWithExercises } from "../../functions/getDashboardData"
import { FOCUS_LABELS } from "./NextSessionCard"

interface WeekGridProps {
  sessions: SessionWithExercises[]
  nextSession: SessionWithExercises | null
}

type SessionStatus = "completed" | "next" | "skipped" | "upcoming"

function getStatus(
  session: SessionWithExercises,
  index: number,
  nextIndex: number | null
): SessionStatus {
  if (session.workoutLog?.completedAt != null) return "completed"
  if (nextIndex !== null && index === nextIndex) return "next"
  if (nextIndex !== null && index < nextIndex) return "skipped"
  return "upcoming"
}

const STATUS_ICON: Record<SessionStatus, ReactNode> = {
  completed: (
    <svg
      className="text-accent mx-auto h-4 w-4"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        d="M5 13l4 4L19 7"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  next: <span className="bg-accent mx-auto block h-2 w-2 rounded-full" />,
  skipped: <span className="mx-auto block h-2 w-2 rounded-full bg-amber-400" />,
  upcoming: (
    <span className="border-muted-dim mx-auto block h-2 w-2 rounded-full border" />
  ),
}

const STATUS_LABEL: Record<SessionStatus, string> = {
  completed: "Done",
  next: "Next",
  skipped: "Missed",
  upcoming: "—",
}

const STATUS_LABEL_COLOR: Record<SessionStatus, string> = {
  completed: "text-accent",
  next: "text-accent",
  skipped: "text-amber-400",
  upcoming: "text-muted-dim",
}

export function WeekGrid({ sessions, nextSession }: WeekGridProps) {
  const nextIndex = nextSession
    ? sessions.findIndex((s) => s.template.id === nextSession.template.id)
    : null

  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {sessions.map((session, i) => {
        const status = getStatus(session, i, nextIndex)

        return (
          <div
            key={session.template.id}
            data-testid={`week-grid-cell-${status}`}
            className={[
              "flex min-w-18 shrink-0 flex-col items-center gap-1.5 rounded-xl border p-3 text-center transition",
              status === "next"
                ? "border-accent bg-surface-selected"
                : "border-border bg-surface",
              status === "completed" ? "opacity-60" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <p className="text-muted text-[0.65rem] font-bold tracking-widest">
              {FOCUS_LABELS[session.template.focus] ?? session.template.focus}
            </p>
            <div className="flex h-4 w-full items-center justify-center">
              {STATUS_ICON[status]}
            </div>
            <p className="text-muted line-clamp-1 w-full text-[0.6rem] font-medium">
              {session.template.dayLabel}
            </p>
            <p
              className={`text-[0.6rem] font-semibold ${STATUS_LABEL_COLOR[status]}`}
            >
              {STATUS_LABEL[status]}
            </p>
          </div>
        )
      })}
    </div>
  )
}
