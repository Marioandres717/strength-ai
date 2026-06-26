interface SpinnerInputProps {
  label: string
  value: number
  step: number
  min: number
  max: number
  unit: string
  hint?: string
  onChange: (v: number) => void
}

export function SpinnerInput({
  label,
  value,
  step,
  min,
  max,
  unit,
  hint,
  onChange,
}: SpinnerInputProps) {
  const decrement = () => onChange(Math.max(min, value - step))
  const increment = () => onChange(Math.min(max, value + step))

  // Format display: show one decimal for non-integers, whole number otherwise
  const display = Number.isInteger(value) ? String(value) : value.toFixed(1)

  return (
    <div className="flex items-center justify-between gap-4">
      {/* Label + hint */}
      <div className="w-20 shrink-0">
        <p className="text-sm font-semibold text-white">{label}</p>
        {hint && <p className="text-muted mt-0.5 text-xs">{hint}</p>}
      </div>

      {/* Spinner */}
      <div className="flex flex-1 items-center justify-end gap-3">
        <button
          type="button"
          onClick={decrement}
          disabled={value <= min}
          aria-label={`Decrease ${label}`}
          className="border-border bg-surface flex h-14 w-14 items-center justify-center rounded-xl border text-2xl font-light text-white transition-opacity active:scale-95 disabled:opacity-30"
        >
          −
        </button>

        <div className="flex min-w-20 flex-col items-center">
          <output className="text-4xl leading-none font-bold text-white tabular-nums">
            {display}
          </output>
          <span className="text-muted mt-1 text-xs tracking-wide uppercase">
            {unit}
          </span>
        </div>

        <button
          type="button"
          onClick={increment}
          disabled={value >= max}
          aria-label={`Increase ${label}`}
          className="border-border bg-surface flex h-14 w-14 items-center justify-center rounded-xl border text-2xl font-light text-white transition-opacity active:scale-95 disabled:opacity-30"
        >
          +
        </button>
      </div>
    </div>
  )
}
