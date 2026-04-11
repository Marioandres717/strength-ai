import { describe, it, expect, vi } from "vitest"
import { render, waitFor, act } from "../test/utils"
import { makeWizardData } from "../test/utils"
import { PlanGenerationScreen } from "./PlanGenerationScreen"

const hasKey = !!process.env.ANTHROPIC_API_KEY

describe.skipIf(!hasKey)(
  "PlanGenerationScreen integration (real generatePlanFn)",
  () => {
    it("calls onSuccess with a non-empty programId for a valid minimal input", async () => {
      const onSuccess = vi.fn()
      render(
        <PlanGenerationScreen
          data={makeWizardData()}
          onSuccess={onSuccess}
          onError={vi.fn()}
        />
      )
      await waitFor(
        () => {
          expect(onSuccess).toHaveBeenCalledOnce()
          expect(onSuccess.mock.calls[0][0]).toBeTruthy()
        },
        { timeout: 60_000 }
      )
    }, 60_000)

    it("transitions all three loading steps to complete state before onSuccess fires", async () => {
      let resolveCapture: ((programId: string) => void) | undefined
      const successPromise = new Promise<string>((res) => {
        resolveCapture = res
      })

      render(
        <PlanGenerationScreen
          data={makeWizardData()}
          onSuccess={(id) => resolveCapture?.(id)}
          onError={vi.fn()}
        />
      )

      // Wait for all steps to show checkmarks (bg-accent indicators)
      await waitFor(
        () => {
          const indicators = document.querySelectorAll(
            '[class*="bg-accent"][class*="rounded-full"][class*="h-6"]'
          )
          expect(indicators).toHaveLength(3)
        },
        { timeout: 60_000 }
      )

      // onSuccess fires shortly after
      await act(async () => {
        await successPromise
      })
    }, 60_000)
  }
)
