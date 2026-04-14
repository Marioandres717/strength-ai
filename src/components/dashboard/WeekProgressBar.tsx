interface WeekProgressBarProps {
  done: number
  total: number
}

export function WeekProgressBar({ done, total }: WeekProgressBarProps) {
  const pct = total === 0 ? 0 : (done / total) * 100

  return (
    <div className="mt-4">
      <p className="text-muted mb-2 text-sm">
        {done} of {total} sessions this week
      </p>
      <div className="bg-border h-1 w-full overflow-hidden rounded-full">
        <div
          data-testid="week-progress-fill"
          className="bg-accent h-full rounded-full transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
