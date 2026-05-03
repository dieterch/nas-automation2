import { fetchPlexSafely } from "../../../utils/plex-utils"
import {
  ensurePlexIndexStructure,
  mapLibrary,
  readIndexedLibraries,
} from "../../../utils/plex-index"

export default defineEventHandler(async () => {
  await ensurePlexIndexStructure()

  const local = await readIndexedLibraries()
  const localMap = new Map(local.items.map((item) => [item.key, item]))

  const live = await fetchPlexSafely("/library/sections")
  if ((live as any)?.error) {
    return {
      online: false,
      items: local.items,
      source: "local",
      error: (live as any).message ?? "Plex unavailable",
    }
  }

  const sections = (live as any)?.MediaContainer?.Directory ?? []
  const items = sections
    .filter((section: any) => ["movie", "show"].includes(section.type))
    .map((section: any) => mapLibrary(section, localMap.get(String(section.key))))

  return {
    online: true,
    source: "live",
    items,
  }
})
