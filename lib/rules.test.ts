import { describe, it, expect } from "vitest"
import {
  computeProgression,
  parseRepRangeUpper,
  parseRepRangeLower,
  type ExercisePrescription,
  type SetRecord,
} from "./rules"

const basePrescription: ExercisePrescription = {
  plannedExerciseId: "pe-1",
  sets: 3,
  repRange: "4-6",
  loadKg: 100,
  rirTarget: 1,
}

function makeSet(overrides: Partial<SetRecord> = {}): SetRecord {
  return {
    setNumber: 1,
    weightKg: 100,
    reps: 6,
    rirActual: 2,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// parseRepRangeUpper
// ---------------------------------------------------------------------------

describe("parseRepRangeUpper", () => {
  it("parses hyphen-separated range", () => {
    expect(parseRepRangeUpper("4-6")).toBe(6)
  })

  it("parses en-dash-separated range", () => {
    expect(parseRepRangeUpper("8–12")).toBe(12)
  })

  it("parses single number as both lower and upper", () => {
    expect(parseRepRangeUpper("5")).toBe(5)
  })

  it("handles whitespace around numbers", () => {
    expect(parseRepRangeUpper("4 - 6")).toBe(6)
  })
})

// ---------------------------------------------------------------------------
// parseRepRangeLower
// ---------------------------------------------------------------------------

describe("parseRepRangeLower", () => {
  it("parses hyphen-separated range", () => {
    expect(parseRepRangeLower("4-6")).toBe(4)
  })

  it("parses en-dash-separated range", () => {
    expect(parseRepRangeLower("8–12")).toBe(8)
  })
})

// ---------------------------------------------------------------------------
// computeProgression — increase cases
// ---------------------------------------------------------------------------

describe("computeProgression — increase", () => {
  it("returns increase when all sets hit upper rep bound and RIR >= target", () => {
    const sets: SetRecord[] = [
      makeSet({ setNumber: 1, reps: 6, rirActual: 2 }),
      makeSet({ setNumber: 2, reps: 6, rirActual: 1 }),
      makeSet({ setNumber: 3, reps: 7, rirActual: 2 }),
    ]
    const result = computeProgression(basePrescription, sets)
    expect(result.kind).toBe("increase")
    if (result.kind === "increase") {
      expect(result.newLoadKg).toBe(102.5)
    }
  })

  it("returns increase for single set at exact threshold", () => {
    const sets: SetRecord[] = [makeSet({ reps: 6, rirActual: 1 })]
    const result = computeProgression({ ...basePrescription, sets: 1 }, sets)
    expect(result.kind).toBe("increase")
  })

  it("correctly computes new load (rounds to 2 decimals)", () => {
    const sets: SetRecord[] = [makeSet({ reps: 6, rirActual: 2 })]
    const result = computeProgression(
      { ...basePrescription, loadKg: 102.5 },
      sets
    )
    expect(result.kind).toBe("increase")
    if (result.kind === "increase") {
      expect(result.newLoadKg).toBe(105)
    }
  })

  it("works with en-dash rep range", () => {
    const sets: SetRecord[] = [
      makeSet({ reps: 12, rirActual: 2 }),
      makeSet({ reps: 12, rirActual: 2 }),
    ]
    const result = computeProgression(
      { ...basePrescription, repRange: "8–12", rirTarget: 1 },
      sets
    )
    expect(result.kind).toBe("increase")
  })
})

// ---------------------------------------------------------------------------
// computeProgression — maintain cases
// ---------------------------------------------------------------------------

describe("computeProgression — maintain", () => {
  it("returns maintain when any set missed the rep target", () => {
    const sets: SetRecord[] = [
      makeSet({ setNumber: 1, reps: 6, rirActual: 2 }),
      makeSet({ setNumber: 2, reps: 5, rirActual: 2 }), // missed upper bound
      makeSet({ setNumber: 3, reps: 6, rirActual: 2 }),
    ]
    const result = computeProgression(basePrescription, sets)
    expect(result.kind).toBe("maintain")
  })

  it("returns maintain when any RIR is below target", () => {
    const sets: SetRecord[] = [
      makeSet({ setNumber: 1, reps: 6, rirActual: 2 }),
      makeSet({ setNumber: 2, reps: 6, rirActual: 0 }), // below target of 1
    ]
    const result = computeProgression(basePrescription, sets)
    expect(result.kind).toBe("maintain")
  })

  it("returns maintain when any rirActual is null", () => {
    const sets: SetRecord[] = [
      makeSet({ setNumber: 1, reps: 6, rirActual: 2 }),
      makeSet({ setNumber: 2, reps: 6, rirActual: null }),
    ]
    const result = computeProgression(basePrescription, sets)
    expect(result.kind).toBe("maintain")
  })

  it("returns maintain when reps exactly below upper bound", () => {
    const sets: SetRecord[] = [makeSet({ reps: 5, rirActual: 2 })] // upper is 6
    const result = computeProgression(basePrescription, sets)
    expect(result.kind).toBe("maintain")
  })

  it("returns maintain when RIR exactly below target", () => {
    const sets: SetRecord[] = [makeSet({ reps: 6, rirActual: 0 })] // target is 1
    const result = computeProgression(basePrescription, sets)
    expect(result.kind).toBe("maintain")
  })

  it("returns maintain when sets array is empty", () => {
    const result = computeProgression(basePrescription, [])
    expect(result.kind).toBe("maintain")
  })

  it("returns maintain when rirTarget is 0 and rirActual is null", () => {
    const sets: SetRecord[] = [makeSet({ reps: 6, rirActual: null })]
    const result = computeProgression(
      { ...basePrescription, rirTarget: 0 },
      sets
    )
    expect(result.kind).toBe("maintain")
  })
})
