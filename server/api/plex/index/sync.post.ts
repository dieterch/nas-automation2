import { readBody } from "h3"
import { fetchPlexSafely } from "../../../utils/plex-utils"
import {
  ensurePlexIndexStructure,
  mapEpisodeItem,
  mapLibrary,
  mapMovieItem,
  mapShowItem,
  posterExists,
  readIndexedEpisodes,
  readIndexedLibraries,
  readIndexedMovies,
  readIndexedShows,
  readSyncStatus,
  writeIndexedEpisodes,
  writeSyncStatus,
  writeIndexedLibraries,
  writeIndexedMovies,
  writeIndexedShows,
  writePosterFile,
} from "../../../utils/plex-index"

const POSTER_FETCH_TIMEOUT_MS = 5000
const POSTER_FETCH_RETRIES = 3
const POSTER_FETCH_CONCURRENCY = 4
const POSTER_RETRY_BASE_DELAY_MS = 750

let syncStatusWriteChain = Promise.resolve()

async function fetchPlexBinary(relativeUrl: string) {
  const cfg = useRuntimeConfig()
  const fullUrl = `${cfg.plexHost}${relativeUrl}`

  const res = await fetch(fullUrl, {
    signal: AbortSignal.timeout(POSTER_FETCH_TIMEOUT_MS),
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

function toErrorMessage(err: unknown) {
  if (err instanceof Error) return err.message
  return String(err)
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchPlexBinaryWithRetry(relativeUrl: string) {
  let lastError: unknown = null

  for (let attempt = 1; attempt <= POSTER_FETCH_RETRIES; attempt += 1) {
    try {
      return await fetchPlexBinary(relativeUrl)
    } catch (err) {
      lastError = err

      if (attempt < POSTER_FETCH_RETRIES) {
        await sleep(POSTER_RETRY_BASE_DELAY_MS * attempt)
      }
    }
  }

  throw lastError ?? new Error("poster fetch failed")
}

async function mutateSyncStatus(mutator: (status: Awaited<ReturnType<typeof readSyncStatus>>) => any) {
  const nextWrite = syncStatusWriteChain.then(async () => {
    const status = await readSyncStatus()
    await writeSyncStatus(mutator(status))
  })

  syncStatusWriteChain = nextWrite.catch(() => {})
  return nextWrite
}

async function updateLibrarySyncStatus(
  libraryKey: string,
  updater: (library: any) => any,
  globalUpdater?: (status: any) => any
) {
  await mutateSyncStatus((status) => {
    const nextLibraries = status.libraries.map((library) => {
      if (library.libraryKey !== libraryKey) return library
      return updater(library)
    })

    const nextStatus = {
      ...status,
      libraries: nextLibraries,
    }

    return globalUpdater ? globalUpdater(nextStatus) : nextStatus
  })
}

async function downloadMissingPosters(libraryKey: string, items: any[]) {
  async function processPoster(item: any) {
    const ratingKey = String(item.ratingKey)
    const thumb = item.thumb as string | undefined

    if (!thumb) {
      await updateLibrarySyncStatus(libraryKey, (library) => ({
        ...library,
        posterCompleted: library.posterCompleted + 1,
      }))
      return
    }

    if (posterExists(libraryKey, ratingKey)) {
      await updateLibrarySyncStatus(libraryKey, (library) => ({
        ...library,
        posterCompleted: library.posterCompleted + 1,
      }))
      return
    }

    try {
      const bytes = await fetchPlexBinaryWithRetry(thumb)
      await writePosterFile(libraryKey, ratingKey, bytes)
      await updateLibrarySyncStatus(libraryKey, (library) => ({
        ...library,
        posterCompleted: library.posterCompleted + 1,
      }))
    } catch (err) {
      console.error("[PLEX-INDEX] poster download failed", libraryKey, ratingKey, err)
      await updateLibrarySyncStatus(libraryKey, (library) => ({
        ...library,
        posterCompleted: library.posterCompleted + 1,
        posterFailed: library.posterFailed + 1,
        lastError: toErrorMessage(err),
      }))
    }
  }

  const workers = Array.from({
    length: Math.max(1, Math.min(POSTER_FETCH_CONCURRENCY, items.length || 1)),
  }, async (_, workerIndex) => {
    for (let index = workerIndex; index < items.length; index += POSTER_FETCH_CONCURRENCY) {
      await processPoster(items[index])
    }
  })

  await Promise.all(workers)

  await mutateSyncStatus((currentStatus) => {
    const nextLibraries = currentStatus.libraries.map((library) => {
      if (library.libraryKey !== libraryKey) return library
      return {
        ...library,
        status: library.posterFailed > 0 ? "error" : "done",
        finishedAt: new Date().toISOString(),
      }
    })

    const anyRunning = nextLibraries.some((library) => !["done", "error"].includes(library.status))
    const anyErrors = nextLibraries.some((library) => library.status === "error")

    return {
      ...currentStatus,
      isRunning: anyRunning,
      phase: anyRunning ? "posters" : anyErrors ? "error" : "done",
      finishedAt: anyRunning ? currentStatus.finishedAt : new Date().toISOString(),
      lastSuccessAt: anyRunning || anyErrors ? currentStatus.lastSuccessAt : new Date().toISOString(),
      lastError: anyErrors
        ? nextLibraries.find((library) => library.status === "error")?.lastError ?? currentStatus.lastError
        : null,
      libraries: nextLibraries,
    }
  })
}

export default defineEventHandler(async (event) => {
  await ensurePlexIndexStructure()

  const body = await readBody<{ libraryKeys?: string[] }>(event).catch(() => ({}))
  const requestedKeys = Array.isArray(body?.libraryKeys)
    ? body.libraryKeys.map(String)
    : []

  const currentStatus = await readSyncStatus()
  if (currentStatus.isRunning) {
    throw createError({
      statusCode: 409,
      statusMessage: "Plex index sync already running",
    })
  }

  const sectionsResponse = await fetchPlexSafely("/library/sections")
  if ((sectionsResponse as any)?.error) {
    throw createError({
      statusCode: 503,
      statusMessage: (sectionsResponse as any).message ?? "Plex unavailable",
    })
  }

  const sections = ((sectionsResponse as any)?.MediaContainer?.Directory ?? [])
    .filter((section: any) => ["movie", "show"].includes(section.type))
    .filter((section: any) => requestedKeys.length === 0 || requestedKeys.includes(String(section.key)))

  await writeSyncStatus({
    isRunning: true,
    phase: "syncing",
    startedAt: new Date().toISOString(),
    finishedAt: null,
    lastSuccessAt: currentStatus.lastSuccessAt ?? null,
    lastError: null,
    libraries: sections.map((section: any) => ({
      libraryKey: String(section.key),
      title: section.title,
      itemCount: 0,
      posterTotal: 0,
      posterCompleted: 0,
      posterFailed: 0,
      status: "pending" as const,
      startedAt: null,
      finishedAt: null,
      lastError: null,
    })),
  })

  const librariesEnvelope = await readIndexedLibraries()
  const moviesEnvelope = await readIndexedMovies()
  const showsEnvelope = await readIndexedShows()
  const episodesEnvelope = await readIndexedEpisodes()

  const libraryMap = new Map(librariesEnvelope.items.map((item) => [item.key, item]))
  const retainedMovies = moviesEnvelope.items.filter(
    (item) => !sections.some((section: any) => section.type === "movie" && String(section.key) === item.libraryKey)
  )
  const retainedShows = showsEnvelope.items.filter(
    (item) => !sections.some((section: any) => section.type === "show" && String(section.key) === item.libraryKey)
  )
  const retainedEpisodes = episodesEnvelope.items.filter(
    (item) => !sections.some((section: any) => section.type === "show" && String(section.key) === item.libraryKey)
  )

  const syncedLibraries = [...librariesEnvelope.items]
  const newMovies = [...retainedMovies]
  const newShows = [...retainedShows]
  const newEpisodes = [...retainedEpisodes]
  const syncResults: Array<{ libraryKey: string; title: string; count: number }> = []

  for (const section of sections) {
    const libraryKey = String(section.key)
    console.log("[PLEX-INDEX] sync library", libraryKey, section.title)

    await updateLibrarySyncStatus(
      libraryKey,
      (library) => ({
        ...library,
        status: "syncing",
        startedAt: library.startedAt ?? new Date().toISOString(),
      }),
      (status) => ({
        ...status,
        phase: "syncing",
      })
    )

    const allResponse = await fetchPlexSafely(
      section.type === "movie"
        ? `/library/sections/${libraryKey}/all?type=1`
        : `/library/sections/${libraryKey}/all?type=2`
    )

    if ((allResponse as any)?.error) {
      await updateLibrarySyncStatus(
        libraryKey,
        (library) => ({
          ...library,
          status: "error",
          finishedAt: new Date().toISOString(),
          lastError: `Plex library sync failed: ${section.title}`,
        }),
        (status) => ({
          ...status,
          isRunning: false,
          phase: "error",
          finishedAt: new Date().toISOString(),
          lastError: `Plex library sync failed: ${section.title}`,
        })
      )
      throw createError({
        statusCode: 503,
        statusMessage: `Plex library sync failed: ${section.title}`,
      })
    }

    const topLevelItems = (allResponse as any)?.MediaContainer?.Metadata
      ?? (allResponse as any)?.MediaContainer?.Directory
      ?? []

    let mappedCount = 0
    let posterItems = topLevelItems

    if (section.type === "movie") {
      const mappedMovies = topLevelItems.map((item: any) => mapMovieItem(item, libraryKey))
      newMovies.push(...mappedMovies)
      mappedCount = mappedMovies.length
    } else {
      const episodesResponse = await fetchPlexSafely(`/library/sections/${libraryKey}/allLeaves`)
      if ((episodesResponse as any)?.error) {
        await updateLibrarySyncStatus(
          libraryKey,
          (library) => ({
            ...library,
            status: "error",
            finishedAt: new Date().toISOString(),
            lastError: `Plex episode sync failed: ${section.title}`,
          }),
          (status) => ({
            ...status,
            isRunning: false,
            phase: "error",
            finishedAt: new Date().toISOString(),
            lastError: `Plex episode sync failed: ${section.title}`,
          })
        )
        throw createError({
          statusCode: 503,
          statusMessage: `Plex episode sync failed: ${section.title}`,
        })
      }

      const episodeItems = (episodesResponse as any)?.MediaContainer?.Metadata ?? []
      const mappedShows = topLevelItems.map((item: any) => mapShowItem(item, libraryKey))
      const mappedEpisodes = episodeItems.map((item: any) => mapEpisodeItem(item, libraryKey))

      newShows.push(...mappedShows)
      newEpisodes.push(...mappedEpisodes)
      mappedCount = mappedShows.length
      posterItems = topLevelItems
    }

    const nextLibrary = {
      ...mapLibrary(section, libraryMap.get(libraryKey)),
      lastSyncAt: new Date().toISOString(),
      itemCount: mappedCount,
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
      count: mappedCount,
    })

    await writeIndexedMovies(newMovies)
    await writeIndexedShows(newShows)
    await writeIndexedEpisodes(newEpisodes)
    await writeIndexedLibraries(syncedLibraries)

    await updateLibrarySyncStatus(
      libraryKey,
      (library) => ({
        ...library,
        itemCount: mappedCount,
        posterTotal: posterItems.length,
        status: "posters",
      }),
      (status) => ({
        ...status,
        phase: "posters",
      })
    )

    void downloadMissingPosters(libraryKey, posterItems)
  }

  return {
    ok: true,
    libraries: syncResults,
    movieCount: newMovies.length,
  }
})
