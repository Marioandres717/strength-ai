import type React from "react"
import { createFileRoute, useRouter } from "@tanstack/react-router"
import { useState } from "react"
import { ChipButton } from "../components/ChipButton"
import { OptionCard } from "../components/OptionCard"
import { PlanGenerationScreen } from "../components/PlanGenerationScreen"
import { StepIndicator } from "../components/StepIndicator"
import type {
  DaysPerWeek,
  EquipmentPreset,
  Experience,
  Goal,
  SessionLength,
  WizardData,
} from "../types/wizard"

export const Route = createFileRoute("/onboarding")({
  component: OnboardingPage,
})

// ── Types ──────────────────────────────────────────────────────────────────────

type Step = 1 | 2 | 3 | 4 | 5 | "loading"

interface SessionLengthOption {
  value: SessionLength
  label: string
  sublabel: string
  badge?: string
}

// ── Generic option-list step ───────────────────────────────────────────────────

interface OptionListStepProps<T extends string> {
  title: string
  options: { icon: string; label: string; sublabel?: string; value: T }[]
  value: T | undefined
  onChange: (v: T) => void
}

function OptionListStep<T extends string>({
  title,
  options,
  value,
  onChange,
}: OptionListStepProps<T>): React.JSX.Element {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-3xl leading-tight font-bold text-white">{title}</h1>
      <div className="flex flex-col gap-3">
        {options.map((o) => {
          function handleSelect() {
            onChange(o.value)
          }
          return (
            <OptionCard
              key={o.value}
              icon={o.icon}
              label={o.label}
              sublabel={o.sublabel}
              selected={value === o.value}
              onSelect={handleSelect}
            />
          )
        })}
      </div>
    </div>
  )
}

// ── Step 1: Goal ───────────────────────────────────────────────────────────────

const GOAL_OPTIONS: { icon: string; label: string; value: Goal }[] = [
  { icon: "🏋️", label: "Strength", value: "strength" },
  { icon: "📈", label: "Hypertrophy", value: "hypertrophy" },
  { icon: "⚖️", label: "Recomp", value: "recomp" },
  { icon: "🔥", label: "Fat Loss", value: "fat_loss" },
]

interface Step1Props {
  value: Goal | undefined
  onChange: (v: Goal) => void
}

function Step1({ value, onChange }: Step1Props): React.JSX.Element {
  return (
    <OptionListStep
      title="What's your goal?"
      options={GOAL_OPTIONS}
      value={value}
      onChange={onChange}
    />
  )
}

// ── Step 2: Equipment ──────────────────────────────────────────────────────────

const EQUIPMENT_OPTIONS: {
  icon: string
  label: string
  value: EquipmentPreset
}[] = [
  { icon: "🏢", label: "Full Gym", value: "full_gym" },
  { icon: "🏠", label: "Dumbbells Only", value: "dumbbells_only" },
  { icon: "🏡", label: "Home Gym", value: "home_gym" },
  { icon: "🎒", label: "Minimal Equipment", value: "minimal" },
]

interface Step2Props {
  value: EquipmentPreset | undefined
  onChange: (v: EquipmentPreset) => void
}

function Step2({ value, onChange }: Step2Props): React.JSX.Element {
  return (
    <OptionListStep
      title="What equipment do you have?"
      options={EQUIPMENT_OPTIONS}
      value={value}
      onChange={onChange}
    />
  )
}

// ── Step 3: Experience ─────────────────────────────────────────────────────────

const EXPERIENCE_OPTIONS: {
  icon: string
  label: string
  sublabel: string
  value: Experience
}[] = [
  {
    icon: "📊",
    label: "Beginner",
    sublabel: "0-1 years of consistent lifting",
    value: "beginner",
  },
  {
    icon: "📈",
    label: "Intermediate",
    sublabel: "1-3 years of consistent lifting",
    value: "intermediate",
  },
  {
    icon: "🏆",
    label: "Advanced",
    sublabel: "3+ years of serious lifting",
    value: "advanced",
  },
]

interface Step3Props {
  value: Experience | undefined
  onChange: (v: Experience) => void
}

function Step3({ value, onChange }: Step3Props): React.JSX.Element {
  return (
    <OptionListStep
      title="Your experience level"
      options={EXPERIENCE_OPTIONS}
      value={value}
      onChange={onChange}
    />
  )
}

