import type { Meta, StoryObj } from "@storybook/react-vite"
import { Field } from "./field"

const meta = {
  title: "UI Primitives/Field",
  component: Field,
  args: { children: "Weight" },
} satisfies Meta<typeof Field>
export default meta
type Story = StoryObj<typeof meta>
export const Default: Story = {}
