import { readBody } from "h3"
import { fetchPlexSafely } from "../../../utils/plex-utils"
import {
  ensurePlexIndexStructure,
  mapLibrary,
  mapMovieItem,
  posterExists,
  readIndexedLibraries,
  readIndexedMovies,
  writeIndexedLibraries,
  writeIndexedMovies,
  writePosterFile,
} from "../../../utils/plex-index"

async function fetchPlexBinary(relativeUrl: string) {
  const cfg = useRuntimeConfig()
  const fullUrl = `${cfg.plexHost}${relativeUrl}`

  const res = await fetch(fullUrl, {
    signal: AbortSignal.timeout(5000),
    headers: {
      Accept: "*/*",
      "X-Plex-Token": cfg.plexToken,
      "X-Plex-Product": "NuxtNAS",
      "X-Plex-Version": "1.0",
    },
  })

  if (!res.ok) {
    throw new Error(`poster fetch failed: ${res.status}`)
  }

  return new Uint8Array(await res.arrayBuffer())
}

async function downloadMissingPosters(libraryKey: string, items: any[]) {
  for (const item of items) {
    const ratingKey = String(item.ratingKey)
    const thumb = item.thumb as string | undefined

    if (!thumb) continue
    if (posterExists(libraryKey, ratingKey)) continue

    try {
      const bytes = await fetchPlexBinary(thumb)
      await writePosterFile(libraryKey, ratingKey, bytes)
    } catch (err) {
      console.error("[PLEX-INDEX] poster download failed", libraryKey, ratingKey, err)
    }
  }
}

export default defineEventHandler(async (event) => {
  await ensurePlexIndexStructure()

  const body = await readBody<{ libraryKeys?: string[] }>(event).catch(() => ({}))
  const requestedKeys = Array.isArray(body?.libraryKeys)
    ? body.libraryKeys.map(String)
    : []

  const sectionsResponse = await fetchPlexSafely("/library/sections")
  if ((sectionsResponse as any)?.error) {
    throw createError({
      statusCode: 503,
      statusMessage: (sectionsResponse as any).message ?? "Plex unavailable",
    })
  }

  const sections = ((sectionsResponse as any)?.MediaContainer?.Directory ?? [])
    .filter((section: any) => section.type === "movie")
    .filter((section: any) => requestedKeys.length === 0 || requestedKeys.includes(String(section.key)))

  const librariesEnvelope = await readIndexedLibraries()
  const moviesEnvelope = await readIndexedMovies()

  const libraryMap = new Map(librariesEnvelope.items.map((item) => [item.key, item]))
  const retainedMovies = moviesEnvelope.items.filter(
    (item) => !sections.some((section: any) => String(section.key) === item.libraryKey)
  )

  const syncedLibraries = [...librariesEnvelope.items]
  const newMovies = [...retainedMovies]
  const syncResults: Array<{ libraryKey: string; title: string; count: number }> = []

  for (const section of sections) {
    const libraryKey = String(section.key)
    console.log("[PLEX-INDEX] sync library", libraryKey, section.title)
    const allResponse = await fetchPlexSafely(`/library/sections/${libraryKey}/all?type=1`)

    if ((allResponse as any)?.error) {
      throw createError({
        statusCode: 503,
        statusMessage: `Plex library sync failed: ${section.title}`,
      })
    }

    const items = (allResponse as any)?.MediaContainer?.Metadata ?? []
    const mapped = items.map((item: any) => mapMovieItem(item, libraryKey))

    newMovies.push(...mapped)

    const nextLibrary = {
      ...mapLibrary(section, libraryMap.get(libraryKey)),
      lastSyncAt: new Date().toISOString(),
      itemCount: mapped.length,
    }

    const existingIndex = syncedLibraries.findIndex((item) => item.key === libraryKey)
    if (existingIndex >= 0) {
      syncedLibraries.splice(existingIndex, 1, nextLibrary)
    } else {
      syncedLibraries.push(nextLibrary)
    }

    syncResults.push({
      libraryKey,
      title: section.title,
      count: mapped.length,
    })

    await writeIndexedMovies(newMovies)
    await writeIndexedLibraries(syncedLibraries)

    void downloadMissingPosters(libraryKey, items)
  }

  return {
    ok: true,
    libraries: syncResults,
    movieCount: newMovies.length,
  }
})
