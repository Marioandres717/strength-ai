import { describe, expect, it } from "vitest"
import { displayWeight, formatWeight, toKg } from "./weightUnits"

describe("weight units", () => {
  it("formats kilograms and pounds from stored kilograms", () => {
    expect(formatWeight(100, "kg")).toBe("100 kg")
    expect(formatWeight(100, "lbs")).toBe("220.5 lbs")
  })

  it("converts a displayed pounds entry back to kilograms for logging", () => {
    expect(toKg(displayWeight(100, "lbs") + 5, "lbs")).toBeCloseTo(102.25, 1)
    expect(toKg(102.5, "kg")).toBe(102.5)
  })
})
