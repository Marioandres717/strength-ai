import type { Meta, StoryObj } from "@storybook/react-vite"
import { Slider } from "./slider"

const meta = {
  title: "UI Primitives/Slider",
  component: Slider,
  args: { defaultValue: [50], max: 100 },
} satisfies Meta<typeof Slider>
export default meta
type Story = StoryObj<typeof meta>
export const Default: Story = {}
