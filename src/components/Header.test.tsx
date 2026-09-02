import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router"
import { describe, expect, it } from "vitest"
import { render, screen } from "../test/utils"
import Header from "./Header"

function renderHeader() {
  const rootRoute = createRootRoute({
    component: () => (
      <>
        <Header />
        <Outlet />
      </>
    ),
  })
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
    component: () => null,
  })
  const router = createRouter({
    routeTree: rootRoute.addChildren([indexRoute]),
    history: createMemoryHistory({ initialEntries: ["/"] }),
  })

  return render(<RouterProvider router={router} />)
}

describe("Header", () => {
  it("renders a branded dashboard link", async () => {
    renderHeader()

    expect(
      await screen.findByRole("link", { name: "Strength AI dashboard" })
    ).toHaveAttribute("href", "/")
  })

  it("shows Today as the active dashboard destination", async () => {
    renderHeader()

    expect(await screen.findByRole("link", { name: "Today" })).toHaveClass(
      "bg-surface-selected",
      "text-accent"
    )
  })
})
