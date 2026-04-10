import { createFileRoute, useRouter } from "@tanstack/react-router"
import { useEffect, useRef, useState } from "react"
import { generatePlanFn } from "../functions/generatePlan"

export const Route = createFileRoute("/onboarding")({
  component: OnboardingPage,
})

// ── Types ──────────────────────────────────────────────────────────────────────

type Goal = "strength" | "hypertrophy" | "recomp" | "fat_loss"
type EquipmentPreset = "full_gym" | "dumbbells_only" | "home_gym" | "minimal"
type Experience = "beginner" | "intermediate" | "advanced"
type DaysPerWeek = 3 | 4 | 5 | 6
type SessionLength = 45 | 60 | 90
type Step = 1 | 2 | 3 | 4 | 5 | "loading"

interface WizardData {
  goal?: Goal
  equipmentPreset?: EquipmentPreset
  experience?: Experience
  daysPerWeek?: DaysPerWeek
  sessionLengthMin?: SessionLength
  customDirectives?: string
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function StepIndicator({ current }: { current: 1 | 2 | 3 | 4 | 5 }) {
  return (
    <div className="flex gap-1.5">
      {([1, 2, 3, 4, 5] as const).map((n) => (
        <div
          key={n}
          className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
            n <= current ? "bg-[#00c9a7]" : "bg-[#2a2a2a]"
          }`}
        />
      ))}
    </div>
  )
}

interface OptionCardProps {
  icon: string
  label: string
  sublabel?: string
  selected: boolean
  onSelect: () => void
}

function OptionCard({
  icon,
  label,
  sublabel,
  selected,
  onSelect,
}: OptionCardProps) {
  return (
    <button
      onClick={onSelect}
      className={`flex w-full cursor-pointer items-center gap-4 rounded-2xl border p-4 text-left transition-all duration-200 ${
        selected
          ? "border-[#00c9a7] bg-[#0a1f1c]"
          : "border-[#2a2a2a] bg-[#1c1c1e] hover:border-[#3a3a3a]"
      }`}
    >
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#2a2a2a] text-xl">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="leading-snug font-semibold text-white">{label}</p>
        {sublabel && (
          <p className="mt-0.5 text-sm leading-snug text-[#6b7280]">
            {sublabel}
          </p>
        )}
      </div>
      <div
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors duration-200 ${
          selected ? "border-[#00c9a7]" : "border-[#3a3a3a]"
        }`}
      >
        {selected && <div className="h-2.5 w-2.5 rounded-full bg-[#00c9a7]" />}
      </div>
    </button>
  )
}

interface ChipButtonProps {
  label: string
  sublabel?: string
  badge?: string
  selected: boolean
  onSelect: () => void
}

function ChipButton({
  label,
  sublabel,
  badge,
  selected,
  onSelect,
}: ChipButtonProps) {
  return (
    <button
      onClick={onSelect}
      className={`relative flex flex-1 cursor-pointer flex-col items-center justify-center rounded-2xl border px-2 py-3 transition-all duration-200 ${
        selected
          ? "border-[#00c9a7] bg-[#0a1f1c]"
          : "border-[#2a2a2a] bg-[#1c1c1e] hover:border-[#3a3a3a]"
      }`}
    >
      {badge && (
        <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-[#00c9a7] px-2 py-0.5 text-[10px] font-semibold text-black">
          {badge}
        </span>
      )}
      <span className="text-xl leading-none font-bold text-white">{label}</span>
      {sublabel && (
        <span className="mt-1 text-xs text-[#6b7280]">{sublabel}</span>
      )}
    </button>
  )
}

// ── Loading screen ─────────────────────────────────────────────────────────────

const LOADING_STEPS = [
  "Analyzing variables",
  "Structuring progression",
  "Generating schedule",
]

interface LoadingScreenProps {
  data: WizardData
  onSuccess: (programId: string) => void
  onError: (msg: string) => void
}

function LoadingScreen({ data, onSuccess, onError }: LoadingScreenProps) {
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
            stroke="#2a2a2a"
            strokeWidth="8"
          />
          <circle
            cx="60"
            cy="60"
            r="50"
            fill="none"
            stroke="#00c9a7"
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
        <p className="text-sm text-[#6b7280]">
          Optimizing volume, intensity, and progression
        </p>
      </div>

      {/* Progress checklist */}
      <div className="w-full space-y-4">
        {LOADING_STEPS.map((step, i) => {
          const done = completedSteps.includes(i)
          const active = !done && completedSteps.length === i
          return (
            <div key={step} className="flex items-center gap-3">
              <div
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-all duration-500 ${
                  done
                    ? "bg-[#00c9a7]"
                    : active
                      ? "animate-pulse border-2 border-[#00c9a7]"
                      : "border-2 border-[#2a2a2a]"
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
                  done ? "text-white" : active ? "text-white" : "text-[#4a4a4a]"
                }`}
              >
                {step}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Main wizard component ──────────────────────────────────────────────────────

function OnboardingPage() {
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

  // ── Render loading screen ──────────────────────────────────────────────────

  if (step === "loading") {
    return (
      <div className="flex min-h-screen flex-col bg-[#0d0d0d] text-white">
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-6 pt-6 pb-10">
          <LoadingScreen
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
    <div className="flex min-h-screen flex-col bg-[#0d0d0d] text-white">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-6 pt-6 pb-32">
        {/* Nav bar */}
        <div className="mb-6 flex items-center gap-4">
          {step === 1 ? (
            <button
              onClick={() => void router.navigate({ to: "/" })}
              className="flex h-8 w-8 cursor-pointer items-center justify-center text-[#6b7280] transition-colors hover:text-white"
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
              className="flex h-8 w-8 cursor-pointer items-center justify-center text-[#6b7280] transition-colors hover:text-white"
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
        {step === 1 && (
          <Step1
            value={data.goal}
            onChange={(goal) => setData((d) => ({ ...d, goal }))}
          />
        )}
        {step === 2 && (
          <Step2
            value={data.equipmentPreset}
            onChange={(equipmentPreset) =>
              setData((d) => ({ ...d, equipmentPreset }))
            }
          />
        )}
        {step === 3 && (
          <Step3
            value={data.experience}
            onChange={(experience) => setData((d) => ({ ...d, experience }))}
          />
        )}
        {step === 4 && (
          <Step4
            daysPerWeek={data.daysPerWeek}
            sessionLengthMin={data.sessionLengthMin}
            onChangeDays={(daysPerWeek) =>
              setData((d) => ({ ...d, daysPerWeek }))
            }
            onChangeLength={(sessionLengthMin) =>
              setData((d) => ({ ...d, sessionLengthMin }))
            }
          />
        )}
        {step === 5 && (
          <Step5
            value={data.customDirectives ?? ""}
            error={error}
            onChange={(customDirectives) =>
              setData((d) => ({ ...d, customDirectives }))
            }
          />
        )}
      </div>

      {/* Sticky bottom CTA */}
      <div className="pointer-events-none fixed right-0 bottom-0 left-0 bg-gradient-to-t from-[#0d0d0d] via-[#0d0d0d] to-transparent px-6 pt-6 pb-8">
        <div className="pointer-events-auto mx-auto max-w-md">
          {step === 5 ? (
            <div className="flex flex-col gap-3">
              <button
                onClick={startLoading}
                disabled={!canContinue}
                className="w-full cursor-pointer rounded-2xl bg-[#00c9a7] py-4 text-base font-bold text-black transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
              >
                Continue
              </button>
              <button
                onClick={() => {
                  setData((d) => ({ ...d, customDirectives: undefined }))
                  startLoading()
                }}
                className="w-full cursor-pointer rounded-2xl border border-[#2a2a2a] py-3.5 text-base font-semibold text-[#9ca3af] transition-colors hover:border-[#3a3a3a]"
              >
                Skip
              </button>
            </div>
          ) : (
            <button
              onClick={next}
              disabled={!canContinue}
              className="w-full cursor-pointer rounded-2xl bg-[#00c9a7] py-4 text-base font-bold text-black transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
            >
              Continue
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Step 1: Goal ───────────────────────────────────────────────────────────────

function Step1({
  value,
  onChange,
}: {
  value: Goal | undefined
  onChange: (v: Goal) => void
}) {
  const options: { icon: string; label: string; value: Goal }[] = [
    { icon: "🏋️", label: "Strength", value: "strength" },
    { icon: "📈", label: "Hypertrophy", value: "hypertrophy" },
    { icon: "⚖️", label: "Recomp", value: "recomp" },
    { icon: "🔥", label: "Fat Loss", value: "fat_loss" },
  ]

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-3xl leading-tight font-bold text-white">
        {"What's your goal?"}
      </h1>
      <div className="flex flex-col gap-3">
        {options.map((o) => (
          <OptionCard
            key={o.value}
            icon={o.icon}
            label={o.label}
            selected={value === o.value}
            onSelect={() => onChange(o.value)}
          />
        ))}
      </div>
    </div>
  )
}

// ── Step 2: Equipment ──────────────────────────────────────────────────────────

function Step2({
  value,
  onChange,
}: {
  value: EquipmentPreset | undefined
  onChange: (v: EquipmentPreset) => void
}) {
  const options: {
    icon: string
    label: string
    value: EquipmentPreset
  }[] = [
    { icon: "🏢", label: "Full Gym", value: "full_gym" },
    { icon: "🏠", label: "Dumbbells Only", value: "dumbbells_only" },
    { icon: "🏡", label: "Home Gym", value: "home_gym" },
    { icon: "🎒", label: "Minimal Equipment", value: "minimal" },
  ]

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-3xl leading-tight font-bold text-white">
        What equipment do you have?
      </h1>
      <div className="flex flex-col gap-3">
        {options.map((o) => (
          <OptionCard
            key={o.value}
            icon={o.icon}
            label={o.label}
            selected={value === o.value}
            onSelect={() => onChange(o.value)}
          />
        ))}
      </div>
    </div>
  )
}

// ── Step 3: Experience ─────────────────────────────────────────────────────────

function Step3({
  value,
  onChange,
}: {
  value: Experience | undefined
  onChange: (v: Experience) => void
}) {
  const options: {
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

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-3xl leading-tight font-bold text-white">
        Your experience level
      </h1>
      <div className="flex flex-col gap-3">
        {options.map((o) => (
          <OptionCard
            key={o.value}
            icon={o.icon}
            label={o.label}
            sublabel={o.sublabel}
            selected={value === o.value}
            onSelect={() => onChange(o.value)}
          />
        ))}
      </div>
    </div>
  )
}

// ── Step 4: Schedule ───────────────────────────────────────────────────────────

function Step4({
  daysPerWeek,
  sessionLengthMin,
  onChangeDays,
  onChangeLength,
}: {
  daysPerWeek: DaysPerWeek | undefined
  sessionLengthMin: SessionLength | undefined
  onChangeDays: (v: DaysPerWeek) => void
  onChangeLength: (v: SessionLength) => void
}) {
  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-3xl leading-tight font-bold text-white">
        Your schedule
      </h1>

      {/* Days per week */}
      <div className="flex flex-col gap-3">
        <p className="text-xs font-semibold tracking-widest text-[#6b7280] uppercase">
          Days per week
        </p>
        <div className="flex gap-2">
          {([3, 4, 5, 6] as const).map((d) => (
            <ChipButton
              key={d}
              label={String(d)}
              sublabel="days"
              selected={daysPerWeek === d}
              onSelect={() => onChangeDays(d)}
            />
          ))}
        </div>
      </div>

      {/* Session length */}
      <div className="flex flex-col gap-3">
        <p className="text-xs font-semibold tracking-widest text-[#6b7280] uppercase">
          Session length
        </p>
        <div className="flex gap-2">
          {(
            [
              { value: 45 as SessionLength, label: "45", sublabel: "min" },
              {
                value: 60 as SessionLength,
                label: "60",
                sublabel: "min",
                badge: "popular",
              },
              { value: 90 as SessionLength, label: "90", sublabel: "min" },
            ] as const
          ).map((o) => (
            <ChipButton
              key={o.value}
              label={o.label}
              sublabel={o.sublabel}
              badge={"badge" in o ? (o.badge as string) : undefined}
              selected={sessionLengthMin === o.value}
              onSelect={() => onChangeLength(o.value)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Step 5: Custom Directives ──────────────────────────────────────────────────

function Step5({
  value,
  error,
  onChange,
}: {
  value: string
  error: string | null
  onChange: (v: string) => void
}) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="mb-2 text-3xl leading-tight font-bold text-white">
          Anything else?
        </h1>
        <p className="text-sm text-[#6b7280]">
          Tell your coach about injuries, preferences, or constraints. This is
          optional.
        </p>
      </div>

      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="E.g. bad left knee, prefer no barbell squats, training around a busy travel schedule..."
        rows={5}
        className="w-full resize-none rounded-2xl border border-[#2a2a2a] bg-[#1c1c1e] px-4 py-3.5 text-sm text-white transition-colors placeholder:text-[#4a4a4a] focus:border-[#00c9a7] focus:outline-none"
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
