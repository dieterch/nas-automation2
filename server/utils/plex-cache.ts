import { readFile, writeFile, mkdir } from "fs/promises"
import { resolve, dirname } from "path"

const CACHE_FILE = resolve("data/plex-scheduled.json")

export async function readPlexCache() {
  try {
    const raw = await readFile(CACHE_FILE, "utf-8")
    return JSON.parse(raw)
  } catch {
    return {
      lastSuccessfulFetch: null,
      data: null
    }
  }
}

export async function writePlexCache(data: any) {
  await mkdir(dirname(CACHE_FILE), { recursive: true })

  const payload = {
    lastSuccessfulFetch: new Date().toISOString(),
    data
  }

  await writeFile(
    CACHE_FILE,
    JSON.stringify(payload, null, 2),
    "utf-8"
  )

  return payload
}
