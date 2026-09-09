import { z } from "zod"

const ServerEnvironmentSchema = z.object({
  DATABASE_PATH: z.string().trim().min(1).default("strength.db"),
})

const parsedEnvironment = ServerEnvironmentSchema.parse({
  DATABASE_PATH: process.env.DATABASE_PATH,
})

/** The SQLite location is configurable so containers can use their data volume. */
export const databasePath = parsedEnvironment.DATABASE_PATH
