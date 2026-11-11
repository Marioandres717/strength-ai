import type { Meta, StoryObj } from "@storybook/react-vite"
import { OnboardingPage } from "./OnboardingPage"

const meta = {
  title: "Onboarding/Pages/Onboarding",
  parameters: { layout: "fullscreen" },
  component: OnboardingPage,
  args: {},
} satisfies Meta<typeof OnboardingPage>
export default meta
type Story = StoryObj<typeof meta>
export const Default: Story = {}
