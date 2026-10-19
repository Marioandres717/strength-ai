import { reconcileOnDemandWorkoutGenerations } from "../lib/onDemandWorkoutGeneration.server"
import { db, sqlite } from "../lib/db"
import { seedExercises } from "../lib/seed"
import { migrateWorkoutDatabase } from "./migrate"
migrateWorkoutDatabase(db, sqlite)
seedExercises()
reconcileOnDemandWorkoutGenerations(db)
console.warn("Database migrations and exercise seed are ready.")
