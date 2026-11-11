import type { Meta, StoryObj } from "@storybook/react-vite"
import { program } from "../../stories/fixtures"
import { ProgramFooter } from "./ProgramFooter"
const meta = {
  title: "Dashboard/Components/Program Footer",
  component: ProgramFooter,
  args: { program },
} satisfies Meta<typeof ProgramFooter>
export default meta
type Story = StoryObj<typeof meta>
export const Default: Story = {}
