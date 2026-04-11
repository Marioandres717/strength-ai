import type React from "react"

interface Props {
  current: 1 | 2 | 3 | 4 | 5
}

export function StepIndicator({ current }: Props): React.JSX.Element {
  return (
    <div className="flex gap-1.5">
      {([1, 2, 3, 4, 5] as const).map((n) => (
        <div
          key={n}
          data-testid="step-bar"
          className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
            n <= current ? "bg-accent" : "bg-border"
          }`}
        />
      ))}
    </div>
  )
}
