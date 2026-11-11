import type { Meta, StoryObj } from "@storybook/react-vite"
import { Label } from "./label"

const meta = {
  title: "UI Primitives/Label",
  component: Label,
  args: { children: "Weight" },
} satisfies Meta<typeof Label>
export default meta
type Story = StoryObj<typeof meta>
export const Default: Story = {}
