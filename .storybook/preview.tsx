import { useEffect, useMemo } from "react"
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router"
import type { Preview } from "@storybook/react-vite"
import "../src/styles.css"

function Theme({
  mode,
  children,
}: {
  mode: string
  children: React.ReactNode
}) {
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)")
    function apply() {
      const resolved =
        mode === "auto" ? (media.matches ? "dark" : "light") : mode
      document.documentElement.classList.remove("light", "dark")
      document.documentElement.classList.add(resolved)
      if (mode === "auto")
        document.documentElement.removeAttribute("data-theme")
      else document.documentElement.setAttribute("data-theme", mode)
      document.documentElement.style.colorScheme = resolved
    }
    apply()
    media.addEventListener("change", apply)
    return () => media.removeEventListener("change", apply)
  }, [mode])
  return children
}
function StoryRouter({ children }: { children: React.ReactNode }) {
  const router = useMemo(() => {
    const root = createRootRoute({ component: () => children })
    const paths = [
      "/",
      "/onboarding",
      "/plan",
      "/feedback/$id",
      "/on-demand-workouts",
      "/on-demand-workouts/new",
      "/on-demand-workouts/$id",
      "/session/$id",
      "/workout/$id",
    ] as const
    const routes = paths.map((path) =>
      createRoute({ getParentRoute: () => root, path })
    )
    return createRouter({
      routeTree: root.addChildren(routes),
      history: createMemoryHistory({ initialEntries: ["/"] }),
    })
  }, [children])
  return <RouterProvider router={router} />
}
const preview: Preview = {
  tags: ["autodocs"],
  globalTypes: {
    theme: {
      description: "Theme",
      toolbar: {
        icon: "paintbrush",
        items: ["auto", "light", "dark"],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: {
    theme: "auto",
    viewport: { value: "mobile", isRotated: false },
  },
  parameters: {
    layout: "centered",
    options: {
      storySort: {
        order: [
          "Dashboard",
          ["Pages", "Components"],
          "Workout Session",
          ["Pages", "Components"],
          "Onboarding",
          ["Pages", "Components"],
          "Training Plan",
          ["Pages", "Components"],
          "On-Demand Workouts",
          ["Pages", "Components"],
          "Feedback",
          "Shared Components",
          "UI Primitives",
        ],
      },
    },
    controls: { matchers: { color: /(background|color)$/i, date: /Date$/i } },
    viewport: {
      options: {
        mobile: { name: "Mobile", styles: { width: "390px", height: "844px" } },
        desktop: {
          name: "Desktop",
          styles: { width: "1440px", height: "900px" },
        },
      },
    },
  },
  decorators: [
    (Story, context) => (
      <Theme mode={context.globals.theme as string}>
        <StoryRouter>
          <Story />
        </StoryRouter>
      </Theme>
    ),
  ],
}
export default preview
