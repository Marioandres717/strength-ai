import type { Meta, StoryObj } from "@storybook/react-vite"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./card"
import { Button } from "./button"
const meta = {
  title: "UI Primitives/Card",
  component: Card,
  args: {
    children: (
      <>
        <CardHeader>
          <CardTitle>Strength Foundation</CardTitle>
          <CardDescription>Week 1 of 4</CardDescription>
        </CardHeader>
        <CardContent>Three sessions per week</CardContent>
        <CardFooter>
          <Button>View plan</Button>
        </CardFooter>
      </>
    ),
  },
} satisfies Meta<typeof Card>
export default meta
type Story = StoryObj<typeof meta>
export const Default: Story = {}
