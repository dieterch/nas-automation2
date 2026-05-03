import { getQuery } from "h3"
import { ensurePlexIndexStructure, readIndexedMovies } from "../../../utils/plex-index"

export default defineEventHandler(async (event) => {
  await ensurePlexIndexStructure()

  const query = getQuery(event)
  const libraryKey = typeof query.libraryKey === "string" ? query.libraryKey : ""
  const q = typeof query.q === "string" ? query.q.trim().toLowerCase() : ""

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
    const yearDiff = (b.year ?? 0) - (a.year ?? 0)
    if (yearDiff !== 0) return yearDiff
    return a.title.localeCompare(b.title, "de")
  })

  return {
    updatedAt: data.updatedAt,
    count: items.length,
    items,
  }
})
