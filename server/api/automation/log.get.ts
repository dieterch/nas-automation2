import { readFileSync, existsSync } from "fs"
import { resolve } from "path"

export default defineEventHandler((event) => {
  const query = getQuery(event)
  const limit = Number(query.limit ?? 50)

  const file = resolve("data/automation.log.jsonl")

  if (!existsSync(file)) {
    return {
      entries: [],
      total: 0,
    }
  }

  const lines = readFileSync(file, "utf-8")
    .trim()
    .split("\n")
    .filter(Boolean)

  const parsed = lines
    .map((l) => {
      try {
        return JSON.parse(l)
      } catch {
        return null
      }
    })
    .filter(Boolean)

  const entries = parsed.slice(-limit).reverse()

  return {
    entries,
    total: parsed.length,
  }
})
