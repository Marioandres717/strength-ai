import type { Meta, StoryObj } from "@storybook/react-vite"
import { Button } from "./button"

const meta = {
  title: "UI Primitives/Button",
  component: Button,
  args: { children: "Start workout" },
} satisfies Meta<typeof Button>
export default meta
type Story = StoryObj<typeof meta>
export const Default: Story = {}
export const Secondary: Story = { args: { variant: "secondary" } }
export const Disabled: Story = { args: { disabled: true } }
export const Destructive: Story = {
  args: { variant: "destructive", children: "Delete workout" },
}
export const Outline: Story = { args: { variant: "outline" } }
export const Ghost: Story = { args: { variant: "ghost" } }
export const Link: Story = { args: { variant: "link" } }
export const Large: Story = { args: { size: "lg" } }
