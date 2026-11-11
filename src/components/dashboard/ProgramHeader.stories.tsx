import type { Meta, StoryObj } from "@storybook/react-vite"
import { program } from "../../stories/fixtures"
import { ProgramHeader } from "./ProgramHeader"
const meta = {
  title: "Dashboard/Components/Program Header",
  component: ProgramHeader,
  args: { program, currentWeek: 1, sessionLengthMin: 60 },
} satisfies Meta<typeof ProgramHeader>
export default meta
type Story = StoryObj<typeof meta>
export const Default: Story = {}
