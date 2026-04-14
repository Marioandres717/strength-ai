import type { SessionWithExercises } from "../../functions/getDashboardData"

interface NextSessionCardProps {
  session: SessionWithExercises
  sessionLengthMin: number
}

export const FOCUS_LABELS: Record<string, string> = {
  strength: "Strength",
  hypertrophy: "Hypertrophy",
  mixed: "Mixed",
}

export function NextSessionCard({
  session,
  sessionLengthMin,
}: NextSessionCardProps) {
  const { template, exercises } = session
  const previewExercises = exercises.slice(0, 3)
  const extraCount = exercises.length - 3

  return (
    <div>
      <p className="text-muted mb-3 text-xs font-semibold tracking-widest uppercase">
        Next Session
      </p>
      <div className="border-border bg-surface rounded-2xl border p-5">
        {/* Header */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <p className="text-muted text-xs font-semibold tracking-widest uppercase">
            {template.dayLabel}
          </p>
          <span className="bg-accent/10 text-accent rounded-full px-3 py-1 text-xs font-semibold">
            {FOCUS_LABELS[template.focus] ?? template.focus}
          </span>
        </div>

        {/* Exercise chips */}
        <div className="mb-5 flex flex-wrap gap-2">
          {previewExercises.map(({ exercise: ex, planned }) => (
            <div
              key={ex.id}
              className="border-border bg-border rounded-xl border px-3 py-2.5"
            >
              <p className="text-sm font-semibold text-white">{ex.name}</p>
              <p className="text-muted mt-0.5 text-xs">
                {planned.sets}×{planned.repRange}
              </p>
            </div>
          ))}
          {extraCount > 0 && (
            <div className="text-muted flex items-center px-1 text-sm">
              +{extraCount} more
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-muted flex items-center gap-1.5 text-sm">
            <svg
              className="h-4 w-4 shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" strokeWidth="2" />
              <path d="M12 6v6l4 2" strokeWidth="2" strokeLinecap="round" />
            </svg>
            ~{sessionLengthMin} min
          </div>
          <a
            href={`/session/${template.id}`}
            className="bg-accent rounded-2xl px-5 py-2.5 text-sm font-bold text-black transition-opacity hover:opacity-90"
          >
            Start Session →
          </a>
        </div>
      </div>
    </div>
  )
}
