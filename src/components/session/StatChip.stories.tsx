import type { Meta, StoryObj } from "@storybook/react-vite"
import { StatChip } from "./StatChip"

const meta = {
  title: "Workout Session/Components/Stat Chip",
  component: StatChip,
  args: { label: "Sets", value: 3 },
} satisfies Meta<typeof StatChip>
export default meta
type Story = StoryObj<typeof meta>
export const Default: Story = {}
