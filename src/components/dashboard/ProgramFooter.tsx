import type { SelectProgram } from "../../../lib/schema"

interface ProgramFooterProps {
  program: SelectProgram
}

export function ProgramFooter({ program }: ProgramFooterProps) {
  return (
    <div className="flex flex-col gap-4">
      <a
        href="/plan"
        className="text-accent text-sm font-semibold transition-opacity hover:opacity-70"
      >
        View full plan →
      </a>

      <details data-testid="ai-rationale-details" className="group">
        <summary className="text-muted cursor-pointer list-none text-sm font-semibold transition-colors select-none hover:text-white">
          <span className="mr-1 inline-block transition-transform group-open:rotate-90">
            ▶
          </span>
          AI Rationale
        </summary>
        <p className="text-muted mt-3 text-sm leading-relaxed">
          {program.aiRationale}
        </p>
      </details>
    </div>
  )
}
