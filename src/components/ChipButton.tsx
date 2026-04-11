import type React from "react"

export interface ChipButtonProps {
  label: string
  sublabel?: string
  badge?: string
  selected: boolean
  onSelect: () => void
}

export function ChipButton({
  label,
  sublabel,
  badge,
  selected,
  onSelect,
}: ChipButtonProps): React.JSX.Element {
  return (
    <button
      onClick={onSelect}
      aria-label={sublabel ? `${label} ${sublabel}` : label}
      aria-pressed={selected}
      className={`relative flex flex-1 cursor-pointer flex-col items-center justify-center rounded-2xl border px-2 py-3 transition-all duration-200 ${
        selected
          ? "border-accent bg-surface-selected"
          : "border-border bg-surface hover:border-border-hover"
      }`}
    >
      {badge && (
        <span className="bg-accent absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full px-2 py-0.5 text-[10px] font-semibold text-black">
          {badge}
        </span>
      )}
      <span className="text-xl leading-none font-bold text-white">{label}</span>
      {sublabel && <span className="text-muted mt-1 text-xs">{sublabel}</span>}
    </button>
  )
}
