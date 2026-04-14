import type { SelectProgram } from "../../../lib/schema"

interface ProgramHeaderProps {
  program: SelectProgram
  currentWeek: number
  sessionLengthMin: number
}

export function ProgramHeader({
  program,
  currentWeek,
  sessionLengthMin,
}: ProgramHeaderProps) {
  return (
    <div>
      <p className="text-muted mb-2 text-xs font-semibold tracking-widest uppercase">
        Week {currentWeek} of {program.weeksTotal}
      </p>
      <h1 className="mb-1 text-3xl leading-tight font-bold text-white">
        {program.name}
      </h1>
      <p className="text-muted text-sm">
        {program.sessionsPerWeek} days&nbsp;·&nbsp;{sessionLengthMin} min
        sessions
      </p>
    </div>
  )
}
