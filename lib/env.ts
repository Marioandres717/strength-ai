import { z } from "zod"

const ServerEnvironmentSchema = z.object({
  DATABASE_PATH: z.string().trim().min(1).default("strength.db"),
  ON_DEMAND_WORKOUT_DAILY_CAP: z.coerce
    .number()
    .int()
    .min(1)
    .max(100)
    .default(5),
  APP_TIMEZONE: z
    .string()
    .default("America/Regina")
    .refine((value) => {
      try {
        new Intl.DateTimeFormat("en", { timeZone: value })
        return true
      } catch {
        return false
      }
    }, "Invalid application timezone"),
})

const parsedEnvironment = ServerEnvironmentSchema.parse({
  DATABASE_PATH: process.env.DATABASE_PATH,
  ON_DEMAND_WORKOUT_DAILY_CAP: process.env.ON_DEMAND_WORKOUT_DAILY_CAP,
  APP_TIMEZONE: process.env.APP_TIMEZONE,
})

/** The SQLite location is configurable so containers can use their data volume. */
export const databasePath = parsedEnvironment.DATABASE_PATH
export const onDemandWorkoutDailyCap =
  parsedEnvironment.ON_DEMAND_WORKOUT_DAILY_CAP
export const appTimezone = parsedEnvironment.APP_TIMEZONE
