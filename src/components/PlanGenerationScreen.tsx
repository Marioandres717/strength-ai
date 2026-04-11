import type React from "react"
import { useEffect, useRef, useState } from "react"
import { generatePlanFn } from "../functions/generatePlan"
import type { WizardData } from "../types/wizard"

// ── Constants ──────────────────────────────────────────────────────────────────

const LOADING_STEPS = [
  "Analyzing variables",
  "Structuring progression",
  "Generating schedule",
]

// ── Component ──────────────────────────────────────────────────────────────────

interface Props {
  data: WizardData
  onSuccess: (programId: string) => void
  onError: (msg: string) => void
}

export function PlanGenerationScreen({
  data,
  onSuccess,
  onError,
}: Props): React.JSX.Element {
  const [completedSteps, setCompletedSteps] = useState<number[]>([])
  const called = useRef(false)

  useEffect(() => {
    // Animate first two steps with timers; third completes when AI resolves
    const t1 = setTimeout(() => setCompletedSteps([0]), 1500)
    const t2 = setTimeout(() => setCompletedSteps([0, 1]), 3000)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [])

  useEffect(() => {
    if (called.current) return
    called.current = true

    generatePlanFn({
      data: {
        goal: data.goal!,
        equipmentPreset: data.equipmentPreset!,
        experience: data.experience!,
        daysPerWeek: data.daysPerWeek!,
        sessionLengthMin: data.sessionLengthMin!,
        customDirectives: data.customDirectives,
      },
    })
      .then((result) => {
        setCompletedSteps([0, 1, 2])
        // Brief pause so the user sees all steps complete
        setTimeout(() => onSuccess(result.programId), 600)
      })
      .catch((err: unknown) => {
        const msg =
          err instanceof Error ? err.message : "An unexpected error occurred."
        onError(msg)
      })
  }, [data, onSuccess, onError])

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-10 py-12">
      {/* Animated spinner */}
      <div className="relative h-32 w-32">
        <svg
          className="h-full w-full -rotate-90 animate-spin"
          style={{ animationDuration: "2s" }}
          viewBox="0 0 120 120"
        >
          <circle
            cx="60"
            cy="60"
            r="50"
            fill="none"
            stroke="var(--color-border)"
            strokeWidth="8"
          />
          <circle
            cx="60"
            cy="60"
            r="50"
            fill="none"
            stroke="var(--color-accent)"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray="314"
            strokeDashoffset="220"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-3xl">✦</span>
        </div>
      </div>

      {/* Title */}
      <div className="text-center">
        <h2 className="mb-2 text-2xl font-bold text-white">
          Building your program...
        </h2>
        <p className="text-muted text-sm">
          Optimizing volume, intensity, and progression
        </p>
      </div>

      {/* Progress checklist */}
      <div className="w-full space-y-4">
        {LOADING_STEPS.map((stepLabel, i) => {
          const done = completedSteps.includes(i)
          const active = !done && completedSteps.length === i
          return (
            <div key={stepLabel} className="flex items-center gap-3">
              <div
                data-testid={`loading-step-${i}`}
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-all duration-500 ${
                  done
                    ? "bg-accent"
                    : active
                      ? "border-accent animate-pulse border-2"
                      : "border-border border-2"
                }`}
              >
                {done && (
                  <svg
                    className="h-3.5 w-3.5 text-black"
                    viewBox="0 0 14 14"
                    fill="none"
                  >
                    <path
                      d="M2 7l4 4 6-6"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </div>
              <span
                className={`text-sm font-medium transition-colors duration-300 ${
                  done ? "text-white" : active ? "text-white" : "text-muted-dim"
                }`}
              >
                {stepLabel}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
