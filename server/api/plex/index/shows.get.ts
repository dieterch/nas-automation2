import { getQuery } from "h3"
import { ensurePlexIndexStructure, readIndexedEpisodes, readIndexedShows } from "../../../utils/plex-index"

type SortKey =
  | "recorded-desc"
  | "recorded-asc"
  | "production-desc"
  | "production-asc"
  | "title-asc"
  | "title-desc"

function compareDate(a?: string | null, b?: string | null, direction: "asc" | "desc" = "desc") {
  const aTime = a ? new Date(a).getTime() : Number.NaN
  const bTime = b ? new Date(b).getTime() : Number.NaN
  const aValid = Number.isFinite(aTime)
  const bValid = Number.isFinite(bTime)

  if (aValid && bValid) {
    return direction === "asc" ? aTime - bTime : bTime - aTime
  }

  if (aValid) return -1
  if (bValid) return 1
  return 0
}

export default defineEventHandler(async (event) => {
  await ensurePlexIndexStructure()

  const query = getQuery(event)
  const libraryKey = typeof query.libraryKey === "string" ? query.libraryKey : ""
  const q = typeof query.q === "string" ? query.q.trim().toLowerCase() : ""
  const sort = typeof query.sort === "string" ? query.sort as SortKey : "title-asc"

  const showsData = await readIndexedShows()
  const episodesData = await readIndexedEpisodes()
  let items = showsData.items

  if (libraryKey) {
    items = items.filter((item) => item.libraryKey === libraryKey)
  }

  const episodeMap = new Map<string, string[]>()
  for (const episode of episodesData.items) {
    if (libraryKey && episode.libraryKey !== libraryKey) continue

    const text = [
      episode.title,
      episode.showTitle,
      episode.seasonTitle ?? "",
      episode.summary ?? "",
    ].join(" ").toLowerCase()

    const existing = episodeMap.get(episode.showRatingKey) ?? []
    existing.push(text)
    episodeMap.set(episode.showRatingKey, existing)
  }

  if (q) {
    items = items.filter((item) => {
      const episodeTexts = episodeMap.get(item.ratingKey) ?? []
      return (
        item.title.toLowerCase().includes(q) ||
        (item.originalTitle ?? "").toLowerCase().includes(q) ||
        (item.summary ?? "").toLowerCase().includes(q) ||
        String(item.year ?? "").includes(q) ||
        episodeTexts.some((text) => text.includes(q))
      )
    })
  }

  items = [...items].sort((a, b) => {
    switch (sort) {
      case "recorded-desc": {
        const dateDiff = compareDate(a.addedAt, b.addedAt, "desc")
        if (dateDiff !== 0) return dateDiff
        return a.title.localeCompare(b.title, "de")
      }
      case "recorded-asc": {
        const dateDiff = compareDate(a.addedAt, b.addedAt, "asc")
        if (dateDiff !== 0) return dateDiff
        return a.title.localeCompare(b.title, "de")
      }
      case "production-desc": {
        const dateDiff = compareDate(a.originallyAvailableAt, b.originallyAvailableAt, "desc")
        if (dateDiff !== 0) return dateDiff
        return a.title.localeCompare(b.title, "de")
      }
      case "production-asc": {
        const dateDiff = compareDate(a.originallyAvailableAt, b.originallyAvailableAt, "asc")
        if (dateDiff !== 0) return dateDiff
        return a.title.localeCompare(b.title, "de")
      }
      case "title-desc":
        return b.title.localeCompare(a.title, "de")
      case "title-asc":
      default:
        return a.title.localeCompare(b.title, "de")
    }
  })

  return {
    updatedAt: [showsData.updatedAt, episodesData.updatedAt].filter(Boolean).sort().at(-1) ?? null,
    count: items.length,
    items,
  }
})
