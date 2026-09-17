import { createServerFn } from "@tanstack/react-start"
import { eq } from "drizzle-orm"
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3"
import { z } from "zod"
import { db } from "../../lib/db"
import type * as schema from "../../lib/schema"
import { userProfile } from "../../lib/schema"

const inputSchema = z.object({
  profileId: z.string().min(1),
  units: z.enum(["kg", "lbs"]),
})

export async function saveUnitsOperation(
  database: BetterSQLite3Database<typeof schema>,
  profileId: string,
  units: "kg" | "lbs"
) {
  const result = await database
    .update(userProfile)
    .set({ units })
    .where(eq(userProfile.id, profileId))
    .returning({ id: userProfile.id })
  if (result.length === 0) throw new Error("Profile not found.")
  return { units }
}

export const saveUnitsFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(({ data }) => saveUnitsOperation(db, data.profileId, data.units))
