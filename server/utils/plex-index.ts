import { mkdir, readFile, writeFile, stat } from "fs/promises"
import { existsSync } from "fs"
import { dirname, join, resolve } from "path"

export type PlexIndexLibrary = {
  key: string
  title: string
  type: string
  agent?: string | null
  scanner?: string | null
  language?: string | null
  updatedAt: string
  lastSyncAt?: string | null
  itemCount?: number
}

export type PlexMovieIndexEntry = {
  ratingKey: string
  libraryKey: string
  title: string
  originalTitle?: string | null
  year?: number | null
  summary?: string | null
  contentRating?: string | null
  studio?: string | null
  genres: string[]
  posterPath?: string | null
  thumbPath?: string | null
  addedAt?: string | null
  updatedAt?: string | null
  type: "movie"
}

type IndexEnvelope<T> = {
  updatedAt: string
  items: T[]
}

type LibrariesEnvelope = {
  updatedAt: string
  items: PlexIndexLibrary[]
}

function getIndexRoot() {
  const cfg = useRuntimeConfig()
  const configured = cfg.plexIndexDir as string | undefined

  if (configured && configured.trim().length > 0) {
    return resolve(configured)
  }

  return resolve("data/plex-index")
}

function getLibrariesFile() {
  return join(getIndexRoot(), "libraries.json")
}

function getMoviesFile() {
  return join(getIndexRoot(), "movies.json")
}

function getShowsFile() {
  return join(getIndexRoot(), "shows.json")
}

function getEpisodesFile() {
  return join(getIndexRoot(), "episodes.json")
}

export function getPosterAbsolutePath(libraryKey: string, ratingKey: string) {
  return join(getIndexRoot(), "posters", libraryKey, `${ratingKey}.jpg`)
}

export function getPosterRelativePath(libraryKey: string, ratingKey: string) {
  return `posters/${libraryKey}/${ratingKey}.jpg`
}

export async function ensurePlexIndexStructure() {
  await mkdir(join(getIndexRoot(), "posters"), { recursive: true })

  await ensureEnvelopeFile(getLibrariesFile())
  await ensureEnvelopeFile(getMoviesFile())
  await ensureEnvelopeFile(getShowsFile())
  await ensureEnvelopeFile(getEpisodesFile())
}

async function ensureEnvelopeFile(path: string) {
  if (existsSync(path)) return

  await mkdir(dirname(path), { recursive: true })
  await writeFile(
    path,
    JSON.stringify({ updatedAt: null, items: [] }, null, 2),
    "utf-8"
  )
}

async function readEnvelope<T>(path: string): Promise<IndexEnvelope<T>> {
  await ensureEnvelopeFile(path)

  const raw = await readFile(path, "utf-8")
  const parsed = JSON.parse(raw) as Partial<IndexEnvelope<T>>

  return {
    updatedAt: parsed.updatedAt ?? "",
    items: Array.isArray(parsed.items) ? parsed.items : [],
  }
}

async function writeEnvelope<T>(path: string, items: T[]) {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(
    path,
    JSON.stringify(
      {
        updatedAt: new Date().toISOString(),
        items,
      },
      null,
      2
    ),
    "utf-8"
  )
}

export async function readIndexedLibraries(): Promise<LibrariesEnvelope> {
  return readEnvelope<PlexIndexLibrary>(getLibrariesFile())
}

export async function writeIndexedLibraries(items: PlexIndexLibrary[]) {
  await writeEnvelope(getLibrariesFile(), items)
}

export async function readIndexedMovies(): Promise<IndexEnvelope<PlexMovieIndexEntry>> {
  return readEnvelope<PlexMovieIndexEntry>(getMoviesFile())
}

export async function writeIndexedMovies(items: PlexMovieIndexEntry[]) {
  await writeEnvelope(getMoviesFile(), items)
}

export async function writePosterFile(
  libraryKey: string,
  ratingKey: string,
  bytes: Uint8Array
) {
  const path = getPosterAbsolutePath(libraryKey, ratingKey)
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, bytes)
}

export async function readPosterFileInfo(libraryKey: string, ratingKey: string) {
  const path = getPosterAbsolutePath(libraryKey, ratingKey)
  const info = await stat(path)
  return { path, info }
}

export function posterExists(libraryKey: string, ratingKey: string) {
  return existsSync(getPosterAbsolutePath(libraryKey, ratingKey))
}

export function normalizePlexTimestamp(value: unknown): string | null {
  if (typeof value === "number") {
    return new Date(value * 1000).toISOString()
  }
  return null
}

export function mapLibrary(section: any, previous?: PlexIndexLibrary): PlexIndexLibrary {
  return {
    key: String(section.key),
    title: section.title,
    type: section.type,
    agent: section.agent ?? null,
    scanner: section.scanner ?? null,
    language: section.language ?? null,
    updatedAt: new Date().toISOString(),
    lastSyncAt: previous?.lastSyncAt ?? null,
    itemCount: previous?.itemCount,
  }
}

export function mapMovieItem(item: any, libraryKey: string): PlexMovieIndexEntry {
  return {
    ratingKey: String(item.ratingKey),
    libraryKey,
    title: item.title,
    originalTitle: item.originalTitle ?? null,
    year: item.year ?? null,
    summary: item.summary ?? null,
    contentRating: item.contentRating ?? null,
    studio: item.studio ?? null,
    genres: Array.isArray(item.Genre) ? item.Genre.map((g: any) => g.tag).filter(Boolean) : [],
    posterPath: getPosterRelativePath(libraryKey, String(item.ratingKey)),
    thumbPath: item.thumb ?? null,
    addedAt: normalizePlexTimestamp(item.addedAt),
    updatedAt: normalizePlexTimestamp(item.updatedAt),
    type: "movie",
  }
}
