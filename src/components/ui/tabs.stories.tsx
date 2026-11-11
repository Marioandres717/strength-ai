import type { Meta, StoryObj } from "@storybook/react-vite"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs"

const meta = { title: "UI Primitives/Tabs", component: Tabs } satisfies Meta<
  typeof Tabs
>
export default meta
type Story = StoryObj<typeof meta>
export const Default: Story = {
  args: {
    defaultValue: "week1",
    children: (
      <>
        <TabsList>
          <TabsTrigger value="week1">Week 1</TabsTrigger>
          <TabsTrigger value="week2">Week 2</TabsTrigger>
        </TabsList>
        <TabsContent value="week1">Strength foundation</TabsContent>
        <TabsContent value="week2">Build volume</TabsContent>
      </>
    ),
  },
}
