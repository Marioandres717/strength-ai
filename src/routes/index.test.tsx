import { describe, it, expect } from "vitest"

// Simple smoke test - verifies the file can be imported without errors
describe("Index Route", () => {
  it("index route file exists and can be imported", async () => {
    const module = await import("./index")
    expect(module).toBeDefined()
  })

  it("index route exports a Route component", async () => {
    const module = await import("./index")
    expect(module.Route).toBeDefined()
    expect(typeof module.Route).toBe("object")
  })
})
