import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { db } from "../../lib/db"
import { completeSessionOperation } from "./completeSession.server"

export type {
  CompleteSessionResult,
  ProgressionChange,
} from "./completeSession.server"

const inputSchema = z.object({
  workoutLogId: z.string().min(1),
  sessionTemplateId: z.string().min(1),
})

export const completeSessionFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(({ data }) => completeSessionOperation(db, data))
