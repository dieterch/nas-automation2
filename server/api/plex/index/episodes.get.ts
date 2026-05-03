import { getQuery } from "h3"
import { ensurePlexIndexStructure, readIndexedEpisodes } from "../../../utils/plex-index"

export default defineEventHandler(async (event) => {
  await ensurePlexIndexStructure()

  const query = getQuery(event)
  const libraryKey = typeof query.libraryKey === "string" ? query.libraryKey : ""
  const showRatingKey = typeof query.showRatingKey === "string" ? query.showRatingKey : ""

  const data = await readIndexedEpisodes()
  let items = data.items

  if (libraryKey) {
    items = items.filter((item) => item.libraryKey === libraryKey)
  }

  if (showRatingKey) {
    items = items.filter((item) => item.showRatingKey === showRatingKey)
  }

  items = [...items].sort((a, b) => {
    const seasonDiff = (a.seasonNumber ?? 0) - (b.seasonNumber ?? 0)
    if (seasonDiff !== 0) return seasonDiff

    const episodeDiff = (a.episodeNumber ?? 0) - (b.episodeNumber ?? 0)
    if (episodeDiff !== 0) return episodeDiff

    return a.title.localeCompare(b.title, "de")
  })

  return {
    updatedAt: data.updatedAt,
    count: items.length,
    items,
  }
})
