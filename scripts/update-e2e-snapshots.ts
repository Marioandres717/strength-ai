import { spawnSync } from "node:child_process"

if (process.platform !== "linux") {
  throw new Error(
    "E2E snapshots must be generated on Linux, the canonical visual environment."
  )
}

for (const args of [
  ["build"],
  ["exec", "playwright", "test", "--grep", "@visual", "--update-snapshots"],
]) {
  const result = spawnSync("pnpm", args, {
    stdio: "inherit",
  })

  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}
