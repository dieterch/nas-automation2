import { readFile } from "fs/promises"
import { getQuery, setHeader } from "h3"
import { readPosterFileInfo } from "../../../utils/plex-index"

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const libraryKey = typeof query.libraryKey === "string" ? query.libraryKey : ""
  const ratingKey = typeof query.ratingKey === "string" ? query.ratingKey : ""

  if (!libraryKey || !ratingKey) {
    throw createError({
      statusCode: 400,
      statusMessage: "libraryKey and ratingKey are required",
    })
  }

  try {
    const { path, info } = await readPosterFileInfo(libraryKey, ratingKey)
    const buffer = await readFile(path)

    setHeader(event, "content-type", "image/jpeg")
    setHeader(event, "content-length", String(info.size))
    setHeader(event, "cache-control", "public, max-age=3600")

    return buffer
  } catch {
    throw createError({
      statusCode: 404,
      statusMessage: "Poster not found",
    })
  }
})
