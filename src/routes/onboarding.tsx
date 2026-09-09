import { createFileRoute, redirect } from "@tanstack/react-router"
import { OnboardingPage } from "../components/OnboardingPage"
import { getProfileStatusFn } from "../functions/getProfileStatus"

export const Route = createFileRoute("/onboarding")({
  beforeLoad: async () => {
    const { hasProfile } = await getProfileStatusFn()
    if (hasProfile) {
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw redirect({ to: "/" })
    }
  },
  component: OnboardingPage,
})
