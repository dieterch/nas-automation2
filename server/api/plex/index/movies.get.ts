import { getQuery } from "h3"
import { ensurePlexIndexStructure, readIndexedMovies } from "../../../utils/plex-index"

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
  const sort = typeof query.sort === "string" ? query.sort as SortKey : "recorded-desc"

  const data = await readIndexedMovies()
  let items = data.items

  if (libraryKey) {
    items = items.filter((item) => item.libraryKey === libraryKey)
  }

  if (q) {
    items = items.filter((item) => {
      return (
        item.title.toLowerCase().includes(q) ||
        (item.originalTitle ?? "").toLowerCase().includes(q) ||
        String(item.year ?? "").includes(q)
      )
    })
  }

  items = [...items].sort((a, b) => {
    switch (sort) {
      case "recorded-asc": {
        const dateDiff = compareDate(a.addedAt, b.addedAt, "asc")
        if (dateDiff !== 0) return dateDiff
        return a.title.localeCompare(b.title, "de")
      }
      case "production-desc": {
        const dateDiff = compareDate(a.originallyAvailableAt, b.originallyAvailableAt, "desc")
        if (dateDiff !== 0) return dateDiff
        const yearDiff = (b.year ?? 0) - (a.year ?? 0)
        if (yearDiff !== 0) return yearDiff
        return a.title.localeCompare(b.title, "de")
      }
      case "production-asc": {
        const dateDiff = compareDate(a.originallyAvailableAt, b.originallyAvailableAt, "asc")
        if (dateDiff !== 0) return dateDiff
        const yearDiff = (a.year ?? 0) - (b.year ?? 0)
        if (yearDiff !== 0) return yearDiff
        return a.title.localeCompare(b.title, "de")
      }
      case "title-asc":
        return a.title.localeCompare(b.title, "de")
      case "title-desc":
        return b.title.localeCompare(a.title, "de")
      case "recorded-desc":
      default: {
        const dateDiff = compareDate(a.addedAt, b.addedAt, "desc")
        if (dateDiff !== 0) return dateDiff
        return a.title.localeCompare(b.title, "de")
      }
    }
  })

  return {
    updatedAt: data.updatedAt,
    count: items.length,
    items,
  }
})
