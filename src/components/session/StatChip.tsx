interface StatChipProps {
  label: string
  value: string | number
  unit?: string
}

export function StatChip({ label, value, unit }: StatChipProps) {
  return (
    <div className="border-border bg-bg flex min-w-20 flex-col items-center rounded-2xl border px-4 py-3">
      <span className="text-xl font-bold text-white tabular-nums">
        {value}
        {unit && <span className="ml-0.5 text-base font-semibold">{unit}</span>}
      </span>
      <span className="text-muted mt-0.5 text-xs">{label}</span>
    </div>
  )
}
