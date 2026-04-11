import type React from "react"

export interface OptionCardProps {
  icon: string
  label: string
  sublabel?: string
  selected: boolean
  onSelect: () => void
}

export function OptionCard({
  icon,
  label,
  sublabel,
  selected,
  onSelect,
}: OptionCardProps): React.JSX.Element {
  return (
    <button
      onClick={onSelect}
      aria-pressed={selected}
      className={`flex w-full cursor-pointer items-center gap-4 rounded-2xl border p-4 text-left transition-all duration-200 ${
        selected
          ? "border-accent bg-surface-selected"
          : "border-border bg-surface hover:border-border-hover"
      }`}
    >
      <div className="bg-border flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xl">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="leading-snug font-semibold text-white">{label}</p>
        {sublabel && (
          <p
            data-testid="option-card-sublabel"
            className="text-muted mt-0.5 text-sm leading-snug"
          >
            {sublabel}
          </p>
        )}
      </div>
      <div
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors duration-200 ${
          selected ? "border-accent" : "border-border-hover"
        }`}
      >
        {selected && (
          <div
            data-testid="option-card-dot"
            className="bg-accent h-2.5 w-2.5 rounded-full"
          />
        )}
      </div>
    </button>
  )
}
