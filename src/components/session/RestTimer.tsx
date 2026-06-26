interface RestTimerProps {
  secondsRemaining: number
  secondsTotal: number
  onAdjust: (delta: number) => void
  onSkip: () => void
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
}

export function RestTimer({
  secondsRemaining,
  secondsTotal,
  onAdjust,
  onSkip,
}: RestTimerProps) {
  const radius = 52
  const circumference = 2 * Math.PI * radius
  const progress = secondsTotal > 0 ? secondsRemaining / secondsTotal : 0
  const dashOffset = circumference * (1 - progress)

  return (
    <div className="flex flex-col items-center gap-5">
      {/* Circular timer */}
      <div className="relative flex items-center justify-center">
        <svg
          width="136"
          height="136"
          viewBox="0 0 136 136"
          className="-rotate-90"
          aria-hidden="true"
        >
          {/* Track */}
          <circle
            cx="68"
            cy="68"
            r={radius}
            fill="none"
            stroke="var(--color-border, #2a2a2a)"
            strokeWidth="4"
          />
          {/* Progress arc */}
          <circle
            cx="68"
            cy="68"
            r={radius}
            fill="none"
            stroke="var(--color-accent, #4fb8b2)"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            style={{ transition: "stroke-dashoffset 1s linear" }}
          />
        </svg>

        {/* Time display */}
        <div className="absolute flex flex-col items-center">
          <span className="text-3xl font-bold text-white tabular-nums">
            {formatTime(secondsRemaining)}
          </span>
          <span className="text-muted text-xs">Resting</span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => onAdjust(-30)}
          className="text-muted rounded-xl px-3 py-2 text-sm transition-colors hover:text-white"
        >
          -30s
        </button>
        <button
          type="button"
          onClick={() => onAdjust(30)}
          className="text-muted rounded-xl px-3 py-2 text-sm transition-colors hover:text-white"
        >
          +30s
        </button>
        <button
          type="button"
          onClick={onSkip}
          className="text-muted rounded-xl px-3 py-2 text-sm transition-colors hover:text-white"
        >
          Skip
        </button>
      </div>
    </div>
  )
}