// ── Step 4: Schedule ───────────────────────────────────────────────────────────

const DAYS_OPTIONS = ([3, 4, 5, 6] as const).map((d) => ({
  value: d as DaysPerWeek,
  label: String(d),
  sublabel: "days",
}))

const SESSION_LENGTH_OPTIONS: SessionLengthOption[] = [
  { value: 45, label: "45", sublabel: "min" },
  { value: 60, label: "60", sublabel: "min", badge: "popular" },
  { value: 90, label: "90", sublabel: "min" },
]

interface Step4Props {
  daysPerWeek: DaysPerWeek | undefined
  sessionLengthMin: SessionLength | undefined
  onChangeDays: (v: DaysPerWeek) => void
  onChangeLength: (v: SessionLength) => void
}

function Step4({
  daysPerWeek,
  sessionLengthMin,
  onChangeDays,
  onChangeLength,
}: Step4Props): React.JSX.Element {
  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-3xl leading-tight font-bold text-white">
        Your schedule
      </h1>

      {/* Days per week */}
      <div className="flex flex-col gap-3">
        <p className="text-muted text-xs font-semibold tracking-widest uppercase">
          Days per week
        </p>
        <div className="flex gap-2">
          {DAYS_OPTIONS.map((d) => {
            function handleSelect() {
              onChangeDays(d.value)
            }
            return (
              <ChipButton
                key={d.value}
                label={d.label}
                sublabel={d.sublabel}
                selected={daysPerWeek === d.value}
                onSelect={handleSelect}
              />
            )
          })}
        </div>
      </div>

      {/* Session length */}
      <div className="flex flex-col gap-3">
        <p className="text-muted text-xs font-semibold tracking-widest uppercase">
          Session length
        </p>
        <div className="flex gap-2">
          {SESSION_LENGTH_OPTIONS.map((o) => {
            function handleSelect() {
              onChangeLength(o.value)
            }
            return (
              <ChipButton
                key={o.value}
                label={o.label}
                sublabel={o.sublabel}
                badge={o.badge}
                selected={sessionLengthMin === o.value}
                onSelect={handleSelect}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── Step 5: Custom Directives ──────────────────────────────────────────────────

interface Step5Props {
  value: string
  error: string | null
  onChange: (v: string) => void
}

function Step5({ value, error, onChange }: Step5Props): React.JSX.Element {
  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    onChange(e.target.value)
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="mb-2 text-3xl leading-tight font-bold text-white">
          Anything else?
        </h1>
        <p className="text-muted text-sm">
          Tell your coach about injuries, preferences, or constraints. This is
          optional.
        </p>
      </div>

      <textarea
        value={value}
        onChange={handleChange}
        placeholder="E.g. bad left knee, prefer no barbell squats, training around a busy travel schedule..."
        rows={5}
        className="border-border bg-surface placeholder:text-muted-dim focus:border-accent w-full resize-none rounded-2xl border px-4 py-3.5 text-sm text-white transition-colors focus:outline-none"
      />

      {error && (
        <div className="rounded-xl border border-red-800 bg-red-950/50 px-4 py-3">
          <p className="text-sm font-medium text-red-400">
            Something went wrong
          </p>
          <p className="mt-1 text-xs text-red-500">{error}</p>
        </div>
      )}
    </div>
  )
}

// ── Main wizard component ──────────────────────────────────────────────────────

export function OnboardingPage(): React.JSX.Element {
  const router = useRouter()
  const [step, setStep] = useState<Step>(1)
  const [data, setData] = useState<WizardData>({})
  const [error, setError] = useState<string | null>(null)

  function next() {
    setStep((s) => {
      if (s === "loading") return s
      return (s + 1) as Step
    })
  }

  function back() {
    setStep((s) => {
      if (s === "loading" || s === 1) return s
      return (s - 1) as Step
    })
  }

  function startLoading() {
    setError(null)
    setStep("loading")
  }

  function handleSuccess(_programId: string) {
    void router.navigate({ to: "/" })
  }

  function handleError(msg: string) {
    setError(msg)
    setStep(5)
  }

  function handleCloseClick() {
    void router.navigate({ to: "/" })
  }

  function handleGoalChange(goal: Goal) {
    setData((d) => ({ ...d, goal }))
  }

  function handleEquipmentChange(equipmentPreset: EquipmentPreset) {
    setData((d) => ({ ...d, equipmentPreset }))
  }

  function handleExperienceChange(experience: Experience) {
    setData((d) => ({ ...d, experience }))
  }

  function handleDaysChange(daysPerWeek: DaysPerWeek) {
    setData((d) => ({ ...d, daysPerWeek }))
  }

  function handleSessionLengthChange(sessionLengthMin: SessionLength) {
    setData((d) => ({ ...d, sessionLengthMin }))
  }

  function handleDirectivesChange(customDirectives: string) {
    setData((d) => ({ ...d, customDirectives }))
  }

  function handleSkip() {
    setData((d) => ({ ...d, customDirectives: undefined }))
    startLoading()
  }

  // ── Render loading screen ──────────────────────────────────────────────────

  if (step === "loading") {
    return (
      <div className="bg-bg flex min-h-screen flex-col text-white">
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-6 pt-6 pb-10">
          <PlanGenerationScreen
            data={data}
            onSuccess={handleSuccess}
            onError={handleError}
          />
        </div>
      </div>
    )
  }

  // ── Render wizard steps ────────────────────────────────────────────────────

  const canContinue: boolean = (() => {
    if (step === 1) return !!data.goal
    if (step === 2) return !!data.equipmentPreset
    if (step === 3) return !!data.experience
    if (step === 4) return !!data.daysPerWeek && !!data.sessionLengthMin
    return true // step 5 always continuable (custom directives optional)
  })()

  return (
    <div className="bg-bg flex min-h-screen flex-col text-white">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-6 pt-6 pb-32">
        {/* Nav bar */}
        <div className="mb-6 flex items-center gap-4">
          {step === 1 ? (
            <button
              onClick={handleCloseClick}
              className="text-muted flex h-8 w-8 cursor-pointer items-center justify-center transition-colors hover:text-white"
              aria-label="Close onboarding"
            >
              <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
                <path
                  d="M18 6L6 18M6 6l12 12"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          ) : (
            <button
              onClick={back}
              className="text-muted flex h-8 w-8 cursor-pointer items-center justify-center transition-colors hover:text-white"
              aria-label="Go back"
            >
              <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
                <path
                  d="M15 18l-6-6 6-6"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          )}
          <StepIndicator current={step} />
        </div>

        {/* Step content */}
        {step === 1 && <Step1 value={data.goal} onChange={handleGoalChange} />}
        {step === 2 && (
          <Step2
            value={data.equipmentPreset}
            onChange={handleEquipmentChange}
          />
        )}
        {step === 3 && (
          <Step3 value={data.experience} onChange={handleExperienceChange} />
        )}
        {step === 4 && (
          <Step4
            daysPerWeek={data.daysPerWeek}
            sessionLengthMin={data.sessionLengthMin}
            onChangeDays={handleDaysChange}
            onChangeLength={handleSessionLengthChange}
          />
        )}
        {step === 5 && (
          <Step5
            value={data.customDirectives ?? ""}
            error={error}
            onChange={handleDirectivesChange}
          />
        )}
      </div>

      {/* Sticky bottom CTA */}
      <div className="from-bg via-bg pointer-events-none fixed right-0 bottom-0 left-0 bg-gradient-to-t to-transparent px-6 pt-6 pb-8">
        <div className="pointer-events-auto mx-auto max-w-md">
          {step === 5 ? (
            <div className="flex flex-col gap-3">
              <button
                onClick={startLoading}
                disabled={!canContinue}
                className="bg-accent w-full cursor-pointer rounded-2xl py-4 text-base font-bold text-black transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
              >
                Continue
              </button>
              <button
                onClick={handleSkip}
                className="border-border text-muted-light hover:border-border-hover w-full cursor-pointer rounded-2xl border py-3.5 text-base font-semibold transition-colors"
              >
                Skip
              </button>
            </div>
          ) : (
            <button
              onClick={next}
              disabled={!canContinue}
              className="bg-accent w-full cursor-pointer rounded-2xl py-4 text-base font-bold text-black transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
            >
              Continue
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
