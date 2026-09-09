import { createServerFn } from "@tanstack/react-start"
import { db } from "../../lib/db"
import { userProfile } from "../../lib/schema"
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3"
import type * as schema from "../../lib/schema"

export interface ProfileStatus {
  hasProfile: boolean
}

export async function getProfileStatusOperation(
  database: BetterSQLite3Database<typeof schema>
): Promise<ProfileStatus> {
  const profiles = await database
    .select({ id: userProfile.id })
    .from(userProfile)
    .limit(1)

  return { hasProfile: profiles.length > 0 }
}

export const getProfileStatusFn = createServerFn({ method: "GET" }).handler(
  () => getProfileStatusOperation(db)
)
