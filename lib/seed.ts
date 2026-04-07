import { exercises } from "../data/exercises"
import { db } from "./db"
import { exercise } from "./schema"

export function seedExercises(): void {
  const existing = db.select().from(exercise).limit(1).all()
  if (existing.length > 0) return

  const rows = exercises.map((e) => ({
    id: crypto.randomUUID(),
    createdAt: new Date(),
    ...e,
  }))

  db.insert(exercise).values(rows).run()
  console.warn(`Seeded ${rows.length} exercises.`)
}

seedExercises()
