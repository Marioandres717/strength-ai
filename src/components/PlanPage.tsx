import { useState } from "react"
import type { PlanDataState, PlanSession } from "../functions/getPlanData"
import { Button } from "./ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card"

const FOCUS_LABELS: Record<string, string> = {
  strength: "Strength",
  hypertrophy: "Hypertrophy",
  mixed: "Mixed",
}

interface PlanPageProps {
  data: Extract<PlanDataState, { kind: "active" }>
}

export function PlanPage({ data }: PlanPageProps) {
  const { profile, program, currentWeek, sessionsByWeek } = data
  const [selectedWeek, setSelectedWeek] = useState(currentWeek)
  const weeks = Array.from(
    { length: program.weeksTotal },
    (_, index) => index + 1
  )
  const sessions = sessionsByWeek[selectedWeek] ?? []

  return (
    <main className="bg-bg min-h-screen">
      <div className="mx-auto flex max-w-md flex-col gap-8 px-6 pt-8 pb-16">
        <section>
          <p className="text-muted mb-2 text-xs font-semibold tracking-widest uppercase">
            Program
          </p>
          <h1 className="mb-1 text-3xl leading-tight font-bold text-white">
            {program.name}
          </h1>
          <p className="text-muted text-sm">
            Week {currentWeek} of {program.weeksTotal} ·{" "}
            {program.sessionsPerWeek} sessions/week · ~
            {profile.sessionLengthMin} min
          </p>
        </section>

        <details
          data-testid="plan-rationale"
          className="border-border bg-surface rounded-2xl border p-5"
        >
          <summary className="cursor-pointer list-none text-xs font-semibold tracking-widest text-white uppercase">
            AI program rationale
          </summary>
          <p className="text-muted mt-3 text-sm leading-relaxed">
            {program.aiRationale}
          </p>
        </details>

        <section aria-labelledby="week-selector-heading">
          <p
            id="week-selector-heading"
            className="text-muted mb-3 text-xs font-semibold tracking-widest uppercase"
          >
            Week
          </p>
          <div
            className="-mx-6 flex gap-2 overflow-x-auto px-6 pb-1"
            role="tablist"
            aria-label="Program week"
          >
            {weeks.map((week) => (
              <Button
                key={week}
                type="button"
                variant={selectedWeek === week ? "default" : "outline"}
                size="sm"
                role="tab"
                aria-selected={selectedWeek === week}
                onClick={() => setSelectedWeek(week)}
                className={
                  selectedWeek === week
                    ? "bg-accent hover:bg-accent/90 text-black"
                    : "border-border bg-surface text-muted hover:bg-surface-selected hover:text-white"
                }
              >
                Week {week}
              </Button>
            ))}
          </div>
        </section>

        <section aria-labelledby="selected-week-heading">
          <h2
            id="selected-week-heading"
            className="mb-1 text-2xl font-bold text-white"
          >
            Week {selectedWeek}
          </h2>
          <p className="text-muted mb-4 text-sm">
            {sessions.length} {sessions.length === 1 ? "session" : "sessions"} ·{" "}
            {weekFocus(sessions)} focus
          </p>
          <div className="flex flex-col gap-3">
            {sessions.map((session) => (
              <SessionCard
                key={session.template.id}
                session={session}
                sessionLengthMin={profile.sessionLengthMin}
              />
            ))}
            {sessions.length === 0 && (
              <Card className="border-border bg-surface gap-0 py-0 shadow-none">
                <CardContent className="text-muted px-5 py-5 text-sm">
                  No sessions are scheduled for this week.
                </CardContent>
              </Card>
            )}
          </div>
        </section>
      </div>
    </main>
  )
}

function SessionCard({
  session,
  sessionLengthMin,
}: {
  session: PlanSession
  sessionLengthMin: number
}) {
  const [expanded, setExpanded] = useState(false)
  const { template, exercises } = session

  return (
    <Card className="border-border bg-surface gap-0 py-0 shadow-none">
      <CardHeader className="gap-3 px-5 py-5">
        <div>
          <CardTitle className="text-sm font-semibold tracking-widest text-white uppercase">
            {template.dayLabel}
          </CardTitle>
          <p className="text-muted mt-1 text-sm">
            {exercises.length} exercises · ~{sessionLengthMin} min
          </p>
        </div>
        <span className="bg-accent/10 text-accent rounded-full px-3 py-1 text-xs font-semibold">
          {FOCUS_LABELS[template.focus] ?? template.focus}
        </span>
      </CardHeader>
      {expanded && (
        <CardContent className="border-border flex flex-col gap-4 border-t px-5 py-5">
          {exercises.map(({ exercise, planned }) => (
            <article key={planned.id} className="flex flex-col gap-1">
              <h3 className="font-semibold text-white">{exercise.name}</h3>
              <p className="text-muted text-sm">
                {planned.sets} × {planned.repRange} ·{" "}
                {formatLoad(planned.loadKg)} · {planned.rirTarget} RIR
              </p>
              <p className="text-muted text-sm">
                Rest {formatRest(planned.restSeconds)}
              </p>
              {planned.coachNote && (
                <details
                  data-testid={`coach-note-${planned.id}`}
                  className="mt-1"
                >
                  <summary className="text-accent cursor-pointer text-sm font-semibold">
                    Coach note
                  </summary>
                  <p className="text-muted mt-2 text-sm leading-relaxed">
                    {planned.coachNote}
                  </p>
                </details>
              )}
            </article>
          ))}
        </CardContent>
      )}
      <div className="px-5 pb-5">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setExpanded((value) => !value)}
          className="border-border hover:bg-surface-selected bg-transparent text-white hover:text-white"
        >
          {expanded ? "Hide session" : "View session"}
        </Button>
      </div>
    </Card>
  )
}

function weekFocus(sessions: PlanSession[]) {
  const focuses = new Set(sessions.map((session) => session.template.focus))
  if (focuses.size !== 1) return "Mixed"
  const [focus] = focuses
  return FOCUS_LABELS[focus] ?? focus
}

function formatLoad(loadKg: number) {
  return `${Number.isInteger(loadKg) ? loadKg : loadKg.toFixed(1)} kg`
}

function formatRest(restSeconds: number) {
  const minutes = Math.floor(restSeconds / 60)
  const seconds = restSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, "0")}`
}
